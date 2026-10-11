"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import { Download, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { requestTypeLabel } from "@/lib/asset-creation";
import type { AssetCreationPdfData, AssetCreationPdfPerson } from "./AssetCreationPdf";
import type { AssetCreationPdfPayload } from "./types";

type Staffish = {
  name: string;
  designation: string;
  idCardNo: string | null;
} | null;

const person = (
  s: Staffish,
  signedAt: Date | string | null,
  signature: string | null,
  dateFormat: string,
): AssetCreationPdfPerson => ({
  idCardNo: s?.idCardNo ?? null,
  name: s?.name,
  designation: s?.designation,
  date: signedAt ? format(new Date(signedAt), dateFormat) : undefined,
  signature,
});

/** The set as the PDF prints it. */
export function toAssetCreationPdfData(ac: AssetCreationPdfPayload): AssetCreationPdfData {
  const acquired = ac.acquisitionDate ? new Date(ac.acquisitionDate) : null;
  return {
    requestFor: requestTypeLabel(ac.requestType),
    agencyName: ac.agencyName,
    businessArea: ac.businessArea,
    costCentre: ac.costCentre,
    fund: ac.fund,
    functionalArea: ac.functionalArea,
    description1: ac.description1,
    description2: ac.description2 ?? "",
    useOfAsset: ac.useOfAsset ?? "",
    location: ac.location,
    quantity: ac.quantity,
    requestedAssetClass: ac.requestedAssetClass,
    assetClass: ac.assetClass ?? ac.requestedAssetClass,
    glCode: ac.glAccount.code,
    glName: ac.glAccount.longTextEn,
    vendor: ac.vendor ?? "",
    manufacturer: ac.manufacturer ?? "",
    purchasedNew: ac.purchasedNew,
    // A bare year prints as the year, as on the sheet.
    acquisitionDate: acquired
      ? ac.acquisitionPrecision === "YEAR"
        ? String(acquired.getUTCFullYear())
        : format(acquired, "dd/MM/yyyy")
      : "",
    commenceDate: ac.commenceDate ? format(new Date(ac.commenceDate), "dd/MM/yyyy") : "",
    countryOfOrigin: ac.countryOfOrigin ?? "",
    brand: ac.brand ?? "",
    originalValue: ac.originalValue,
    usefulLife: ac.usefulLifeYears,
    usefulLifeReason: ac.usefulLifeReason ?? "",
    requestedBy: person(ac.requestedBy, ac.sentAt, ac.signatures.requestedBy, "dd/MM/yyyy"),
    authorizedBy: person(ac.authorizedBy, ac.authorizedAt, ac.signatures.authorizedBy, "dd/MM/yyyy"),
    sapUpdatedBy: person(ac.sapUpdatedBy, ac.sapUpdatedAt, ac.signatures.sapUpdatedBy, "dd.MM.yyyy"),
    forms: ac.forms.map((f) => ({ formNum: f.formNum, sapAssetNum: f.sapAssetNum })),
  };
}

interface Props {
  /** Any of the set's form numbers. */
  formNum: string;
  /** Labelled button (detail page) instead of an icon (register rows). */
  withLabel?: boolean;
}

export function DownloadAssetCreationPdf({ formNum, withLabel }: Props) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const handleDownload = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const ac = await queryClient.fetchQuery(
        trpc.assetCreation.pdfPayload.queryOptions({ formNum }),
      );
      const [{ renderPdfBlob }, { default: AssetCreationPdf }] = await Promise.all([
        import("@/lib/pdf-render"),
        import("./AssetCreationPdf"),
      ]);
      const blob = await renderPdfBlob(<AssetCreationPdf data={toAssetCreationPdfData(ac)} />);

      const first = ac.forms[0]?.formNum ?? formNum;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `asset_creation_form_${first.replace(/\//g, "-")}${ac.forms.length > 1 ? `_x${ac.forms.length}` : ""}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({
        title: "Could not download PDF",
        description: err instanceof Error ? err.message : "An unknown error occurred.",
      });
    } finally {
      setBusy(false);
    }
  };

  if (withLabel) {
    return (
      <button
        type="button"
        onClick={handleDownload}
        disabled={busy}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        Download PDF
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={busy}
      aria-label="Download PDF"
      title="Download PDF"
      className="transition hover:text-foreground disabled:opacity-50"
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
    </button>
  );
}
