"use client";

import React, { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { RequisitionData } from "@/components/asset/RequisitionFormPdf";

// Sample data mirroring "GSR FORM - Requisition Form 1.docx" so the generated
// PDF reproduces the reference form 1:1.
const SAMPLE: RequisitionData = {
  section: "އެޑްމިން، ފައިނޭންސް އެންޑް އައި.ޓީ.",
  number: "(FRM)433-CA/433/2026/101",
  date: "06.05.2026",
  minItemRows: 7,
  items: [
    {
      remarks:
        "އާކައިވަލް އޮންލައިން ޓްރެއިނިންގް ތަކުގައި ބޭނުންކުރުމަށް ހެޑްސެޓް ހޯދުން",
      rqdDate: "20.05.2026",
      particulars: "Wired USB Headphones",
      issued: 10,
      requested: 10,
    },
  ],
  approvals: [
    {
      date: "20.05.2026",
      name: "Hawwa Haanee Ahmed",
      designation: "Assistant Project Officer",
      roleDv: "އެދުނު",
      roleEn: "Requested By",
    },
    {
      date: "20.05.2026",
      name: "Mohamed Zeehan Abdhulla",
      designation: "Director",
      roleDv: "ހުއްދަދެއްވި",
      roleEn: "Authorized By",
    },
    {
      roleDv: "ފޯމާއި ޙަވާލުވި ފަރާތް",
      roleEn: "Form Received By",
    },
  ],
};

const RequisitionSampleButton: React.FC = () => {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const handleDownload = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const [{ pdf }, { default: RequisitionFormPdf }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/components/asset/RequisitionFormPdf"),
      ]);

      const blob = await pdf(<RequisitionFormPdf data={SAMPLE} />).toBlob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Requisition Form (Sample).pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({
        title: "Could not generate sample PDF",
        description:
          err instanceof Error ? err.message : "An unknown error occurred.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={busy}
      className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted disabled:opacity-50"
      title="Download a sample Goods / Service Requisition Form PDF"
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <FileText className="size-4" />
      )}
      Sample PDF
    </button>
  );
};

export default RequisitionSampleButton;
