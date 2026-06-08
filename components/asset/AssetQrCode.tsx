"use client";

import React, { useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Download, Printer, QrCode } from "lucide-react";

interface AssetQrCodeProps {
  assetNum: string;
  assetName: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * QR panel for the asset detail page. Encodes a link back to this asset's
 * own page so a printed sticker on the physical item scans straight to its
 * record. The URL is built on the client (needs window.origin).
 */
export const AssetQrCode: React.FC<AssetQrCodeProps> = ({
  assetNum,
  assetName,
}) => {
  // window.location.origin is only available on the client. Read it once via a
  // lazy initializer (runs on the client's first render) rather than a
  // setState-in-effect, then derive the URL each render so it tracks assetNum.
  const [origin] = useState<string>(() =>
    typeof window !== "undefined" ? window.location.origin : "",
  );
  const path = `/asset/${encodeURIComponent(assetNum)}`;
  const url = origin ? `${origin}${path}` : path;
  const wrapRef = useRef<HTMLDivElement>(null);

  const getCanvas = () =>
    wrapRef.current?.querySelector("canvas") as HTMLCanvasElement | null;

  const downloadPng = () => {
    const canvas = getCanvas();
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `asset-${assetNum}.png`;
    link.href = canvas.toDataURL("image/png");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printQr = () => {
    const canvas = getCanvas();
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const w = window.open("", "_blank", "width=420,height=520");
    if (!w) return;
    w.document.write(
      `<html><head><title>${escapeHtml(assetNum)}</title></head>` +
        `<body style="margin:0;text-align:center;font-family:sans-serif;padding:32px;">` +
        `<img src="${dataUrl}" style="width:260px;height:260px;image-rendering:pixelated;" />` +
        `<div style="margin-top:14px;font-family:monospace;font-size:15px;font-weight:600;">${escapeHtml(assetNum)}</div>` +
        `<div style="margin-top:4px;font-size:12px;color:#555;">${escapeHtml(assetName)}</div>` +
        `</body></html>`,
    );
    w.document.close();
    w.focus();
    // Give the image a tick to load before printing.
    w.onload = () => w.print();
    setTimeout(() => {
      try {
        w.print();
      } catch {
        /* no-op */
      }
    }, 250);
  };

  return (
    <section className="rounded-md border bg-card">
      <header className="flex items-center gap-2 border-b px-4 py-3 sm:px-5">
        <QrCode className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">QR Code</h2>
      </header>
      <div className="flex flex-col items-center gap-4 p-5">
        <div
          ref={wrapRef}
          className="rounded-md border bg-white p-3"
          title="Scan to open this asset"
        >
          <QRCodeCanvas value={url} size={176} level="M" marginSize={2} />
        </div>
        <p className="text-center text-[11px] text-muted-foreground">
          Scan to open this asset&apos;s page. Print a sticker for the physical item.
        </p>
        <div className="flex w-full items-center gap-2">
          <button
            type="button"
            onClick={downloadPng}
            disabled={!origin}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
          >
            <Download className="size-4" />
            PNG
          </button>
          <button
            type="button"
            onClick={printQr}
            disabled={!origin}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
          >
            <Printer className="size-4" />
            Print
          </button>
        </div>
      </div>
    </section>
  );
};

export default AssetQrCode;
