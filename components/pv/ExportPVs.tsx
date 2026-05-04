import React from "react";
import { Download } from "lucide-react";

interface ExportPVsProps {
  year: number | string;
}

const ExportPVs: React.FC<ExportPVsProps> = ({ year }) => {
  const handleExportClick = () => {
    const url = `/api/pv/export/${year}`;
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `pv_register_${year}.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <button
      type="button"
      onClick={handleExportClick}
      className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-background px-3 text-sm font-medium transition hover:bg-muted"
    >
      <Download className="size-4" />
      Export
    </button>
  );
};

export default ExportPVs;
