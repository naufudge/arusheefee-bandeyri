"use client";

import React from "react";
import { Document, Page, Text, View, Image, Font } from "@react-pdf/renderer";

// The SAP "Asset Master Data Creation Form", drawn cell for cell as the
// office's Excel sheet prints it (Documents/NAM/Asset creation form.xlsx →
// PDF). Every position below was measured from that print: the sheet's
// columns A–G and 59 rows, its fills, and Excel's 0.84 pt thin borders.
// One page per form of the set.

// Carlito is metric-compatible with Calibri (the sheet's font), so text
// lands where Excel puts it. SIL Open Font License (public/fonts).
Font.register({
  family: "Carlito",
  fonts: [
    { src: "/fonts/Carlito-Regular.ttf" },
    { src: "/fonts/Carlito-Bold.ttf", fontWeight: "bold" },
  ],
});

// Column edges A…G and the right edge of G, in pt.
const X = [50.88, 92.8, 134.72, 200.39, 242.27, 305.87, 411.37, 502.72];
const [A, C, D, E, F, G, END] = [0, 2, 3, 4, 5, 6, 7];

// Row tops for rows 1–59 (and the bottom of 59). Excel's print scale makes
// a standard row 11.64 pt; a few rows are taller on the sheet.
const TALL: Record<number, number> = { 1: 15.96, 47: 22.44, 49: 12.24, 53: 31.08 };
const Y: number[] = [];
{
  let y = 54.48;
  for (let r = 1; r <= 60; r++) {
    Y[r] = y;
    y += TALL[r] ?? 11.64;
  }
}

const LINE = 0.84;
const PAD = 1.7;
// Carlito's ascent + descent, as a share of the font size.
const LINE_BOX = 1.221;

// Excel breaks wrapped text between words only.
const wholeWords = (word: string) => [word];

// Excel font sizes as printed (the sheet's 10 pt prints at 8.4 pt).
const SIZE = { 10: 8.4, 11: 9.2, 12: 10.05, 14: 11.75, 15: 12.95 } as const;

const FILL = {
  title: "#d9d9d9",
  band: "#bdd7ee",
  request: "#f8cbad",
  glCode: "#ddebf7",
  requestedBy: "#c9c9c9",
  sapUpdate: "#ffe699",
};

// Carlito advance widths (per 1000 em) for ASCII 32–126, to tell when a
// value runs past its box the way Excel lets text spill.
const REG_W = [226,326,401,498,507,715,682,221,303,303,498,498,250,306,252,386,507,507,507,507,507,507,507,507,507,507,268,268,498,498,498,463,894,579,544,533,615,488,459,631,623,252,319,520,420,855,646,662,517,673,543,459,487,642,567,890,519,487,468,307,386,307,498,498,291,479,525,423,525,498,305,471,525,229,239,455,229,799,525,527,525,525,349,391,335,525,452,715,433,453,395,314,460,314,498];
const BOLD_W = [226,326,438,498,507,729,705,233,312,312,498,498,258,306,267,430,507,507,507,507,507,507,507,507,507,507,276,276,498,498,498,463,898,606,561,529,630,488,459,637,631,267,331,547,423,874,659,676,532,686,563,473,495,653,591,906,551,520,478,325,430,325,498,498,300,494,537,418,537,503,316,474,537,246,255,480,246,813,537,538,537,537,355,399,347,537,473,745,459,474,397,344,475,344,498];

function textWidth(text: string, bold: boolean, size: number): number {
  const table = bold ? BOLD_W : REG_W;
  let units = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    units += code >= 32 && code <= 126 ? table[code - 32] : 520;
  }
  return (units / 1000) * size;
}

export interface AssetCreationPdfPerson {
  /** ID card number — the form's "SAP User ID". */
  idCardNo?: string | null;
  name?: string;
  designation?: string;
  /** Formatted; set once this person has signed. */
  date?: string;
  /** `data:` URL, present once this person has signed. */
  signature?: string | null;
}

export interface AssetCreationPdfData {
  requestFor: string;
  agencyName: string;
  businessArea: string;
  costCentre: string;
  fund: string;
  functionalArea: string;
  description1: string;
  description2: string;
  useOfAsset: string;
  location: string;
  quantity: number;
  requestedAssetClass: string;
  /** Shown top right: the confirmed class, else the requested one. */
  assetClass: string;
  glCode: number;
  glName: string;
  vendor: string;
  manufacturer: string;
  purchasedNew: boolean;
  acquisitionDate: string;
  commenceDate: string;
  countryOfOrigin: string;
  brand: string;
  originalValue: number | null;
  usefulLife: number | null;
  usefulLifeReason: string;
  requestedBy: AssetCreationPdfPerson;
  authorizedBy: AssetCreationPdfPerson;
  sapUpdatedBy: AssetCreationPdfPerson;
  /** One page each. */
  forms: { formNum: string; sapAssetNum: string | null }[];
}

type Sides = string; // any of "l", "t", "r", "b"

// A cell's borders (thin, centred on the grid lines like Excel's) and fill.
function Box({
  c1,
  c2,
  r1,
  r2 = r1,
  sides = "ltrb",
  fill,
}: {
  c1: number;
  c2: number;
  r1: number;
  r2?: number;
  sides?: Sides;
  fill?: string;
}) {
  const x1 = X[c1];
  const x2 = X[c2];
  const y1 = Y[r1];
  const y2 = Y[r2 + 1];
  const h = LINE / 2;
  const line = (left: number, top: number, width: number, height: number, key: string) => (
    <View
      key={key}
      style={{ position: "absolute", left, top, width, height, backgroundColor: "#000" }}
    />
  );
  return (
    <>
      {fill && (
        <View
          style={{
            position: "absolute",
            left: x1,
            top: y1,
            width: x2 - x1,
            height: y2 - y1,
            backgroundColor: fill,
          }}
        />
      )}
      {sides.includes("t") && line(x1 - h, y1 - h, x2 - x1 + LINE, LINE, "t")}
      {sides.includes("b") && line(x1 - h, y2 - h, x2 - x1 + LINE, LINE, "b")}
      {sides.includes("l") && line(x1 - h, y1 - h, LINE, y2 - y1 + LINE, "l")}
      {sides.includes("r") && line(x2 - h, y1 - h, LINE, y2 - y1 + LINE, "r")}
    </>
  );
}

// Text across columns c1…c2 (exclusive end edge index) and rows r1…r2,
// vertically centred. Single-line text shrinks to fit rather than wrap.
function T({
  c1,
  c2,
  r1,
  r2 = r1,
  children,
  align = "left",
  size = 10,
  bold = false,
  color = "#000",
  wrap = false,
}: {
  c1: number;
  c2: number;
  r1: number;
  r2?: number;
  children: React.ReactNode;
  align?: "left" | "center" | "right";
  size?: keyof typeof SIZE;
  bold?: boolean;
  color?: string;
  wrap?: boolean;
}) {
  const text = children == null ? "" : String(children);
  if (!text) return null;
  const width = X[c2] - X[c1] - PAD * 2;
  let fontSize: number = SIZE[size];
  if (!wrap) {
    const natural = textWidth(text, bold, fontSize);
    if (natural > width) fontSize = Math.max(5, (fontSize * width) / natural);
  }
  // Large headings are taller than their row; Excel lets them overhang it
  // evenly, so grow the box around the row's centre (react-pdf would drop
  // text that doesn't fit).
  const rowTop = Y[r1];
  const rowHeight = Y[r2 + 1] - Y[r1];
  const need = fontSize * LINE_BOX;
  const grow = need > rowHeight ? (need - rowHeight) / 2 + 0.5 : 0;
  return (
    <View
      style={{
        position: "absolute",
        left: X[c1] + PAD,
        top: rowTop - grow,
        width,
        height: rowHeight + grow * 2,
        justifyContent: "center",
      }}
    >
      <Text
        hyphenationCallback={wholeWords}
        style={{
          fontFamily: "Carlito",
          fontWeight: bold ? "bold" : "normal",
          fontSize,
          color,
          textAlign: align,
          lineHeight: wrap ? 1.3 : undefined,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

// A value printed left in column C that, like Excel, may run on into the
// empty columns beside it; the box then loses its right edge.
function SpillC({ row, children }: { row: number; children: string | undefined }) {
  const text = children ?? "";
  const spills = textWidth(text, true, SIZE[10]) > X[D] - X[C] - PAD * 2;
  return (
    <>
      <Box c1={C} c2={D} r1={row} sides={spills ? "ltb" : "ltrb"} />
      <T c1={C} c2={F} r1={row} bold>
        {text}
      </T>
    </>
  );
}

// The "Asset Purchased new / used" tick boxes (Excel form controls).
function TickBox({ left, top, width, height, checked }: { left: number; top: number; width: number; height: number; checked: boolean }) {
  return (
    <View
      style={{
        position: "absolute",
        left: left + 0.315,
        top: top + 0.315,
        width: width - 0.63,
        height: height - 0.63,
        borderWidth: 0.63,
        borderColor: "#000",
        backgroundColor: checked ? "#000" : "#fff",
      }}
    />
  );
}

function Signature({ c1, c2, r1, r2 = r1, src }: { c1: number; c2: number; r1: number; r2?: number; src?: string | null }) {
  if (!src) return null;
  const inset = 1.5;
  return (
    <View
      style={{
        position: "absolute",
        left: X[c1] + inset,
        top: Y[r1] + inset,
        width: X[c2] - X[c1] - inset * 2,
        height: Y[r2 + 1] - Y[r1] - inset * 2,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <Image src={src} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
    </View>
  );
}

const money = (n: number | null) =>
  n == null ? "" : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function FormPage({ data, form }: { data: AssetCreationPdfData; form: AssetCreationPdfData["forms"][number] }) {
  const { requestedBy: rq, authorizedBy: au, sapUpdatedBy: sap } = data;
  return (
    <Page size="A4" style={{ position: "relative", backgroundColor: "#fff" }}>
      {/* Title */}
      <Box c1={A} c2={END} r1={1} sides="" fill={FILL.title} />
      <T c1={A} c2={END} r1={1} align="center" size={15} bold>
        ASSET MASTER DATA CREATION FORM
      </T>

      {/* Header */}
      <T c1={A} c2={C} r1={2}>Agency Name</T>
      <Box c1={C} c2={E} r1={2} />
      <T c1={C} c2={E} r1={2} align="center">{data.agencyName}</T>
      <T c1={F} c2={G} r1={2} bold>Request for:</T>
      <Box c1={G} c2={END} r1={2} fill={FILL.request} />
      <T c1={G} c2={END} r1={2} align="center">{data.requestFor}</T>

      <T c1={A} c2={C} r1={4}>Business Area</T>
      <Box c1={C} c2={D} r1={4} />
      <T c1={C} c2={D} r1={4} align="center">{data.businessArea}</T>
      <T c1={F} c2={G} r1={4} bold>Asset Creation Form No</T>
      <Box c1={G} c2={END} r1={4} />
      <T c1={G} c2={END} r1={4} align="center">{form.formNum}</T>

      <T c1={A} c2={C} r1={6}>Cost Centre /WBS</T>
      <Box c1={C} c2={D} r1={6} />
      <T c1={C} c2={D} r1={6} align="center">{data.costCentre}</T>
      <T c1={F} c2={G} r1={6} bold>Asset No</T>
      <Box c1={G} c2={END} r1={6} />
      <T c1={G} c2={END} r1={6} align="center">{form.sapAssetNum}</T>

      <T c1={A} c2={C} r1={8}>Fund</T>
      <Box c1={C} c2={D} r1={8} />
      <T c1={C} c2={D} r1={8} align="center">{data.fund}</T>
      <T c1={F} c2={G} r1={8} bold>Asset Class</T>
      <Box c1={G} c2={END} r1={8} />
      <T c1={G} c2={END} r1={8} align="center" size={11}>{data.assetClass}</T>

      <T c1={A} c2={C} r1={10}>Functional Area</T>
      <Box c1={C} c2={E} r1={10} />
      <T c1={C} c2={E} r1={10} align="center">{data.functionalArea}</T>

      {/* Asset general information */}
      <Box c1={A} c2={END} r1={12} sides="" fill={FILL.band} />
      <T c1={A} c2={END} r1={12} align="center" size={14} bold>Asset General Information</T>

      <T c1={A} c2={C} r1={13} bold>Description 1</T>
      <Box c1={C} c2={END} r1={13} />
      <T c1={C} c2={END} r1={13}>{data.description1}</T>

      <T c1={A} c2={C} r1={15} bold>Description 2</T>
      <Box c1={C} c2={END} r1={15} />
      <T c1={C} c2={END} r1={15}>{data.description2}</T>

      <T c1={A} c2={C} r1={17} bold>Use of the Asset</T>
      <Box c1={C} c2={END} r1={17} />
      <T c1={C} c2={END} r1={17}>{data.useOfAsset}</T>

      <T c1={A} c2={D} r1={19} bold>Location in which the asset will be used</T>
      <Box c1={D} c2={END} r1={19} />
      <T c1={D} c2={END} r1={19} align="center" size={11}>{data.location}</T>

      <T c1={A} c2={C} r1={21} bold>Quantity (in pieces)</T>
      <Box c1={C} c2={D} r1={21} />
      <T c1={C} c2={D} r1={21} align="right">{data.quantity}</T>
      <T c1={F} c2={G} r1={21} bold>Requested Asset Class</T>
      <Box c1={G} c2={END} r1={21} />
      <T c1={G} c2={END} r1={21} align="center" size={11}>{data.requestedAssetClass}</T>

      <T c1={A} c2={C} r1={23} bold>Requested GL Code</T>
      {/* The GL code cell is shaded; its name runs across D–E. */}
      <Box c1={C} c2={D} r1={23} sides="ltr" fill={FILL.glCode} />
      <Box c1={D} c2={F} r1={23} sides="tr" />
      <Box c1={E} c2={F} r1={23} sides="b" />
      <T c1={C} c2={D} r1={23} align="center">{data.glCode}</T>
      <T c1={D} c2={F} r1={23}>{data.glName}</T>

      {/* Asset origin information */}
      <Box c1={A} c2={END} r1={24} sides="" fill={FILL.band} />
      <T c1={A} c2={END} r1={24} align="center" size={14} bold>Asset Origin Information</T>

      <T c1={A} c2={C} r1={25} bold>Vendor</T>
      <Box c1={C} c2={END} r1={25} />
      <T c1={C} c2={END} r1={25}>{data.vendor}</T>

      <T c1={A} c2={C} r1={27} bold>Manufacturer</T>
      <Box c1={C} c2={END} r1={27} />
      <T c1={C} c2={END} r1={27}>{data.manufacturer}</T>

      <T c1={A} c2={C} r1={29} bold>Asset Purchased new</T>
      <TickBox left={162.84} top={384.1} width={14.77} height={12.45} checked={data.purchasedNew} />
      <T c1={F} c2={G} r1={29} align="right" bold>Asset purchased used</T>
      <TickBox left={453.47} top={384.7} width={14.77} height={11.74} checked={!data.purchasedNew} />

      <T c1={A} c2={C} r1={31} bold>Acquisition Date</T>
      <Box c1={C} c2={D} r1={31} />
      <T c1={C} c2={D} r1={31} align="center">{data.acquisitionDate}</T>
      <T c1={F} c2={G} r1={31} align="right" bold>Asset use Commence Date</T>
      <Box c1={G} c2={END} r1={31} />
      <T c1={G} c2={END} r1={31} align="center">{data.commenceDate}</T>

      <T c1={A} c2={C} r1={33} bold>Country of Origin</T>
      <Box c1={C} c2={END} r1={33} />
      <T c1={C} c2={END} r1={33}>{data.countryOfOrigin}</T>

      <T c1={A} c2={C} r1={35} bold>Type/ Brand Name</T>
      <Box c1={C} c2={END} r1={35} />
      <T c1={C} c2={END} r1={35}>{data.brand}</T>

      <T c1={A} c2={C} r1={37} bold>Original Value</T>
      <Box c1={C} c2={D} r1={37} />
      <T c1={C} c2={D} r1={37} align="right">{money(data.originalValue)}</T>

      {/* Depreciation information */}
      <Box c1={A} c2={END} r1={38} sides="" fill={FILL.band} />
      <T c1={A} c2={END} r1={38} align="center" size={14} bold>Depreciation Information</T>
      <T c1={A} c2={END} r1={39} align="center">
        fill in this area only if the default life of asset needs to be changed (specifying the reason for the change)
      </T>

      <T c1={A} c2={C} r1={41} bold>Useful Life</T>
      <Box c1={C} c2={D} r1={41} />
      <T c1={C} c2={D} r1={41} align="right">{data.usefulLife ?? ""}</T>
      <T c1={D} c2={E} r1={41}>Years</T>

      <T c1={A} c2={C} r1={43} bold>Reason</T>
      <Box c1={C} c2={END} r1={43} />
      <T c1={C} c2={END} r1={43} align="center">{data.usefulLifeReason}</T>

      {/* Requested by / Authorised by */}
      <Box c1={A} c2={END} r1={44} sides="" fill={FILL.requestedBy} />
      <T c1={A} c2={C} r1={44} size={12} bold>Requested by:</T>
      <T c1={F} c2={G} r1={44} align="right" size={12} bold>Authorised by:</T>

      <T c1={A} c2={C} r1={45} bold>SAP User ID</T>
      <SpillC row={45}>{rq.idCardNo ?? ""}</SpillC>
      <T c1={F} c2={G} r1={45} bold>SAP User ID</T>
      <Box c1={G} c2={END} r1={45} />
      <T c1={G} c2={END} r1={45} bold>{au.idCardNo ?? ""}</T>

      <T c1={A} c2={C} r1={47} bold>Name</T>
      <SpillC row={47}>{rq.name}</SpillC>
      <T c1={F} c2={G} r1={47} bold>Name</T>
      <Box c1={G} c2={END} r1={47} />
      <T c1={G} c2={END} r1={47} bold wrap>{au.name}</T>

      <T c1={A} c2={C} r1={49} bold>Designation</T>
      <SpillC row={49}>{rq.designation}</SpillC>
      <T c1={F} c2={G} r1={49} bold>Designation</T>
      <Box c1={G} c2={END} r1={49} />
      <T c1={G} c2={END} r1={49} bold>{au.designation}</T>

      <T c1={A} c2={C} r1={51} bold>Date</T>
      <Box c1={C} c2={D} r1={51} />
      {/* Red, as on the sheet. */}
      <T c1={C} c2={F} r1={51} bold color="#ff0000">{rq.date}</T>
      <T c1={F} c2={G} r1={51} bold>Date</T>
      <Box c1={G} c2={END} r1={51} />
      <T c1={G} c2={END} r1={51} bold>{au.date}</T>

      <T c1={A} c2={C} r1={53} bold>Signature</T>
      <Box c1={C} c2={D} r1={53} />
      <Signature c1={C} c2={D} r1={53} src={rq.signature} />
      <T c1={F} c2={G} r1={53} bold>Signature</T>
      <Box c1={G} c2={END} r1={53} />
      <Signature c1={G} c2={END} r1={53} src={au.signature} />

      {/* SAP asset master update */}
      <Box c1={A} c2={END} r1={54} sides="" fill={FILL.sapUpdate} />
      <T c1={A} c2={F} r1={54} size={12} bold>SAP Asset Master Update by:</T>

      <T c1={A} c2={C} r1={55} bold>SAP User ID</T>
      <SpillC row={55}>{sap.idCardNo ?? ""}</SpillC>
      <T c1={F} c2={G} r1={55} r2={57} align="right" bold>Signature</T>
      <Box c1={G} c2={END} r1={55} r2={57} />
      <Signature c1={G} c2={END} r1={55} r2={57} src={sap.signature} />

      <T c1={A} c2={C} r1={57} bold>Name</T>
      <Box c1={C} c2={E} r1={57} />
      <T c1={C} c2={E} r1={57} bold>{sap.name}</T>

      <T c1={A} c2={C} r1={59} bold>Designation</T>
      <Box c1={C} c2={E} r1={59} />
      <T c1={C} c2={E} r1={59} bold>{sap.designation}</T>
      <T c1={F} c2={G} r1={59} align="right" bold>Date</T>
      <Box c1={G} c2={END} r1={59} />
      <T c1={G} c2={END} r1={59} align="right" bold>{sap.date}</T>
    </Page>
  );
}

export default function AssetCreationPdf({ data }: { data: AssetCreationPdfData }) {
  const title = data.forms.length
    ? `Asset creation form ${data.forms[0].formNum}`
    : "Asset creation form";
  return (
    <Document title={title} author="National Archives of Maldives">
      {data.forms.map((form) => (
        <FormPage key={form.formNum} data={data} form={form} />
      ))}
    </Document>
  );
}
