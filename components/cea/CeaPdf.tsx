"use client";

import React from "react";
import { Document, Page, Text, View, Image, Font } from "@react-pdf/renderer";

// The "capital items not in the PSIP" approval form, laid out as the office's
// Excel sheet prints it (Downloads/4.Capital Hudha.pdf, A4 landscape). Every
// position was measured from that print. Thaana is Faruma, the sheet's font
// (that print fell back to MV Boli); Latin values print in Courier, as there.

Font.register({ family: "Faruma", src: "/fonts/Faruma.ttf" });

const DV = "Faruma";
const LATIN = "Courier";
const LINE = 0.96;

// Column edges A…I and the right edge of I, in pt.
const X = [29.28, 99.38, 232.34, 371.81, 441.91, 476.59, 513.67, 665.98, 752.98, 811.8];
const [A, B, , D, , , G, H, I, END] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const w = (c1: number, c2: number) => X[c2] - X[c1];

const ROW = 14.52; // a standard printed row
const TABLE_TOP = 195.41;
const ITEM_ROW = 72.62;
const PAGE_MARGIN = 28; // top and bottom, for pages a long table runs onto

const isThaana = (s: string) => /[ހ-޿]/.test(s);
const money = (n: number | null) =>
  n == null ? "" : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qtyText = (n: number | null) =>
  n == null ? "" : Number.isInteger(n) ? String(n) : n.toLocaleString("en-US", { maximumFractionDigits: 2 });

// Courier is 0.6 em per character, so a number can shrink to fit its cell
// instead of printing "#########".
const courierSize = (text: string, room: number, size = 11) =>
  Math.min(size, room / (Math.max(text.length, 1) * 0.6));

export interface CeaPdfData {
  ceaNum: string;
  date: string;
  businessArea: string;
  section: string;
  glCode: number | null;
  budgetBalance: number | null;
  rows: {
    description: string | null;
    qty: number | null;
    cost: number | null;
    onHand: string | null;
    acquired: string | null;
    condition: string | null;
    reason: string | null;
  }[];
  feNameDv: string;
  feDesignationDv: string;
  creatorNameDv: string;
  creatorDesignationDv: string;
  /** `data:` URLs, present once the requester has signed. */
  signature: string | null;
  stamp: string | null;
}

// Text placed by its baseline. `edge` is the right edge (align "right"), the
// left edge (align "left") or the centre (align "center").
function Put({
  children = "",
  baseline,
  edge,
  align = "right",
  size = 11,
  latin = false,
  bold = false,
  width = 400,
}: {
  children?: string;
  baseline: number;
  edge: number;
  align?: "left" | "right" | "center";
  size?: number;
  latin?: boolean;
  bold?: boolean;
  width?: number;
}) {
  // Where the baseline sits below the box top, as a share of the size.
  const ascent = latin ? 0.915 : 0.928;
  const left = align === "right" ? edge - width : align === "center" ? edge - width / 2 : edge;
  const style = {
    fontFamily: latin ? LATIN : DV,
    fontSize: size,
    textAlign: align,
    direction: latin ? ("ltr" as const) : ("rtl" as const),
  };
  const box = { position: "absolute" as const, top: baseline - ascent * size, width };
  const draw = (dx: number) => <Text style={[box, style, { left: left + dx }]}>{children}</Text>;
  return (
    <>
      {draw(0)}
      {/* Excel's bold for Faruma is a faux bold: the glyphs drawn twice. */}
      {bold && draw(-0.35)}
    </>
  );
}

const line = (left: number, top: number, width: number, height: number) => (
  <View style={{ position: "absolute", left, top, width, height, backgroundColor: "#000" }} />
);

// Thaana in a table cell: centred, lines 12.84 pt apart as in the print. The
// bottom padding lifts it to where Excel centred it.
const dvBlock = {
  fontFamily: DV,
  fontSize: 11,
  textAlign: "center" as const,
  direction: "rtl" as const,
  lineHeight: 1.167,
  paddingBottom: 1.7,
};

// A cell's text, centred both ways, wrapping like Excel's wrap-text cells.
function Cell({ text, width, money: isMoney = false }: { text: string | null; width: number; money?: boolean }) {
  const t = text ?? "";
  if (!t) return null;
  if (isThaana(t)) return <Text style={[dvBlock, { paddingLeft: 2.96, paddingRight: 2 }]}>{t}</Text>;
  // Centre on the column, not the box left of its right border; amounts sit a
  // little right, as Excel's accounting format pads them.
  const padLeft = isMoney ? 5.5 : 2.96;
  const numeric = /^[\d.,\s-]+$/.test(t);
  return (
    <Text
      style={{
        fontFamily: LATIN,
        // Numbers shrink to one line; other Latin text wraps.
        fontSize: numeric ? courierSize(t, width - LINE - padLeft - 3) : 11,
        textAlign: "center",
        lineHeight: 1,
        paddingLeft: padLeft,
        paddingRight: 2,
        // Courier sits low in its line box; lift it to where Excel puts it.
        marginBottom: 2.94,
      }}
    >
      {t}
    </Text>
  );
}

// Each cell includes its right border, so a width of one column puts that
// border on the column edge.
const cellBox = (width: number) => ({
  width,
  justifyContent: "center" as const,
  borderRightWidth: LINE,
  borderColor: "#000",
});
const lastCell = { flex: 1, justifyContent: "center" as const };

const HEADERS = [
  // [column, label] for A…G, left to right.
  [A, "ހިގާނެ ޚަރަދު"],
  [B, "އިތުރަށް ބޭނުންވާ ސަބަބު"],
  [2, "މިހާރު ހުރި ތަކެތީގެ ހާލަތު"],
  [3, "ހޯދުނު ތާރީޚު"],
  [4, "މިހާރު ހުރި ޢަދަދު"],
  [5, "ޢަދަދު"],
  [G, "ބާވަތް"],
] as const;

export default function CeaPdf({ data }: { data: CeaPdfData }) {
  const rows = data.rows.length ? data.rows : [{ description: null, qty: null, cost: null, onHand: null, acquired: null, condition: null, reason: null }];
  // The printed row is 72.62 pt; up to three fit one page, so more get
  // compact rows that grow only as their text needs.
  const rowHeight = rows.length <= 3 ? ITEM_ROW : 2 * ROW;
  const blockLabel = (t: string, base: number, edge: number, align: "right" | "center", underline: [number, number]) => (
    <>
      <Put baseline={base} edge={edge} align={align}>{t}</Put>
      {line(underline[0], 10.44, underline[1] - underline[0], 0.48)}
    </>
  );
  // Baseline of sign-off line k (0 = the block's label row); the left and
  // middle blocks print a little higher than the right one.
  const sbL = (k: number) => 9.25 + k * ROW;
  const sbR = (k: number) => 9.73 + k * ROW;

  return (
    <Document title={`CEA ${data.ceaNum}`} author="National Archives of Maldives">
      <Page size="A4" orientation="landscape" style={{ paddingVertical: PAGE_MARGIN, backgroundColor: "#fff" }}>
        {/* Header: logo, emblem, institution lines, number and date */}
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src="/full-logo.png" style={{ position: "absolute", left: 32.73, top: 27.05, height: 62.41, objectFit: "contain" }} />
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src="/emblem.png" style={{ position: "absolute", left: 398.78, top: 27.05, width: 43.11, height: 39.8, objectFit: "contain" }} />
        <Put baseline={60.38} edge={809.4} size={12} bold>ދިވެހިރާއްޖޭގެ ޤައުމީ އަރުޝީފު</Put>
        <Put baseline={75.63} edge={763.2} bold>މާލެ،</Put>
        <Put baseline={90.87} edge={776.4} bold>ދިވެހިރާއްޖެ.</Put>

        <Put baseline={105.19} edge={230.2} latin>{data.ceaNum}</Put>
        <Put baseline={105.5} edge={241.12} align="left" width={60}>ނަމްބަރ:</Put>
        <Put baseline={119.71} edge={230.2} latin>{data.date}</Put>
        <Put baseline={120.03} edge={239.68} align="left" width={60}>ތާރީޚް:</Put>

        <Put baseline={153.27} edge={420.8} align="center" size={16} width={700} bold>
          ޕީ. އެސް. އައި. ޕީ. ގައި ނުހިމެނޭ ކެޕިޓަލް ތަކެތި ހޯދުމުގެ ހުއްދައަށް އެދޭ ފޯމު
        </Put>

        {/* Business area and section bar */}
        {line(X[A] - LINE / 2, 170.06 - LINE / 2, w(A, END) + LINE, LINE)}
        {line(X[A] - LINE / 2, 184.6 - LINE / 2, w(A, END) + LINE, LINE)}
        {line(X[A] - LINE / 2, 170.06 - LINE / 2, LINE, 184.6 - 170.06 + LINE)}
        {line(X[END] - LINE / 2, 170.06 - LINE / 2, LINE, 184.6 - 170.06 + LINE)}
        <Put baseline={180.27} edge={810.4}>ޑިޕާރޓްމެންޓް / ސެކްޝަން:</Put>
        <Put baseline={180.27} edge={663.5} width={330}>{data.section}</Put>
        <Put baseline={180.27} edge={229.7} width={70}>ބިޒްނަސް އޭރިއާ:</Put>
        <Put baseline={180.42} edge={148.7} latin width={60}>{data.businessArea}</Put>

        {/* Table and sign-off: in the flow, so many rows continue on a new page */}
        <View
          style={{
            marginLeft: X[A] - LINE / 2,
            marginTop: TABLE_TOP - LINE / 2 - PAGE_MARGIN,
            width: w(A, END) + LINE,
            borderWidth: LINE,
            borderColor: "#000",
          }}
        >
          {/* Header */}
          <View style={{ flexDirection: "row" }}>
            <View style={{ width: w(A, H), borderRightWidth: LINE, borderColor: "#000" }}>
              <View style={{ height: 209.93 - TABLE_TOP, borderBottomWidth: LINE, borderColor: "#000", justifyContent: "center" }}>
                <Text style={[dvBlock, { paddingBottom: 0.26 }]}>ހޯދަން ބޭނުންވާ ތަކެތީގެ</Text>
              </View>
              <View style={{ flexDirection: "row", height: 253.49 - 209.93 - LINE }}>
                {HEADERS.map(([col, label], i) => (
                  <View key={label} style={i === HEADERS.length - 1 ? lastCell : cellBox(w(col, col + 1))}>
                    <Text style={[dvBlock, { paddingHorizontal: 2 }]}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={{ width: w(H, I), borderRightWidth: LINE, borderColor: "#000", justifyContent: "center" }}>
              <Text style={[dvBlock, { paddingBottom: 2.78 }]}>ބަޖެޓް ކޯޑުގެ ބާކީ</Text>
            </View>
            <View style={{ flex: 1, justifyContent: "center" }}>
              <Text style={[dvBlock, { paddingBottom: 2.78 }]}>ބަޖެޓް ކޯޑް</Text>
            </View>
          </View>

          {/* Item rows; budget balance and code span them all */}
          <View style={{ flexDirection: "row", borderTopWidth: LINE, borderColor: "#000" }}>
            <View style={{ width: w(A, H), borderRightWidth: LINE, borderColor: "#000" }}>
              {rows.map((r, i) => (
                <View
                  key={i}
                  wrap={false}
                  style={{
                    flexDirection: "row",
                    minHeight: rowHeight - LINE,
                    borderTopWidth: i === 0 ? 0 : LINE,
                    borderColor: "#000",
                  }}
                >
                  <View style={cellBox(w(A, B))}><Cell text={money(r.cost)} width={w(A, B)} money /></View>
                  <View style={cellBox(w(B, 2))}><Cell text={r.reason} width={w(B, 2)} /></View>
                  <View style={cellBox(w(2, D))}><Cell text={r.condition} width={w(2, D)} /></View>
                  <View style={cellBox(w(D, 4))}><Cell text={r.acquired} width={w(D, 4)} /></View>
                  <View style={cellBox(w(4, 5))}><Cell text={r.onHand} width={w(4, 5)} /></View>
                  <View style={cellBox(w(5, G))}><Cell text={qtyText(r.qty)} width={w(5, G)} /></View>
                  <View style={lastCell}><Cell text={r.description} width={w(G, H)} /></View>
                </View>
              ))}
            </View>
            <View style={{ width: w(H, I), borderRightWidth: LINE, borderColor: "#000", justifyContent: "center" }}>
              <Cell text={money(data.budgetBalance)} width={w(H, I)} money />
            </View>
            <View style={{ flex: 1, justifyContent: "center" }}>
              <Cell text={data.glCode != null ? String(data.glCode) : ""} width={w(I, END)} />
            </View>
          </View>

          {/* Sign-off: FE (left), office stamp (middle), requester (right) */}
          <View wrap={false} style={{ flexDirection: "row", height: 6 * ROW, borderTopWidth: LINE, borderColor: "#000" }}>
            {/* Positions inside each block are relative to the block. */}
            <View style={{ width: w(A, D), borderRightWidth: LINE, borderColor: "#000", position: "relative" }}>
              {blockLabel("ހުއްދަ ދެއްވި މާލީ ޒިންމާދާރު ވެރިޔާގެ:", sbL(0), 339.92, "right", [198.98, 339.88])}
              <Put baseline={sbL(2)} edge={339.92}>ސޮއި:</Put>
              <Put baseline={sbL(3)} edge={339.92}>{`ނަން: ${data.feNameDv}`}</Put>
              <Put baseline={sbL(4)} edge={339.92}>{`މަޤާމު: ${data.feDesignationDv}`}</Put>
              <Put baseline={sbL(5)} edge={339.92}>ތާރީޚު:</Put>
            </View>
            <View style={{ width: w(D, G), borderRightWidth: LINE, borderColor: "#000", position: "relative" }}>
              {blockLabel("އޮފީހުގެ ތައްގަނޑު", sbL(0), 70.81, "center", [39.48, 102.38])}
              {data.stamp && (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image src={data.stamp} style={{ position: "absolute", left: 4, top: 15, width: w(D, G) - 8, height: 6 * ROW - 19, objectFit: "contain" }} />
              )}
            </View>
            <View style={{ flex: 1, position: "relative" }}>
              {blockLabel("ހުއްދައަށް އެދި ހުށަހެޅި:", sbR(0), 295.25, "right", [202.83, 295.49])}
              <Put baseline={sbR(2)} edge={295.25}>ސޮއި:</Put>
              <Put baseline={sbR(3)} edge={295.25}>ނަން:</Put>
              <Put baseline={sbR(4)} edge={295.25}>މަޤާމު:</Put>
              <Put baseline={sbR(5)} edge={295.25}>ތާރީޚު:</Put>
              {data.signature && (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image src={data.signature} style={{ position: "absolute", left: 100, top: 13, width: 136, height: 31, objectFit: "contain" }} />
              )}
              <Put baseline={sbR(3)} edge={236.45} width={230}>{data.creatorNameDv}</Put>
              <Put baseline={sbR(4)} edge={236.45} width={230}>{data.creatorDesignationDv}</Put>
              <Put baseline={sbR(5) + 0.16} edge={236.69} latin width={120}>{data.date}</Put>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
