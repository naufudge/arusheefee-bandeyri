"use client";

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import PdfLetterhead from "@/components/shared/PdfLetterhead";

// Dhivehi (Thaana) fonts — shared with the GSR / petty-cash print views.
Font.register({ family: "Faruma", src: "/fonts/Faruma.ttf" });
Font.register({ family: "MVWaheed", src: "/fonts/MVWaheed.otf" });

const BORDER = "#000000";
const NBSP = " ";
const BAND_BG = "#f3f4f6";

// True when the string contains any Thaana (Dhivehi) codepoint.
const isDhivehi = (s: string) => /[ހ-޿]/.test(s);

// Transactions table column widths (DOM order is left→right; the form reads
// RTL so the rightmost column, Date, is rendered last).
const COL = {
  balance: "10%",
  withdrawn: "18%",
  deposited: "19%",
  details: "28%",
  date: "25%",
};

export interface TreasuryTxn {
  date?: string;
  details?: string;
  deposited?: string | number;
  withdrawn?: string | number;
  balance?: string | number;
}

export interface TreasuryBreakdownRow {
  label: string; // Dhivehi
  value?: string | number;
}

export interface TreasurySignatory {
  role: string; // Dhivehi role label
  name?: string;
  designation?: string;
  // `data:image/...;base64,...` signature, rendered once the signer has
  // approved (gated server-side in the PDF payload).
  signature?: string | null;
}

export interface TreasuryWeeklyData {
  number?: string; // "01/2026"
  periodText?: string; // week period (Dhivehi)
  asOfTitle?: string; // "08.01.2026 ގެ ނިޔަލަށް ހުރި ފައިސާގެ ތަފްޞީލް"
  transactions: TreasuryTxn[];
  breakdown: TreasuryBreakdownRow[];
  cashHeld?: string | number; // ނަގުދު ހުރި
  chequeHeld?: string | number; // ޗެކްތަކުގައި ހުރި
  total?: string | number; // ނަގުދު ފައިސާއާއި ޗެކުން ހުރި ޖުމްލަ
  // Three columns, DOM order (left→right): Authorized, Checked, Prepared.
  signatories: TreasurySignatory[];
  /** Minimum visible rows in the transactions table (pads with blanks). */
  minRows?: number;
  /** Column totals, rendered as a separate table below the transactions. */
  totals?: { balance?: string; withdrawn?: string; deposited?: string };
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 24,
    fontFamily: "Helvetica",
    fontSize: 8.5,
    color: "#000",
  },

  infoWrap: { flexDirection: "row", marginTop: 8 },

  // ----- Generic cell -----
  row: { flexDirection: "row" },
  cell: {
    borderWidth: 0.5,
    borderColor: BORDER,
    paddingVertical: 2,
    paddingHorizontal: 4,
    justifyContent: "center",
  },
  bold: { fontFamily: "Helvetica-Bold" },
  center: { textAlign: "center" },
  right: { textAlign: "right" },
  // `direction: "rtl"` sets the bidi base direction so Dhivehi text mixed
  // with Latin digits (dates, numbers) orders correctly.
  dhivehi: {
    fontFamily: "Faruma",
    fontSize: 9,
    textAlign: "right",
    direction: "rtl",
  },
  dhivehiC: {
    fontFamily: "Faruma",
    fontSize: 9,
    textAlign: "center",
    direction: "rtl",
  },
  faruma: { fontFamily: "Faruma", fontSize: 9, direction: "rtl" },
  band: {
    borderWidth: 0.5,
    borderColor: BORDER,
    backgroundColor: BAND_BG,
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  // Body-cell modifier: drop the top/bottom (horizontal) dividers but keep the
  // left/right (vertical column) dividers. The longhand keys override the
  // `borderWidth` shorthand because @react-pdf/stylesheet resolves them last.
  noHRule: { borderTopWidth: 0, borderBottomWidth: 0 },
  // Wrappers that restore a table's outer outline once its rows no longer draw
  // their own horizontal dividers (left/right outline still comes from cells).
  txnTable: { marginTop: 8, borderBottomWidth: 0.5, borderColor: BORDER },
  boxTable: { borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: BORDER },

  // ----- Title band -----
  titleBand: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 5,
    alignItems: "center",
  },
  titleDhivehi: { fontFamily: "MVWaheed", fontSize: 15, textAlign: "center" },
  period: {
    fontFamily: "Faruma",
    fontSize: 10,
    textAlign: "center",
    marginTop: 3,
    direction: "rtl",
  },

  blockGap: { marginTop: 10 },
  threeCol: { flexDirection: "row", gap: 8, marginTop: 12 },
  colThird: { flex: 1 },
  signSpace: {
    borderWidth: 0.5,
    borderColor: BORDER,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  signatureImg: {
    maxHeight: 38,
    maxWidth: "90%",
    objectFit: "contain",
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyStyle = any;

// Value cell — auto-detects Dhivehi text (→ Faruma) and applies an alignment.
const Cell: React.FC<{
  width: string | number;
  children?: React.ReactNode;
  minHeight?: number;
  align?: "left" | "center" | "right";
  style?: AnyStyle;
}> = ({ width, children, minHeight = 16, align = "left", style }) => {
  const dv = typeof children === "string" && isDhivehi(children);
  const alignStyle =
    align === "center" ? styles.center : align === "right" ? styles.right : null;
  return (
    <View style={[styles.cell, { width, minHeight }, style] as AnyStyle}>
      {typeof children === "string" || typeof children === "number" ? (
        <Text style={[dv ? styles.faruma : null, alignStyle] as AnyStyle}>
          {children === "" ? NBSP : children}
        </Text>
      ) : (
        (children ?? <Text>{NBSP}</Text>)
      )}
    </View>
  );
};

// Right-aligned Dhivehi label cell.
const DvLabel: React.FC<{
  width: string | number;
  text: string;
  style?: AnyStyle;
}> = ({ width, text, style }) => (
  <View style={[styles.cell, { width }, style] as AnyStyle}>
    <Text style={styles.dhivehi}>{text}</Text>
  </View>
);

// Centered, band-shaded Dhivehi table header cell.
const THead: React.FC<{ width: string | number; text: string }> = ({
  width,
  text,
}) => (
  <View
    style={
      [styles.cell, styles.center, { width, backgroundColor: BAND_BG }] as AnyStyle
    }
  >
    <Text style={styles.dhivehiC}>{text}</Text>
  </View>
);

const TreasuryWeeklyPdf: React.FC<{ data: TreasuryWeeklyData }> = ({ data }) => {
  const minRows = data.minRows ?? 8;
  const blanks = Math.max(0, minRows - data.transactions.length);
  const rows: TreasuryTxn[] = [
    ...data.transactions,
    ...Array.from({ length: blanks }, () => ({}) as TreasuryTxn),
  ];

  return (
    <Document
      title="Weekly Treasury / Safe Cash Statement"
      author="National Archives of Maldives"
    >
      <Page size="A4" style={styles.page}>
        {/* ---------- Letterhead ---------- */}
        <PdfLetterhead />

        {/* ---------- Number ---------- */}
        <View style={styles.infoWrap}>
          <View style={{ width: "55%" }} />
          <View style={{ width: "45%" }}>
            <View style={styles.row}>
              <Cell width="55%" align="center">
                {data.number}
              </Cell>
              <DvLabel width="45%" text="ނަންބަރު" />
            </View>
          </View>
        </View>

        {/* ---------- Title band ---------- */}
        <View style={styles.titleBand}>
          <Text style={styles.titleDhivehi}>
            ތިޖޫރީގައި ހުރި ފައިސާގެ ހަފްތާގެ ހިސާބް
          </Text>
          {data.periodText ? (
            <Text style={styles.period}>{data.periodText}</Text>
          ) : null}
        </View>

        {/* ---------- Transactions table ---------- */}
        <View style={styles.txnTable}>
          {/* Header (RTL: Date right → Balance left) */}
          <View style={styles.row}>
            <THead width={COL.balance} text="ބާކީ" />
            <THead width={COL.withdrawn} text="ނެގި" />
            <THead width={COL.deposited} text="ބެހެއްޓި" />
            <THead width={COL.details} text="ތަފްޞީލް" />
            <THead width={COL.date} text="ތާރީޚް" />
          </View>
          {rows.map((t, i) => (
            <View style={styles.row} key={i}>
              <Cell width={COL.balance} align="center" minHeight={15} style={styles.noHRule}>
                {t.balance ?? NBSP}
              </Cell>
              <Cell width={COL.withdrawn} align="center" minHeight={15} style={styles.noHRule}>
                {t.withdrawn ?? NBSP}
              </Cell>
              <Cell width={COL.deposited} align="center" minHeight={15} style={styles.noHRule}>
                {t.deposited ?? NBSP}
              </Cell>
              <Cell width={COL.details} align="right" minHeight={15} style={styles.noHRule}>
                {t.details ?? NBSP}
              </Cell>
              <Cell width={COL.date} align="center" minHeight={15} style={styles.noHRule}>
                {t.date ?? NBSP}
              </Cell>
            </View>
          ))}
          {/* Column totals — the last row of the table. */}
          {data.totals ? (
            <View style={styles.row}>
              <Cell width={COL.balance} align="center" style={[styles.bold, styles.noHRule]}>
                {data.totals.balance ?? NBSP}
              </Cell>
              <Cell width={COL.withdrawn} align="center" style={[styles.bold, styles.noHRule]}>
                {data.totals.withdrawn ?? NBSP}
              </Cell>
              <Cell width={COL.deposited} align="center" style={[styles.bold, styles.noHRule]}>
                {data.totals.deposited ?? NBSP}
              </Cell>
              {/* Details + date kept as two plain cells (no band) so the
                  ތާރީޚް/ތަފްޞީލް divider runs to the bottom of the table. */}
              <Cell width={COL.details} align="right" style={styles.noHRule}>
                {NBSP}
              </Cell>
              <Cell width={COL.date} align="center" style={styles.noHRule}>
                {NBSP}
              </Cell>
            </View>
          ) : null}
        </View>

        {/* ---------- Cash-held breakdown ---------- */}
        {/* Value column matches the transactions table's ބާކީ width so the
            figures line up with the balance column above. */}
        <View style={[styles.blockGap, styles.boxTable]}>
          {data.asOfTitle ? (
            <View style={styles.row}>
              <DvLabel width="100%" text={data.asOfTitle} style={styles.band} />
            </View>
          ) : null}
          {data.breakdown.map((b, i) => (
            <View style={styles.row} key={i}>
              <Cell width={COL.balance} align="center" style={styles.noHRule}>
                {b.value ?? NBSP}
              </Cell>
              <DvLabel width="90%" text={b.label} style={styles.noHRule} />
            </View>
          ))}
        </View>

        {/* ---------- Cash / cheque split (separate table) ---------- */}
        {/* Value column matches the breakdown above (= ބާކީ width) so every
            figure column lines up down the left edge. */}
        <View style={[styles.blockGap, styles.boxTable]}>
          <View style={styles.row}>
            <Cell width={COL.balance} align="center" style={styles.noHRule}>
              {data.cashHeld ?? NBSP}
            </Cell>
            <DvLabel width="90%" text="ނަގުދު ހުރި" style={styles.noHRule} />
          </View>
          <View style={styles.row}>
            <Cell width={COL.balance} align="center" style={styles.noHRule}>
              {data.chequeHeld ?? NBSP}
            </Cell>
            <DvLabel width="90%" text="ޗެކްތަކުގައި ހުރި" style={styles.noHRule} />
          </View>
          <View style={styles.row}>
            <Cell width={COL.balance} align="center" style={[styles.bold, styles.noHRule]}>
              {data.total ?? NBSP}
            </Cell>
            <DvLabel
              width="90%"
              text="ނަގުދު ފައިސާއާއި ޗެކުން ހުރި ޖުމްލަ"
              style={styles.noHRule}
            />
          </View>
        </View>

        {/* ---------- Signatures (3 columns) ---------- */}
        <View style={styles.threeCol}>
          {data.signatories.map((s, i) => (
            <View style={styles.colThird} key={i}>
              <View style={styles.row}>
                <DvLabel width="100%" text={s.role} style={styles.band} />
              </View>
              <View style={styles.signSpace}>
                {s.signature ? (
                  // react-pdf <Image> doesn't take `alt` (it's PDF, not HTML).
                  // eslint-disable-next-line jsx-a11y/alt-text
                  <Image src={s.signature} style={styles.signatureImg} />
                ) : null}
              </View>
              <Cell width="100%" align="center">
                {s.name ?? NBSP}
              </Cell>
              <Cell width="100%" align="center">
                {s.designation ?? NBSP}
              </Cell>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
};

export default TreasuryWeeklyPdf;
