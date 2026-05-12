"use client";

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import { formatNumberWithCommas } from "@/utils/helpers";

export interface PettyCashPrintData {
  pettyCashNum: string;
  date: Date | null;
  formNum: string;
  sectionUnit: string;
  totalRequiredAmount: number;
  glCode: number;
  parkedDate: Date | null;
  postingDate: Date | null;
  items: { qty: number; name: string }[];
  roles: {
    label: string;
    name: string;
    designation: string;
    amount: number | null;
    isApproved: boolean;
    date: Date | null;
  }[];
}

const INK = "#0f172a";
const MUTED = "#64748b";
const HAIRLINE = "#cbd5e1";
const SUBTLE_BG = "#f8fafc";
const NBSP = " ";
const MIN_ITEM_ROWS = 5;

const formatDate = (date?: Date | null) => {
  if (!date) return "";
  try {
    return date.toLocaleDateString("en-GB", {
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
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 32,
    fontFamily: "Times-Roman",
    fontSize: 9,
    color: INK,
    lineHeight: 1.3,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottomWidth: 0.5,
    borderBottomColor: HAIRLINE,
    paddingBottom: 7,
    marginBottom: 10,
  },
  metaText: { fontSize: 8.5, color: INK },
  metaLabel: { color: MUTED, fontFamily: "Times-Bold" },
  metaValue: { fontFamily: "Times-Bold" },
  logo: { width: 60, height: "auto" },
  titleWrap: { textAlign: "center", marginBottom: 9 },
  title: {
    fontFamily: "Times-Bold",
    fontSize: 12.5,
    letterSpacing: 0.4,
  },
  table: { width: "100%" },
  row: { flexDirection: "row" },
  cell: {
    borderWidth: 0.5,
    borderColor: HAIRLINE,
    paddingVertical: 2.5,
    paddingHorizontal: 6,
    justifyContent: "center",
  },
  label: {
    textAlign: "right",
    fontFamily: "Times-Bold",
  },
  header: {
    fontFamily: "Times-Bold",
    backgroundColor: SUBTLE_BG,
  },
  sectionTitle: {
    fontFamily: "Times-Bold",
    backgroundColor: SUBTLE_BG,
    fontSize: 8,
    letterSpacing: 0.8,
    paddingVertical: 4,
    textTransform: "uppercase",
  },
  blockGap: { marginTop: 10 },
  twoCol: { flexDirection: "row", gap: 10, marginTop: 10 },
  colHalf: { flex: 1 },
  footer: {
    marginTop: 14,
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderTopColor: HAIRLINE,
    fontSize: 7,
    color: MUTED,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CellStyle = any;

const Cell: React.FC<{
  width: string | number;
  style?: CellStyle;
  children?: React.ReactNode;
  minHeight?: number;
}> = ({ width, style, children, minHeight = 14 }) => (
  <View style={[styles.cell, { width, minHeight }, style] as CellStyle}>
    <Text>{children ?? NBSP}</Text>
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

  const padded = [
    ...pettyCash.items,
    ...Array.from(
      { length: Math.max(0, MIN_ITEM_ROWS - pettyCash.items.length) },
      () => ({ qty: null as number | null, name: "" }),
    ),
  ];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Emblem */}
        <View style={{ alignItems: "center", marginBottom: 6 }}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src="/emblem.png" style={{ width: 28, height: 28 }} />
        </View>

        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.metaText}>
              <Text style={styles.metaLabel}>Number</Text>
              <Text style={{ color: MUTED }}>{"  ·  "}</Text>
              <Text style={styles.metaValue}>{pettyCash.pettyCashNum}</Text>
            </Text>
            <Text style={styles.metaText}>
              <Text style={styles.metaLabel}>Date</Text>
              <Text style={{ color: MUTED }}>{"  ·  "}</Text>
              <Text style={styles.metaValue}>
                {formatDate(pettyCash.date) || NBSP}
              </Text>
            </Text>
          </View>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src="/full-logo.png" style={styles.logo} />
        </View>

        {/* Title */}
        <View style={styles.titleWrap}>
          <Text style={styles.title}>
            Petty Cash Expenditure Authorization Form
          </Text>
        </View>

        {/* Main details table */}
        <View style={styles.table}>
          <View style={styles.row}>
            <Cell width="28%" style={styles.label}>
              Requested Section / Unit Name
            </Cell>
            <Cell width="28%">{pettyCash.sectionUnit}</Cell>
            <Cell width="18%" style={styles.label}>
              Form Number
            </Cell>
            <Cell width="26%">{pettyCash.formNum}</Cell>
          </View>
          <View style={styles.row}>
            <Cell
              width="28%"
              style={[styles.header, { textAlign: "right" }]}
            >
              Quantity
            </Cell>
            <Cell width="72%" style={styles.header}>
              Details
            </Cell>
          </View>
          {padded.map((item, idx) => (
            <View style={styles.row} key={idx}>
              <Cell width="28%" style={{ textAlign: "right" }}>
                {item.qty ?? NBSP}
              </Cell>
              <Cell width="72%">{item.name}</Cell>
            </View>
          ))}
          <View style={styles.row}>
            <Cell width="28%" style={styles.label}>
              Total Amount Required
            </Cell>
            <Cell width="72%" style={{ fontFamily: "Times-Bold" }}>
              {formatNumberWithCommas(pettyCash.totalRequiredAmount)}
            </Cell>
          </View>
          <View style={styles.row}>
            <Cell width="28%" style={styles.label}>
              Budget Code
            </Cell>
            <Cell width="72%">{pettyCash.glCode}</Cell>
          </View>
        </View>

        {/* Funds Received By */}
        <View style={styles.blockGap}>
          <View style={styles.row}>
            <Cell width="100%" style={styles.sectionTitle}>
              Funds Received By
            </Cell>
          </View>
          <View style={[styles.row, { alignItems: "stretch" }]}>
            <View style={{ width: "75%" }}>
              <View style={styles.row}>
                <Cell width="32%" style={styles.label}>
                  Name
                </Cell>
                <Cell width="68%">{handledBy?.name}</Cell>
              </View>
              <View style={styles.row}>
                <Cell width="32%" style={styles.label}>
                  Designation
                </Cell>
                <Cell width="68%">{handledBy?.designation}</Cell>
              </View>
              <View style={styles.row}>
                <Cell width="32%" style={styles.label}>
                  Amount
                </Cell>
                <Cell width="68%">
                  {handledBy?.amount != null
                    ? formatNumberWithCommas(handledBy.amount)
                    : NBSP}
                </Cell>
              </View>
              <View style={styles.row}>
                <Cell width="32%" style={styles.label}>
                  Date
                </Cell>
                <Cell width="68%">{formatDate(handledBy?.date)}</Cell>
              </View>
            </View>
            <View style={[styles.cell, { width: "25%" }]} />
          </View>
        </View>

        {/* Procurement + Budget */}
        <View style={styles.twoCol}>
          <View style={styles.colHalf}>
            <SignatureBlock
              title="Authorized by Procurement Section"
              role={procurementApprovedBy}
              includeAmount={false}
            />
          </View>
          <View style={styles.colHalf}>
            <SignatureBlock
              title="Verified by Budget Section"
              role={budgetCheckedBy}
              includeAmount={false}
            />
          </View>
        </View>

        {/* Balance pair */}
        <View style={styles.twoCol}>
          <View style={styles.colHalf}>
            <SignatureBlock
              title="Remaining Balance Returned By"
              role={balanceHandedOverBy}
              includeAmount={true}
            />
          </View>
          <View style={styles.colHalf}>
            <SignatureBlock
              title="Balance Received By"
              role={balanceCollectedBy}
              includeAmount={true}
            />
          </View>
        </View>

        <Text style={styles.footer}>
          PETTY CASH · {pettyCash.pettyCashNum}
        </Text>
      </Page>
    </Document>
  );
};

interface SBProps {
  title: string;
  role:
    | {
        name: string;
        designation: string;
        amount: number | null;
        date: Date | null;
      }
    | undefined;
  includeAmount: boolean;
}

const SignatureBlock: React.FC<SBProps> = ({
  title,
  role,
  includeAmount,
}) => (
  <View>
    <View style={styles.row}>
      <Cell width="100%" style={styles.sectionTitle}>
        {title}
      </Cell>
    </View>
    <View style={styles.row}>
      <Cell width="38%" style={styles.label}>
        Name
      </Cell>
      <Cell width="62%">{role?.name}</Cell>
    </View>
    <View style={styles.row}>
      <Cell width="38%" style={styles.label}>
        Designation
      </Cell>
      <Cell width="62%">{role?.designation}</Cell>
    </View>
    {includeAmount && (
      <View style={styles.row}>
        <Cell width="38%" style={styles.label}>
          Amount
        </Cell>
        <Cell width="62%">
          {role?.amount != null ? formatNumberWithCommas(role.amount) : NBSP}
        </Cell>
      </View>
    )}
    <View style={styles.row}>
      <Cell width="38%" style={styles.label}>
        Signature
      </Cell>
      <Cell width="62%" minHeight={32} />
    </View>
    <View style={styles.row}>
      <Cell width="38%" style={styles.label}>
        Date
      </Cell>
      <Cell width="62%">{formatDate(role?.date)}</Cell>
    </View>
  </View>
);

export default PrintView;
