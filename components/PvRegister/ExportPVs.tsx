import React from "react";
import { Button } from "@/components/ui/button";
import Image from "next/image";

interface ExportPVsProps {
  year: number | string;
}

const ExportPVs: React.FC<ExportPVsProps> = ({ year }) => {
  const handleExportClick = () => {
    // Use the new local API route for Excel export
    const url = `/api/pv/export/${year}`;
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `pv_register_${year}.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Button
      onClick={handleExportClick}
      className="bg-green-600 hover:bg-green-700 text-white px-2 transition-all duration-200"
    >
      <Image
        src={"/icons/excel.svg"}
        alt="excel"
        width={25}
        height={0}
        className="invert"
      />
      Export PV Register
    </Button>
  );
};

export default ExportPVs;