/**
 * SharePoint / Microsoft Graph file storage.
 *
 * Application-auth (client_credentials) flow against the same Azure app reg
 * used for sign-in. Token is cached in-process for its lifetime minus a
 * 60-second safety margin. Single-instance deployment only — multiple
 * processes will each fetch their own token (cheap, but worth noting if
 * we ever horizontally scale).
 *
 * Two upload paths depending on file size:
 *   - ≤ 4 MB: single PUT to /content
 *   - > 4 MB: createUploadSession, then PUT chunks to the pre-signed
 *     uploadUrl. Chunk PUTs MUST NOT carry an Authorization header.
 */

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

// Graph's cutoff for simple uploads.
const UPLOAD_THRESHOLD = 4 * 1024 * 1024;
// Chunk size MUST be a multiple of 320 KiB. 320 KiB * 16 ≈ 5 MB.
const CHUNK_SIZE = 320 * 1024 * 16;

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export async function getSharePointAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const tenantId = env("AUTH_MICROSOFT_TENANT_ID");
  const clientId = env("AUTH_MICROSOFT_CLIENT_ID");
  const clientSecret = env("AUTH_MICROSOFT_CLIENT_SECRET");

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `SharePoint token request failed: ${res.status} ${text}`,
    );
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;
  return cachedToken;
}

function buildGraphPath(folder: string, path: string, fileName: string): string {
  return path ? `${folder}/${path}/${fileName}` : `${folder}/${fileName}`;
}

function buildGraphUrl(graphPath: string, suffix = "/content"): string {
  const siteId = env("SP_SITE_ID");
  const driveId = env("SP_DRIVE_ID");
  return `${GRAPH_BASE}/sites/${siteId}/drives/${driveId}/root:/${graphPath}:${suffix}`;
}

function logGraphError(context: string, status: number, url: string, body: string) {
  console.error(`[sharepoint] ${context} [${status}] ${url}: ${body}`);
}

type DriveItem = {
  id?: string;
  name?: string;
  webUrl?: string;
};

export type UploadResult = {
  name: string;
  webUrl: string | null;
};

export async function uploadFile(
  data: { buffer: ArrayBuffer; mimeType: string },
  opts: { name: string; path?: string },
): Promise<UploadResult> {
  const token = await getSharePointAccessToken();
  const folder = env("SP_ATTACHMENTS_FOLDER");
  const graphPath = buildGraphPath(folder, opts.path ?? "", opts.name);
  const contentUrl = buildGraphUrl(graphPath, "/content");
  const sessionUrl = buildGraphUrl(graphPath, "/createUploadSession");
  const size = data.buffer.byteLength;

  if (size <= UPLOAD_THRESHOLD) {
    const res = await fetch(contentUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": data.mimeType || "application/octet-stream",
      },
      body: data.buffer,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logGraphError("uploadFile (single PUT)", res.status, contentUrl, body);
      throw new Error(`SharePoint upload failed: ${res.status}`);
    }
    const item = (await res.json()) as DriveItem;
    return { name: item.name ?? opts.name, webUrl: item.webUrl ?? null };
  }

  // Large file: create upload session, then chunk.
  const sessionRes = await fetch(sessionUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      item: { "@microsoft.graph.conflictBehavior": "replace" },
    }),
  });
  if (!sessionRes.ok) {
    const body = await sessionRes.text().catch(() => "");
    logGraphError("uploadFile (createSession)", sessionRes.status, sessionUrl, body);
    throw new Error(`SharePoint upload session failed: ${sessionRes.status}`);
  }
  const session = (await sessionRes.json()) as { uploadUrl: string };

  const buffer = new Uint8Array(data.buffer);
  const totalSize = buffer.length;
  let start = 0;
  let lastItem: DriveItem | null = null;

  while (start < totalSize) {
    const end = Math.min(start + CHUNK_SIZE - 1, totalSize - 1);
    const chunk = buffer.subarray(start, end + 1);

    const chunkRes = await fetch(session.uploadUrl, {
      method: "PUT",
      // IMPORTANT: do NOT set Authorization — the session URL is pre-signed.
      headers: {
        "Content-Range": `bytes ${start}-${end}/${totalSize}`,
        "Content-Length": `${chunk.length}`,
      },
      body: chunk,
    });

    // 202 Accepted = chunk OK, more to come; 200/201 = final chunk OK.
    if (chunkRes.status !== 202 && chunkRes.status !== 200 && chunkRes.status !== 201) {
      const body = await chunkRes.text().catch(() => "");
      logGraphError(
        "uploadFile (chunk PUT)",
        chunkRes.status,
        session.uploadUrl,
        body,
      );
      throw new Error(`SharePoint chunk upload failed: ${chunkRes.status}`);
    }

    if (chunkRes.status === 200 || chunkRes.status === 201) {
      lastItem = (await chunkRes.json().catch(() => null)) as DriveItem | null;
    }

    start = end + 1;
  }

  return {
    name: lastItem?.name ?? opts.name,
    webUrl: lastItem?.webUrl ?? null,
  };
}

export type FileFetchResult = {
  buffer: ArrayBuffer;
  contentType: string;
};

export async function getFile(filePath: string): Promise<FileFetchResult> {
  const token = await getSharePointAccessToken();
  const folder = env("SP_ATTACHMENTS_FOLDER");
  const url = buildGraphUrl(buildGraphPath(folder, "", filePath));

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logGraphError("getFile", res.status, url, body);
    throw new Error(`SharePoint getFile failed: ${res.status}`);
  }
  return {
    buffer: await res.arrayBuffer(),
    contentType: res.headers.get("content-type") ?? "application/octet-stream",
  };
}

export type FileStreamResult = {
  body: ReadableStream<Uint8Array>;
  contentType: string;
  contentLength: string | null;
};

export async function getFileStream(filePath: string): Promise<FileStreamResult> {
  const token = await getSharePointAccessToken();
  const folder = env("SP_ATTACHMENTS_FOLDER");
  const url = buildGraphUrl(buildGraphPath(folder, "", filePath));

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    logGraphError("getFileStream", res.status, url, body);
    throw new Error(`SharePoint getFileStream failed: ${res.status}`);
  }
  return {
    body: res.body,
    contentType: res.headers.get("content-type") ?? "application/octet-stream",
    contentLength: res.headers.get("content-length"),
  };
}

export async function deleteFile(fileName: string, path = ""): Promise<void> {
  const token = await getSharePointAccessToken();
  const folder = env("SP_ATTACHMENTS_FOLDER");
  const cleanFileName = fileName.replace(/\//g, "_").replace(/'/g, "");
  const graphPath = path
    ? `${folder}/${path}/${cleanFileName}`
    : `${folder}/${cleanFileName}`;
  const siteId = env("SP_SITE_ID");
  const driveId = env("SP_DRIVE_ID");
  const url = `${GRAPH_BASE}/sites/${siteId}/drives/${driveId}/root:/${graphPath}:`;

  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) {
    const body = await res.text().catch(() => "");
    logGraphError("deleteFile", res.status, url, body);
    throw new Error(`SharePoint deleteFile failed: ${res.status}`);
  }
}

export function sanitizedBaseName(fileName: string): string {
  return fileName
    .replace(/\.[^/.]+$/, "")
    .replace(/['"]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-_]/g, "")
    .toLowerCase();
}

export function buildSharePointFileName(opts: {
  referenceType: string;
  referenceId: string;
  originalName: string;
}): string {
  const base = sanitizedBaseName(opts.originalName);
  const ext = opts.originalName.split(".").pop() ?? "";
  const safeType = opts.referenceType.replace(/[^a-zA-Z0-9-_]/g, "");
  const safeId = opts.referenceId.replace(/[^a-zA-Z0-9-_]/g, "");
  const stem = `${safeType}_${safeId}_${Date.now()}_${base}`;
  return ext ? `${stem}.${ext}` : stem;
}
