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
import { formatNumberWithCommas } from "@/utils/helpers";

// Dhivehi (Thaana) fonts — shared with the GSR / PV print views.
Font.register({ family: "Faruma", src: "/fonts/Faruma.ttf" });
Font.register({ family: "MVWaheed", src: "/fonts/MVWaheed.otf" });

export interface PettyCashPrintData {
  pettyCashNum: string;
  date: Date | null;
  formNum: string;
  sectionUnit: string;
  totalRequiredAmount: number;
  glCode: number;
  parkedDate: Date | null;
  postingDate: Date | null;
  /** Imported record approved by the system — render a stamp, not signatories. */
  systemApproved?: boolean;
  items: { qty: number; name: string }[];
  roles: {
    label: string;
    name: string;
    designation: string;
    amount: number | null;
    isApproved: boolean;
    date: Date | null;
    /** `data:` URL when this role has been approved and the staff
     *  member has a signature on file; null otherwise. */
    signature?: string | null;
  }[];
}

const BORDER = "#000000";
const NBSP = " ";
const BAND_BG = "#f3f4f6";

// True when the string contains any Thaana (Dhivehi) codepoint — such values
// render in Faruma (RTL) instead of Helvetica.
const isDhivehi = (s: string) => /[ހ-޿]/.test(s);

const formatDate = (date?: Date | null) => {
  if (!date) return "";
  try {
    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "";
  }
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 24,
    fontFamily: "Helvetica",
    fontSize: 8.5,
    color: "#000",
  },

  // ----- Letterhead -----
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 8,
  },
  headerLogo: { height: 46, objectFit: "contain" },
  headerCenter: { flex: 1, alignItems: "center", paddingHorizontal: 8 },
  orgDhivehi: { fontFamily: "MVWaheed", fontSize: 16, textAlign: "center" },
  orgEnglish: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    letterSpacing: 1.3,
    marginTop: 3,
    textAlign: "center",
  },
  rule: { borderBottomWidth: 1.5, borderColor: BORDER },

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
  dhivehi: { fontFamily: "Faruma", fontSize: 9, textAlign: "right" },
  dhivehiC: { fontFamily: "Faruma", fontSize: 9, textAlign: "center" },
  enSub: { fontFamily: "Helvetica-Bold", fontSize: 6.5, marginTop: 0.5 },

  // ----- Info box -----
  infoWrap: { flexDirection: "row", marginTop: 7 },

  // ----- Title band -----
  titleBand: {
    marginTop: 7,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 4,
    alignItems: "center",
  },
  titleDhivehi: { fontFamily: "MVWaheed", fontSize: 15, textAlign: "center" },
  titleEnglish: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    letterSpacing: 0.8,
    marginTop: 2,
    textAlign: "center",
  },

  band: {
    borderWidth: 0.5,
    borderColor: BORDER,
    backgroundColor: BAND_BG,
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  blockGap: { marginTop: 7 },
  twoCol: { flexDirection: "row", gap: 8, marginTop: 7 },
  colHalf: { flex: 1 },
  signatureImg: {
    maxHeight: 28,
    maxWidth: "100%",
    objectFit: "contain",
    alignSelf: "center",
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyStyle = any;

// Bilingual label cell — Dhivehi (right-aligned) over a small English
// sub-label. Sits on the RIGHT of its value (the reference is RTL: label
// right, value left).
const BiLabel: React.FC<{
  width: string | number;
  dv: string;
  en: string;
  style?: AnyStyle;
}> = ({ width, dv, en, style }) => (
  <View style={[styles.cell, { width }, style] as AnyStyle}>
    <Text style={styles.dhivehi}>{dv.replace(/\s*:\s*$/, "")}</Text>
    <Text style={[styles.enSub, styles.right]}>{en}</Text>
  </View>
);

// Bilingual header cell (Dhivehi over English) for the items table head,
// shaded with the light-gray band colour. `align` switches between centered
// (Quantity) and right-aligned (Details).
const BiHeader: React.FC<{
  width: string | number;
  dv: string;
  en: string;
  align?: "center" | "right";
}> = ({ width, dv, en, align = "center" }) => {
  const right = align === "right";
  return (
    <View
      style={
        [
          styles.cell,
          right ? styles.right : styles.center,
          { width, backgroundColor: BAND_BG },
        ] as AnyStyle
      }
    >
      <Text style={right ? styles.dhivehi : styles.dhivehiC}>{dv}</Text>
      <Text
        style={[
          styles.bold,
          right ? styles.right : styles.center,
          { fontSize: 7.5, marginTop: 1 },
        ]}
      >
        {en}
      </Text>
    </View>
  );
};

// Value cell. `dhivehi` renders the value in Faruma (RTL) for fields that
// are typically written in Dhivehi (e.g. the section/unit name).
const Val: React.FC<{
  width: string | number;
  children?: React.ReactNode;
  minHeight?: number;
  dhivehi?: boolean;
  style?: AnyStyle;
}> = ({ width, children, minHeight = 16, dhivehi, style }) => {
  // Auto-detect Dhivehi text and render it in Faruma (RTL).
  const useDhivehi =
    dhivehi || (typeof children === "string" && isDhivehi(children));
  return (
    <View style={[styles.cell, { width, minHeight }, style] as AnyStyle}>
      {typeof children === "string" || typeof children === "number" ? (
        <Text style={useDhivehi ? styles.dhivehi : undefined}>
          {children === "" ? NBSP : children}
        </Text>
      ) : (
        (children ?? <Text>{NBSP}</Text>)
      )}
    </View>
  );
};

// Label-on-the-right detail row: [ value (left) ][ bilingual label (right) ].
const DetailRow: React.FC<{
  dv: string;
  en: string;
  value?: React.ReactNode;
  labelW?: string;
  valueW?: string;
  minHeight?: number;
  dhivehiValue?: boolean;
}> = ({
  dv,
  en,
  value,
  labelW = "40%",
  valueW = "60%",
  minHeight = 16,
  dhivehiValue,
}) => (
  <View style={styles.row}>
    <Val width={valueW} minHeight={minHeight} dhivehi={dhivehiValue}>
      {value}
    </Val>
    <BiLabel width={labelW} dv={dv} en={en} />
  </View>
);

interface SBProps {
  dv: string;
  en: string;
  role: PettyCashPrintData["roles"][number] | undefined;
  showDesignation: boolean;
  showAmount: boolean;
}

// Signature block used for Procurement / Budget (designation, no amount)
// and the Balance pair (amount, no designation).
const SignatureBlock: React.FC<SBProps> = ({
  dv,
  en,
  role,
  showDesignation,
  showAmount,
}) => (
  <View>
    <View style={styles.row}>
      <BiLabel width="100%" dv={dv} en={en} style={styles.band} />
    </View>
    <DetailRow dv="ނަން:" en="Name" value={role?.name} labelW="38%" valueW="62%" />
    {showDesignation && (
      <DetailRow
        dv="މަޤާމު:"
        en="Designation"
        value={role?.designation}
        labelW="38%"
        valueW="62%"
      />
    )}
    {showAmount && (
      <DetailRow
        dv="އަދަދު:"
        en="Amount"
        value={
          role?.amount != null ? formatNumberWithCommas(role.amount) : NBSP
        }
        labelW="38%"
        valueW="62%"
      />
    )}
    <DetailRow
      dv="ސޮއި:"
      en="Signature"
      labelW="38%"
      valueW="62%"
      minHeight={30}
      value={
        role?.signature ? (
          // react-pdf <Image> doesn't take `alt` (it's PDF, not HTML).
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={role.signature} style={styles.signatureImg} />
        ) : undefined
      }
    />
    <DetailRow
      dv="ތާރީޚް:"
      en="Date"
      value={formatDate(role?.date)}
      labelW="38%"
      valueW="62%"
    />
  </View>
);

interface Props {
  pettyCash: PettyCashPrintData;
}

const PrintView: React.FC<Props> = ({ pettyCash }) => {
  const handledBy = pettyCash.roles[0];
  const procurementApprovedBy = pettyCash.roles[1];
  const budgetCheckedBy = pettyCash.roles[2];
  const balanceHandedOverBy = pettyCash.roles[3];
  const balanceCollectedBy = pettyCash.roles[4];

  // Keep a single trailing blank row for hand-writing, but drop it once the
  // list is long enough that an extra row risks spilling to a second page.
  const extraRows = pettyCash.items.length > 8 ? 0 : 1;
  const padded = [
    ...pettyCash.items,
    ...Array.from(
      { length: extraRows },
      () => ({ qty: null as number | null, name: "" }),
    ),
  ];

  return (
    <Document
      title="Petty Cash Expenditure Authorization Form"
      author="National Archives of Maldives"
    >
      <Page size="A4" style={styles.page}>
        {/* ---------- Letterhead ---------- */}
        <View style={styles.header}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src="/emblem.png" style={[styles.headerLogo, { width: 44 }]} />
          <View style={styles.headerCenter}>
            <Text style={styles.orgDhivehi}>ދިވެހިރާއްޖޭގެ ޤައުމީ އަރުޝީފު</Text>
            <Text style={styles.orgEnglish}>NATIONAL ARCHIVES OF MALDIVES</Text>
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src="/logo.png" style={[styles.headerLogo, { width: 48 }]} />
        </View>
        <View style={styles.rule} />

        {/* ---------- Info box: Number / Date ---------- */}
        <View style={styles.infoWrap}>
          <View style={{ width: "55%" }}>
            <DetailRow
              dv="ނަންބަރ:"
              en="Number"
              value={pettyCash.pettyCashNum}
              labelW="42%"
              valueW="58%"
            />
            <DetailRow
              dv="ތާރީޚް:"
              en="Date"
              value={formatDate(pettyCash.date)}
              labelW="42%"
              valueW="58%"
            />
          </View>
          <View style={{ width: "45%" }} />
        </View>

        {/* ---------- Title band ---------- */}
        <View style={styles.titleBand}>
          <Text style={styles.titleDhivehi}>
            ޕެޓީ ކޭޝް ފައިސާ ޚަރަދު ކުރުމަށް ހުއްދަ ދޭ ފޯމު
          </Text>
          <Text style={styles.titleEnglish}>
            PETTY CASH EXPENDITURE AUTHORIZATION FORM
          </Text>
        </View>

        {/* ---------- Details ---------- */}
        <View style={{ marginTop: 6 }}>
          {/* Section / Unit + Form Number (RTL: labels on the right) */}
          <View style={styles.row}>
            <Val width="22%">{pettyCash.formNum}</Val>
            <BiLabel width="20%" dv="ފޯމް ނަންބަރ:" en="Form Number" />
            <Val width="28%">{pettyCash.sectionUnit}</Val>
            <BiLabel
              width="30%"
              dv="އެދުނު ސެކްޝަން/ޔުނިޓް ނަން:"
              en="Section / Unit"
            />
          </View>

          {/* Items header: Details (right-aligned) | Quantity (centered) */}
          <View style={styles.row}>
            <BiHeader width="72%" dv="ތަފްސީލް" en="Details" align="right" />
            <BiHeader width="28%" dv="އަދަދު" en="Quantity" />
          </View>
          {padded.map((item, idx) => (
            <View style={styles.row} key={idx}>
              <Val width="72%" minHeight={15} style={styles.right}>
                {item.name}
              </Val>
              <Val width="28%" minHeight={15} style={styles.center}>
                {item.qty ?? NBSP}
              </Val>
            </View>
          ))}

          {/* Total amount + Budget code */}
          <DetailRow
            dv="ބޭނުންވާ ފައިސާގެ ޖުމުލަ ޢަދަދު:"
            en="Total Amount Required"
            labelW="40%"
            valueW="60%"
            value={
              <Text style={styles.bold}>
                {formatNumberWithCommas(pettyCash.totalRequiredAmount)}
              </Text>
            }
          />
          <DetailRow
            dv="ޚަރަދު ކުރެވޭ ބަޖެޓް ކޯޑް:"
            en="Budget Code"
            labelW="40%"
            valueW="60%"
            value={pettyCash.glCode}
          />
        </View>

        {pettyCash.systemApproved ? (
          /* Imported record — approved by the system, no signatories. */
          <View style={styles.blockGap} wrap={false}>
            <View
              style={{
                borderWidth: 1,
                borderColor: BORDER,
                paddingVertical: 14,
                paddingHorizontal: 10,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={[styles.bold, { fontSize: 12 }]}>
                SYSTEM APPROVED
              </Text>
              <Text style={{ fontSize: 8, marginTop: 3, textAlign: "center" }}>
                Approved by the system on import — no individual signatories.
              </Text>
            </View>
          </View>
        ) : (
          <>
        {/* ---------- Funds Received By ---------- */}
        <View style={styles.blockGap} wrap={false}>
          <View style={styles.row}>
            <BiLabel
              width="100%"
              dv="ފައިސާ ޙަވާލުވި މުވައްޒަފުގެ:"
              en="Funds Received By"
              style={styles.band}
            />
          </View>
          <View style={[styles.row, { alignItems: "stretch" }]}>
            {/* Signature box on the LEFT (matches reference) */}
            <View
              style={[
                styles.cell,
                { width: "25%", alignItems: "center", justifyContent: "center" },
              ]}
            >
              {handledBy?.signature ? (
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image
                  src={handledBy.signature}
                  style={{ maxHeight: 60, maxWidth: "100%", objectFit: "contain" }}
                />
              ) : null}
            </View>
            {/* Details on the RIGHT */}
            <View style={{ width: "75%" }}>
              <DetailRow
                dv="ނަން:"
                en="Name"
                value={handledBy?.name}
                labelW="32%"
                valueW="68%"
              />
              <DetailRow
                dv="މަޤާމު:"
                en="Designation"
                value={handledBy?.designation}
                labelW="32%"
                valueW="68%"
              />
              <DetailRow
                dv="ޙަވާލުކުރެވުނު ފައިސާގެ އަދަދު:"
                en="Amount"
                labelW="32%"
                valueW="68%"
                value={
                  handledBy?.amount != null
                    ? formatNumberWithCommas(handledBy.amount)
                    : NBSP
                }
              />
              <DetailRow
                dv="ތާރީޚް:"
                en="Date"
                value={formatDate(handledBy?.date)}
                labelW="32%"
                valueW="68%"
              />
            </View>
          </View>
        </View>

        {/* ---------- Budget (left) + Procurement (right) ---------- */}
        <View style={styles.twoCol} wrap={false}>
          <View style={styles.colHalf}>
            <SignatureBlock
              dv="ބަޖެޓް ސެކްޝަނުން ޗެކްކުރި:"
              en="Verified by Budget Section"
              role={budgetCheckedBy}
              showDesignation
              showAmount={false}
            />
          </View>
          <View style={styles.colHalf}>
            <SignatureBlock
              dv="ޕްރޮކިއުމެންޓް ސެކްޝަނުން ހުއްދަ ދެއްވި:"
              en="Authorized by Procurement Section"
              role={procurementApprovedBy}
              showDesignation
              showAmount={false}
            />
          </View>
        </View>

        {/* ---------- Balance Received (left) + Returned (right) ---------- */}
        <View style={styles.twoCol} wrap={false}>
          <View style={styles.colHalf}>
            <SignatureBlock
              dv="ބާކީ ފައިސާއާ ހަވާލްވި މުވައްޒަފު:"
              en="Balance Received By"
              role={balanceCollectedBy}
              showDesignation={false}
              showAmount
            />
          </View>
          <View style={styles.colHalf}>
            <SignatureBlock
              dv="ބާކީ ފައިސާ ހަވާލުކުރި މުވައްޒަފު:"
              en="Remaining Balance Returned By"
              role={balanceHandedOverBy}
              showDesignation={false}
              showAmount
            />
          </View>
        </View>
          </>
        )}
      </Page>
    </Document>
  );
};

export default PrintView;
