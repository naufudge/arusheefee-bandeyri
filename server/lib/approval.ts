import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";
import { getFile } from "@/lib/sharepoint";

/**
 * Approve actions on a PV or Petty Cash require the actor to have a
 * signature on file. The check runs as a precondition inside each
 * approval mutation; if it fails the client opens the
 * SignatureRequiredModal and retries after upload.
 *
 * Reference type matches the existing profile-signature flow
 * (`app/api/profile/signature/route.ts`).
 */
export async function assertActorHasSignature(
  prisma: PrismaClient,
  staffId: string,
) {
  const sig = await prisma.attachment.findFirst({
    where: { reference_type: "staff_signature", reference_id: staffId },
    select: { id: true },
  });
  if (!sig) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "SIGNATURE_REQUIRED",
    });
  }
}

/** Names of the five Petty Cash signing roles. Order matches the form. */
export const PC_ROLES = [
  "handledBy",
  "procurementApprovedBy",
  "budgetCheckedBy",
  "balanceHandedOverBy",
  "balanceCollectedBy",
] as const;

export type PCRole = (typeof PC_ROLES)[number];

/**
 * Map a role name to the FK column on `PettyCash` that points at its
 * `PettyCashStaff` row. Used to pick which row to mutate when the client
 * sends `role: "handledBy"`.
 */
export const PC_ROLE_TO_FK = {
  handledBy: "handledById",
  procurementApprovedBy: "procurementApprovedById",
  budgetCheckedBy: "budgetCheckedById",
  balanceHandedOverBy: "balanceHandedOverById",
  balanceCollectedBy: "balanceCollectedById",
} as const satisfies Record<PCRole, string>;

/**
 * Resolve a staff member's signature to a `data:` URL suitable for
 * react-pdf's `<Image src>`. Returns `null` if the staff has no signature
 * on file or the SharePoint fetch fails — callers should treat missing
 * signatures as "render blank cell", never as a fatal error.
 *
 * Caching: per-render only. Each PDF download fetches fresh bytes; that
 * keeps signature updates visible without invalidation plumbing, and PDF
 * downloads are infrequent enough that the latency is acceptable.
 */
export async function getSignatureDataUrl(
  prisma: PrismaClient,
  staffId: string | null | undefined,
): Promise<string | null> {
  if (!staffId) return null;

  const attachment = await prisma.attachment.findFirst({
    where: { reference_type: "staff_signature", reference_id: staffId },
    orderBy: { createdAt: "desc" },
    select: { sharepointFileName: true, mimeType: true },
  });

  if (!attachment?.sharepointFileName) return null;

  try {
    const { buffer, contentType } = await getFile(attachment.sharepointFileName);
    const base64 = Buffer.from(buffer).toString("base64");
    const mime = attachment.mimeType || contentType || "image/png";
    return `data:${mime};base64,${base64}`;
  } catch {
    // Signature file vanished between approval and download. Render blank.
    return null;
  }
}
