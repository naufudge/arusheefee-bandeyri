"use client";

import React from "react";
import { Document, Page, Text, View, Image, Font } from "@react-pdf/renderer";
import { carlitoWidth } from "@/lib/carlito-metrics";
import type { FiyesPdfPayload } from "./types";

// A Fiyes form's Approval_Template, drawn cell for cell from the filled
// workbook's own layout (server/lib/xlsx-layout.ts): the same column widths,
// row heights, borders, logos and text Excel prints, fitted onto one A4 page.
// The signatures sit in the "Signature:" row once each person has signed.

// Carlito is metric-compatible with Calibri (the templates' font).
Font.register({
  family: "Carlito",
  fonts: [
    { src: "/fonts/Carlito-Regular.ttf" },
    { src: "/fonts/Carlito-Bold.ttf", fontWeight: "bold" },
  ],
});

type Layout = FiyesPdfPayload["layout"];
type Box = Layout["boxes"][number];
type Txt = Layout["texts"][number];

const A4 = { w: 595.28, h: 841.89 };
// Excel's printed line weights.
const LINE: Record<string, number> = { thin: 0.84, hair: 0.35, dashed: 0.84, dotted: 0.84, medium: 1.5, thick: 2.25, double: 2 };
const PAD = 1.7;
// Carlito's ascent + descent, as a share of the font size.
const LINE_BOX = 1.221;

// Excel breaks wrapped text between words only.
const wholeWords = (word: string) => [word];

const VALIGN = { top: "flex-start", center: "center", bottom: "flex-end" } as const;

export default function FiyesSheetPdf({ data }: { data: FiyesPdfPayload }) {
  const { layout } = data;
  const landscape = layout.orientation === "landscape";
  const pageW = landscape ? A4.h : A4.w;
  const pageH = landscape ? A4.w : A4.h;
  const m = layout.margins;
  // Fit the sheet onto the page, never enlarging it.
  const s = Math.min(1, (pageW - m.left - m.right) / layout.width, (pageH - m.top - m.bottom) / layout.height);
  const X = (v: number) => m.left + v * s;
  const Y = (v: number) => m.top + v * s;

  return (
    <Document title={data.fileName.replace(/\.pdf$/, "")}>
      <Page size="A4" orientation={layout.orientation} style={{ fontFamily: "Carlito", color: "#000" }}>
        {layout.images.map((img, i) => (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image
            key={`img-${i}`}
            src={img.src}
            style={{ position: "absolute", left: X(img.x), top: Y(img.y), width: img.w * s, height: img.h * s }}
          />
        ))}
        {layout.boxes.map((box, i) => (
          <Borders key={`b-${i}`} box={box} X={X} Y={Y} />
        ))}
        {layout.texts.map((t, i) => (
          <Cell key={`t-${i}`} t={t} X={X} Y={Y} s={s} />
        ))}
        <Signature data={data} col={data.signatureColumns.entered} src={data.signatures.enteredBy} X={X} Y={Y} s={s} />
        <Signature data={data} col={data.signatureColumns.approved} src={data.signatures.approvedBy} X={X} Y={Y} s={s} />
      </Page>
    </Document>
  );
}

type Place = { X: (v: number) => number; Y: (v: number) => number; s: number };

// Line weights stay as Excel prints them; only positions scale.
function Borders({ box, X, Y }: { box: Box } & Omit<Place, "s">) {
  const x1 = X(box.x);
  const y1 = Y(box.y);
  const x2 = X(box.x + box.w);
  const y2 = Y(box.y + box.h);
  const line = (key: string, left: number, top: number, width: number, height: number) => (
    <View key={key} style={{ position: "absolute", left, top, width, height, backgroundColor: "#000" }} />
  );
  const { top, right, bottom, left } = box.borders;
  const w = (style?: string) => (style ? LINE[style] ?? LINE.thin : 0);
  return (
    <>
      {top && line("t", x1 - w(top) / 2, y1 - w(top) / 2, x2 - x1 + w(top), w(top))}
      {bottom && line("b", x1 - w(bottom) / 2, y2 - w(bottom) / 2, x2 - x1 + w(bottom), w(bottom))}
      {left && line("l", x1 - w(left) / 2, y1 - w(left) / 2, w(left), y2 - y1 + w(left))}
      {right && line("r", x2 - w(right) / 2, y1 - w(right) / 2, w(right), y2 - y1 + w(right))}
    </>
  );
}

function Cell({ t, X, Y, s }: { t: Txt } & Place) {
  // Excel's cell padding shrinks with the print scale like everything else.
  const pad = PAD * s;
  const width = t.w * s - pad * 2;
  let fontSize = t.size * s;
  const natural = carlitoWidth(t.text, t.bold, fontSize);
  // Excel sets Calibri a touch tighter than Carlito's nominal widths, so
  // text that only just overruns stays on one line there ("Opening Balance"
  // in a 77 pt cell); wrap only when it clearly doesn't fit.
  const wrap = t.wrap && (t.text.includes("\n") || natural > width * 1.06);
  // A single line that would still overrun shrinks rather than wrap (Excel
  // would show ### or cut it off).
  if (!wrap && natural > width) fontSize = Math.max(4, (fontSize * width) / natural);
  const height = t.h * s;
  // Text taller than its row overhangs it evenly, as in Excel.
  const need = fontSize * LINE_BOX;
  const grow = !wrap && need > height ? (need - height) / 2 + 0.5 : 0;
  return (
    <View
      style={{
        position: "absolute",
        left: X(t.x) + pad,
        top: Y(t.y) - grow,
        width,
        height: height + grow * 2,
        justifyContent: VALIGN[t.valign],
      }}
    >
      <Text
        hyphenationCallback={wholeWords}
        style={{
          fontSize,
          fontWeight: t.bold ? "bold" : "normal",
          fontStyle: t.italic ? "italic" : "normal",
          textAlign: t.align,
          lineHeight: wrap ? 1.15 : undefined,
        }}
      >
        {t.text}
      </Text>
    </View>
  );
}

// A signature image in the "Signature:" row, after the label, within the
// signatory's half of the block.
function Signature({ data, col, src, X, Y, s }: { data: FiyesPdfPayload; col: string; src: string | null } & Place) {
  if (!src) return null;
  const { layout, signatureRow, signatureColumns } = data;
  const top = layout.rowY[signatureRow];
  const height = layout.rowH[signatureRow];
  if (top === undefined || height === undefined) return null;

  const label = layout.texts.find((t) => t.y === top && t.x === layout.colX[col]);
  const start = layout.colX[col] + (label ? carlitoWidth(label.text, label.bold, label.size) + PAD * 2 + 4 : 60);
  const otherX = layout.colX[col === signatureColumns.entered ? signatureColumns.approved : signatureColumns.entered];
  const end = otherX > layout.colX[col] ? otherX - 6 : layout.width;
  const width = Math.max(40, Math.min(170, end - start));
  return (
    // eslint-disable-next-line jsx-a11y/alt-text
    <Image
      src={src}
      style={{
        position: "absolute",
        left: X(start),
        top: Y(top + 2),
        width: width * s,
        height: (height - 4) * s,
        objectFit: "contain",
      }}
    />
  );
}
