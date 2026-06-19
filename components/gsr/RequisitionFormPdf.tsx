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

// Dhivehi (Thaana) fonts — shared with the PV / petty-cash print views.
Font.register({ family: "Faruma", src: "/fonts/Faruma.ttf" });
Font.register({ family: "MVWaheed", src: "/fonts/MVWaheed.otf" });

const BORDER = "#000000";
const NBSP = " ";

// Column widths (% of table) — derived from the source .docx grid so the
// proportions match the original 1:1. The two tables share column edges.
const COL = {
  remarks: "24%",
  rqdDate: "13%",
  particulars: "39%",
  issued: "12%",
  requested: "12%",
};
const SIG = {
  date: "20%",
  signature: "13%",
  name: "35%",
  functions: "32%",
};

export interface RequisitionItem {
  remarks?: string; // Dhivehi remarks
  rqdDate?: string; // "DD.MM.YYYY"
  particulars?: string;
  issued?: string | number;
  requested?: string | number;
}

export interface RequisitionApproval {
  date?: string;
  name?: string;
  designation?: string;
  // `data:image/...;base64,...` signature, rendered only once the role's
  // approval stage is complete (gated server-side in the PDF payload).
  signature?: string | null;
  roleDv: string; // Dhivehi role label, e.g. "އެދުނު"
  roleEn: string; // English role label, e.g. "Requested By"
}

export interface RequisitionData {
  section?: string; // Dhivehi section value
  number?: string; // reference number
  date?: string; // "DD.MM.YYYY"
  items: RequisitionItem[];
  approvals: RequisitionApproval[];
  /** Total visible body rows in the items table (pads with blank rows). */
  minItemRows?: number;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 22,
    fontFamily: "Helvetica",
    fontSize: 8.5,
    color: "#000",
  },

  // ----- Generic table cell -----
  row: { flexDirection: "row" },
  cell: {
    borderWidth: 0.5,
    borderColor: BORDER,
    paddingVertical: 3,
    paddingHorizontal: 4,
    justifyContent: "center",
  },
  bold: { fontFamily: "Helvetica-Bold" },
  center: { textAlign: "center" },
  right: { textAlign: "right" },
  dhivehi: { fontFamily: "Faruma", fontSize: 9, textAlign: "right" },
  dhivehiC: { fontFamily: "Faruma", fontSize: 9, textAlign: "center" },

  // ----- Info box (Section / Number / Date) -----
  infoWrap: { flexDirection: "row", marginTop: 10 },

  // ----- Title band -----
  titleBand: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 5,
    alignItems: "center",
  },
  titleDhivehi: { fontFamily: "MVWaheed", fontSize: 16, textAlign: "center" },
  titleEnglish: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    letterSpacing: 1,
    marginTop: 2,
    textAlign: "center",
  },
  signatureImg: {
    maxHeight: 28,
    maxWidth: "100%",
    objectFit: "contain",
    alignSelf: "center",
  },
});

// Bilingual header cell — Dhivehi (Faruma) stacked above English.
const HeaderCell: React.FC<{
  width: string | number;
  dhivehi: string;
  english: string;
  style?: object;
}> = ({ width, dhivehi, english, style }) => (
  <View
    style={
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      [styles.cell, styles.center, { width }, style] as any
    }
  >
    <Text style={styles.dhivehiC}>{dhivehi}</Text>
    <Text style={[styles.bold, { fontSize: 8, marginTop: 1 }]}>{english}</Text>
  </View>
);

const RequisitionFormPdf: React.FC<{ data: RequisitionData }> = ({ data }) => {
  const minRows = data.minItemRows ?? 7;
  const blankRows = Math.max(0, minRows - data.items.length);

  return (
    <Document
      title="Goods / Service Requisition Form"
      author="National Archives of Maldives"
    >
      <Page size="A4" style={styles.page}>
        {/* ---------- Letterhead ---------- */}
        <PdfLetterhead />

        {/* ---------- Info box: Section / Number / Date ---------- */}
        <View style={styles.infoWrap}>
          <View style={{ width: "58%" }}>
            {(
              [
                {
                  dv: "ސެކްޝަން",
                  en: "Section",
                  val: data.section ?? "",
                  dvVal: true,
                },
                { dv: "ނަންބަރު", en: "Number", val: data.number ?? "" },
                { dv: "ތާރީޚު", en: "Date", val: data.date ?? "" },
              ] as const
            ).map((r, i) => (
              <View key={i} style={styles.row}>
                <View style={[styles.cell, { width: "42%" }]}>
                  <Text style={[styles.bold, { fontSize: 8 }]}>
                    {r.en} / <Text style={styles.dhivehi}>{r.dv}</Text>
                  </Text>
                </View>
                <View style={[styles.cell, { width: "58%" }]}>
                  {"dvVal" in r && r.dvVal ? (
                    <Text style={styles.dhivehi}>{r.val || NBSP}</Text>
                  ) : (
                    <Text style={styles.right}>{r.val || NBSP}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
          <View style={{ width: "42%" }} />
        </View>

        {/* ---------- Title band ---------- */}
        <View style={styles.titleBand}>
          <Text style={styles.titleDhivehi}>
            މުދާ / ޚިދުމަތް ލިބިގަތުމަށް އެދޭ ފޯމް
          </Text>
          <Text style={styles.titleEnglish}>
            GOODS / SERVICE REQUISITION FORM
          </Text>
        </View>

        {/* ---------- Items table ---------- */}
        <View style={{ marginTop: 8 }}>
          {/* Header rows (Quantity spans Issued + Requested) */}
          <View style={styles.row}>
            <HeaderCell
              width={COL.remarks}
              dhivehi="އިތުރު ބަޔާން"
              english="Remarks"
            />
            <HeaderCell
              width={COL.rqdDate}
              dhivehi="ލިބެންވީ ތާރީޚު"
              english="Rqd. Date"
            />
            <HeaderCell
              width={COL.particulars}
              dhivehi="ތަފްޞީލު"
              english="Particulars"
            />
            {/* Quantity group */}
            <View style={{ width: "24%" }}>
              <View
                style={[styles.cell, styles.center, { paddingVertical: 2 }]}
              >
                <Text style={styles.dhivehiC}>އަދަދު</Text>
                <Text style={[styles.bold, { fontSize: 8 }]}>Quantity</Text>
              </View>
              <View style={styles.row}>
                <HeaderCell
                  width="50%"
                  dhivehi="ދޫކުރި"
                  english="Issued"
                />
                <HeaderCell
                  width="50%"
                  dhivehi="އެދުނު"
                  english="Requested"
                />
              </View>
            </View>
          </View>

          {/* Data rows */}
          {data.items.map((item, i) => (
            <View style={styles.row} key={`item-${i}`}>
              <View style={[styles.cell, { width: COL.remarks, minHeight: 24 }]}>
                <Text style={styles.dhivehi}>{item.remarks || NBSP}</Text>
              </View>
              <View
                style={[
                  styles.cell,
                  styles.center,
                  { width: COL.rqdDate, minHeight: 24 },
                ]}
              >
                <Text>{item.rqdDate || NBSP}</Text>
              </View>
              <View
                style={[
                  styles.cell,
                  styles.center,
                  { width: COL.particulars, minHeight: 24 },
                ]}
              >
                <Text>{item.particulars || NBSP}</Text>
              </View>
              <View
                style={[
                  styles.cell,
                  styles.center,
                  { width: COL.issued, minHeight: 24 },
                ]}
              >
                <Text>{item.issued ?? NBSP}</Text>
              </View>
              <View
                style={[
                  styles.cell,
                  styles.center,
                  { width: COL.requested, minHeight: 24 },
                ]}
              >
                <Text>{item.requested ?? NBSP}</Text>
              </View>
            </View>
          ))}

          {/* Blank padding rows */}
          {Array.from({ length: blankRows }).map((_, i) => (
            <View style={styles.row} key={`blank-${i}`}>
              <View style={[styles.cell, { width: COL.remarks, minHeight: 24 }]}>
                <Text>{NBSP}</Text>
              </View>
              <View style={[styles.cell, { width: COL.rqdDate, minHeight: 24 }]}>
                <Text>{NBSP}</Text>
              </View>
              <View
                style={[styles.cell, { width: COL.particulars, minHeight: 24 }]}
              >
                <Text>{NBSP}</Text>
              </View>
              <View style={[styles.cell, { width: COL.issued, minHeight: 24 }]}>
                <Text>{NBSP}</Text>
              </View>
              <View
                style={[styles.cell, { width: COL.requested, minHeight: 24 }]}
              >
                <Text>{NBSP}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ---------- Approvals / signatures table ---------- */}
        <View style={{ marginTop: 12 }}>
          {/* Header */}
          <View style={styles.row}>
            <HeaderCell width={SIG.date} dhivehi="ތާރީޚު" english="Date" />
            <HeaderCell
              width={SIG.signature}
              dhivehi="ސޮއި"
              english="Signature"
            />
            <HeaderCell
              width={SIG.name}
              dhivehi="ނަން/މަޤާމް"
              english="Name / Designation"
            />
            <HeaderCell
              width={SIG.functions}
              dhivehi="ކުރަންވީ ކަންތައް"
              english="Functions"
            />
          </View>

          {/* Approval rows */}
          {data.approvals.map((a, i) => (
            <View style={styles.row} key={`appr-${i}`}>
              <View
                style={[
                  styles.cell,
                  styles.center,
                  { width: SIG.date, minHeight: 34 },
                ]}
              >
                <Text>{a.date || NBSP}</Text>
              </View>
              <View
                style={[styles.cell, { width: SIG.signature, minHeight: 34 }]}
              >
                {a.signature ? (
                  // react-pdf <Image> doesn't take `alt` (it's PDF, not HTML).
                  // eslint-disable-next-line jsx-a11y/alt-text
                  <Image src={a.signature} style={styles.signatureImg} />
                ) : (
                  <Text>{NBSP}</Text>
                )}
              </View>
              <View
                style={[
                  styles.cell,
                  styles.center,
                  { width: SIG.name, minHeight: 34 },
                ]}
              >
                <Text>{a.name || NBSP}</Text>
                {a.designation ? (
                  <Text style={{ fontSize: 7.5, marginTop: 1, color: "#333" }}>
                    {a.designation}
                  </Text>
                ) : null}
              </View>
              <View
                style={[styles.cell, { width: SIG.functions, minHeight: 34 }]}
              >
                <Text style={[styles.bold, styles.right, { fontSize: 8 }]}>
                  {a.roleEn} / <Text style={styles.dhivehi}>{a.roleDv}</Text>
                </Text>
              </View>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
};

export default RequisitionFormPdf;
