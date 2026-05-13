"use client";

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import { PvValues } from "@/schemas/PvSchema";
import { formatNumberWithCommas, numberToWords } from "@/utils/helpers";
import { CurrencyNames } from "@/lib/constants/currencies";

Font.register({ family: "Faruma", src: "/fonts/Faruma.ttf" });
Font.register({ family: "MVWaheed", src: "/fonts/MVWaheed.otf" });

const BORDER = "#000000";
const NBSP = " ";

const formatDate = (date?: Date | null) => {
  if (!date) return "";
  const opts: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "short",
    year: "numeric",
  };
  try {
    return new Date(date).toLocaleDateString("en-GB", opts).replace(/ /g, "-");
  } catch {
    return "";
  }
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 24,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#000",
  },
  outerFrame: {
    borderWidth: 1,
    borderColor: BORDER,
    padding: 6,
  },
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
  dhivehi: { fontFamily: "Faruma", fontSize: 10 },
  waheedTitle: { fontFamily: "MVWaheed", fontSize: 18, textAlign: "center" },
  englishTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    textAlign: "center",
    marginTop: 2,
  },
  sectionGap: { marginTop: 6 },
  smallGap: { marginTop: 3 },
});

interface Props {
  pv: PvValues;
}

const Cell: React.FC<{
  width: string | number;
  style?: object;
  children?: React.ReactNode;
  minHeight?: number;
}> = ({ width, style, children, minHeight = 16 }) => (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <View style={[styles.cell, { width, minHeight }, style] as any}>
    {typeof children === "string" || typeof children === "number" ? (
      <Text>{children === "" ? NBSP : children}</Text>
    ) : (
      children ?? <Text>{NBSP}</Text>
    )}
  </View>
);

// A bilingual label like "Agency / އޮފީސް" — needs separate Text runs so the
// Dhivehi run can resolve in the Faruma font.
const Bilingual: React.FC<{
  english: string;
  dhivehi: string;
  bold?: boolean;
}> = ({ english, dhivehi, bold }) => (
  <Text style={bold ? styles.bold : undefined}>
    {english} / <Text style={styles.dhivehi}>{dhivehi}</Text>
  </Text>
);

const getGrossTotal = (pv: PvValues) =>
  pv.invoiceDetails.reduce((sum, inv) => sum + inv.invoiceTotal, 0);

const PrintViewPdf: React.FC<Props> = ({ pv }) => {
  const grossTotal = getGrossTotal(pv);
  const isMVR = pv.currency.toLowerCase() === "mvr";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.outerFrame}>
          {/* Title strip + Acct No / Type */}
          <View style={styles.row}>
            <View style={{ width: "60%", justifyContent: "center" }}>
              <Text style={styles.waheedTitle}>ޕޭމަންޓް ވައުޗަރ</Text>
              <Text style={styles.englishTitle}>Payment Voucher</Text>
            </View>
            <View style={{ width: "40%" }}>
              <View style={styles.row}>
                <Cell width="50%">
                  <Bilingual english="Acct. No." dhivehi="އެކައުންޓް" bold />
                </Cell>
                <Cell width="50%" style={styles.center}>
                  {pv.businessArea}
                </Cell>
              </View>
              <View style={styles.row}>
                <Cell width="50%">
                  <Bilingual english="Type" dhivehi="ބާވަތް" bold />
                </Cell>
                <Cell
                  width="50%"
                  style={[styles.center, { textDecoration: "underline" }]}
                >
                  Budget
                </Cell>
              </View>
            </View>
          </View>

          {/* Agency / Bus Area / Vendor  |  Date / PV No / Invoice count */}
          <View style={[styles.row, styles.sectionGap]}>
            <View style={{ width: "60%" }}>
              <View style={styles.row}>
                <Cell width="33%">
                  <Bilingual english="Agency" dhivehi="އޮފީސް" />
                </Cell>
                <Cell width="67%">{pv.agency}</Cell>
              </View>
              <View style={styles.row}>
                <Cell width="33%">
                  <Bilingual english="Bus. Area" dhivehi="ބ. އޭރިއާ" />
                </Cell>
                <Cell width="67%">{String(pv.businessArea)}</Cell>
              </View>
              <View style={styles.row}>
                <Cell width="33%">
                  <Bilingual english="Vendor" dhivehi="ލިބޭފަރާތް" />
                </Cell>
                <Cell width="67%">{pv.vendor}</Cell>
              </View>
            </View>
            <View style={{ width: "40%" }}>
              <View style={styles.row}>
                <Cell width="50%">
                  <Bilingual english="Date" dhivehi="ތާރީޚް" />
                </Cell>
                <Cell width="50%" style={styles.center}>
                  {formatDate(pv.date)}
                </Cell>
              </View>
              <View style={styles.row}>
                <Cell width="50%">
                  <Bilingual english="PV No." dhivehi="ޕީވީ" />
                </Cell>
                <Cell width="50%" style={styles.center}>
                  {`1506/${pv.pvNum.replace("-", "/")}`}
                </Cell>
              </View>
              <View style={styles.row}>
                <Cell width="75%">
                  <Bilingual english="Invoice(s)" dhivehi="އިންވޮއިސްގެ އަދަދު" />
                </Cell>
                <Cell width="25%" style={styles.center}>
                  {pv.invoiceDetails.length}
                </Cell>
              </View>
            </View>
          </View>

          {/* Notes */}
          <View style={[styles.row, styles.sectionGap]}>
            <View
              style={{
                width: "12%",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={styles.bold}>Note:</Text>
              <Text style={styles.dhivehi}>ނޯޓު</Text>
            </View>
            <View
              style={{
                width: "88%",
                borderWidth: 1,
                borderColor: BORDER,
                padding: 4,
                minHeight: 32,
              }}
            >
              <Text>{pv.notes}</Text>
            </View>
          </View>

          {/* Invoice details header */}
          <View style={styles.sectionGap}>
            <Text style={styles.bold}>
              Invoice Details /{" "}
              <Text style={styles.dhivehi}>އިންވޮއިސްގެ ތަފްޞީލް</Text>
            </Text>
            <View style={[styles.row, styles.smallGap]}>
              <Cell width="22%">
                <Bilingual english="Doc. Currency" dhivehi="ފައިސާ" />
              </Cell>
              <Cell width="11%" style={styles.center}>
                {pv.currency}
              </Cell>
              <Cell width="50%">
                <Bilingual
                  english="Doc. Curr. to MVR Exchange Rate"
                  dhivehi="އެކްސްޗޭންޖް ރޭޓް"
                />
              </Cell>
              <Cell width="17%" style={styles.center}>
                {String(pv.exchangeRate)}
              </Cell>
            </View>
          </View>

          {/* Per-invoice block */}
          {pv.invoiceDetails.map((invoice, index) => {
            const invMvr = invoice.invoiceTotal * pv.exchangeRate;
            return (
              <View
                key={index}
                style={[
                  styles.smallGap,
                  { borderWidth: 1, borderColor: BORDER },
                ]}
                wrap={false}
              >
                {/* Invoice header */}
                <View style={styles.row}>
                  <View style={{ width: "25%" }}>
                    <Cell width="100%" style={[styles.bold, styles.center]}>
                      Invoice No.
                    </Cell>
                    <Cell width="100%" style={styles.center}>
                      {invoice.invoiceNumber ?? ""}
                    </Cell>
                  </View>
                  <View style={{ width: "25%" }}>
                    <Cell width="100%" style={[styles.bold, styles.center]}>
                      Invoice Date
                    </Cell>
                    <Cell width="100%" style={styles.center}>
                      {formatDate(invoice.invoiceDate)}
                    </Cell>
                  </View>
                  <View style={{ width: "25%" }}>
                    <Cell width="100%" style={[styles.bold, styles.center]}>
                      Invoice Total
                    </Cell>
                    <Cell width="100%" style={styles.center}>
                      {isMVR
                        ? formatNumberWithCommas(invMvr)
                        : formatNumberWithCommas(invoice.invoiceTotal)}
                    </Cell>
                  </View>
                  <View style={{ width: "25%" }}>
                    <Cell width="100%" style={[styles.bold, styles.center]}>
                      MVR
                    </Cell>
                    <Cell width="100%" style={styles.center}>
                      {formatNumberWithCommas(invMvr)}
                    </Cell>
                  </View>
                </View>

                {/* Comments */}
                <View style={[styles.row, { paddingHorizontal: 3, paddingVertical: 2 }]}>
                  <View
                    style={{
                      width: "14%",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={styles.bold}>Comment(s)</Text>
                  </View>
                  <View
                    style={{
                      width: "86%",
                      borderWidth: 0.5,
                      borderColor: BORDER,
                      padding: 3,
                      minHeight: 16,
                    }}
                  >
                    <Text>{invoice.comments}</Text>
                  </View>
                </View>

                {/* GL headings */}
                <View style={styles.row}>
                  <Cell width="16.66%" style={[styles.bold, styles.center]}>
                    GL / Asset
                  </Cell>
                  <Cell width="16.66%" style={[styles.bold, styles.center]}>
                    Activity Ref.
                  </Cell>
                  <Cell width="16.66%" style={[styles.bold, styles.center]}>
                    Cost Ctr/Proj.
                  </Cell>
                  <Cell width="16.66%" style={[styles.bold, styles.center]}>
                    Fund
                  </Cell>
                  <Cell width="16.66%" style={[styles.bold, styles.center]}>
                    Amt. in Doc. Curr.
                  </Cell>
                  <Cell width="16.66%" style={[styles.bold, styles.center]}>
                    Amt. in MVR
                  </Cell>
                </View>

                {/* GL rows */}
                {invoice.glDetails.map((gl, glId) => (
                  <View key={glId} style={styles.row}>
                    <Cell width="16.66%" style={styles.center}>
                      {String(gl.code)}
                    </Cell>
                    <Cell width="16.66%" style={styles.center}>
                      -
                    </Cell>
                    <Cell width="16.66%" style={styles.center}>
                      -
                    </Cell>
                    <Cell width="16.66%" style={styles.center}>
                      {gl.fund}
                    </Cell>
                    <Cell width="16.66%" style={styles.center}>
                      {formatNumberWithCommas(gl.amount)}
                    </Cell>
                    <Cell width="16.66%" style={styles.center}>
                      {formatNumberWithCommas(gl.amount * pv.exchangeRate)}
                    </Cell>
                  </View>
                ))}
              </View>
            );
          })}

          {/* Gross Total */}
          <View style={[styles.row, styles.sectionGap]} wrap={false}>
            <View
              style={[
                styles.cell,
                {
                  width: "16%",
                  alignItems: "center",
                  justifyContent: "center",
                },
              ]}
            >
              <Text style={styles.bold}>Gross Total</Text>
              <Text style={styles.dhivehi}>މުޅި ޖުމްލަ</Text>
            </View>
            <View style={{ width: "10%" }}>
              <Cell width="100%" style={styles.center}>
                {pv.currency}
              </Cell>
              <Cell width="100%" style={styles.center}>
                MVR
              </Cell>
            </View>
            <View style={{ width: "54%" }}>
              <Cell width="100%">
                {!isMVR
                  ? numberToWords(
                      grossTotal,
                      CurrencyNames[pv.currency as keyof typeof CurrencyNames],
                    )
                  : numberToWords(grossTotal * pv.exchangeRate)}
              </Cell>
              <Cell width="100%">
                {isMVR
                  ? numberToWords(grossTotal)
                  : numberToWords(grossTotal * pv.exchangeRate)}
              </Cell>
            </View>
            <View style={{ width: "20%" }}>
              <Cell width="100%" style={styles.right}>
                {formatNumberWithCommas(grossTotal, true)}
              </Cell>
              <Cell width="100%" style={styles.right}>
                {formatNumberWithCommas(grossTotal * pv.exchangeRate, true)}
              </Cell>
            </View>
          </View>

          {/* Payment Authorization */}
          <View
            style={[
              styles.sectionGap,
              { borderWidth: 1, borderColor: BORDER },
            ]}
            wrap={false}
          >
            <View style={{ paddingHorizontal: 4, paddingVertical: 3 }}>
              <Text style={styles.bold}>
                Payment Authorization /{" "}
                <Text style={styles.dhivehi}>
                  ފައިސާ ދެއްކުމުގެ ހުއްދަދިނުން
                </Text>
              </Text>
            </View>

            {(
              [
                {
                  enLabel: "Prepared by:",
                  dvLabel: "ތައްޔާރު ކުރި",
                  person: pv.preparedBy,
                  date: pv.date,
                },
                {
                  enLabel: "Verified by:",
                  dvLabel: "ޗެކް ކުރި",
                  person: pv.verifiedBy,
                  date: pv.date,
                },
                {
                  enLabel: "Authorised by:",
                  dvLabel: "ހުއްދަ ދިން",
                  person: pv.authorisedByOne,
                  date: pv.date,
                },
                {
                  enLabel: "Authorised by:",
                  dvLabel: "ހުއްދަ ދިން",
                  person: pv.authorisedByTwo,
                  date: pv.authorisedByTwo?.name ? pv.date : null,
                },
              ] as const
            ).map((row, idx) => (
              <View key={idx} style={styles.row}>
                <Cell width="14.28%" minHeight={40}>
                  <Text style={styles.bold}>{row.enLabel}</Text>
                  <Text style={[styles.dhivehi, { marginTop: 2 }]}>
                    {row.dvLabel}
                  </Text>
                </Cell>
                <Cell width="42.86%" minHeight={40}>
                  <Text style={styles.center}>{row.person?.name ?? ""}</Text>
                  <Text style={styles.center}>
                    {row.person?.designation ?? ""}
                  </Text>
                </Cell>
                <Cell
                  width="14.28%"
                  style={styles.center}
                  minHeight={40}
                >
                  {formatDate(row.date)}
                </Cell>
                <Cell width="28.58%" minHeight={40} />
              </View>
            ))}
          </View>

          {/* Payment Delivery */}
          <View style={styles.sectionGap} wrap={false}>
            <View
              style={{
                borderTopWidth: 1,
                borderLeftWidth: 1,
                borderRightWidth: 1,
                borderColor: BORDER,
                paddingHorizontal: 4,
                paddingVertical: 3,
              }}
            >
              <Text style={styles.bold}>Payment Delivery</Text>
            </View>

            {/* Row 1: Payment Type / Cheque / Transfer / blank / Received By / blank / signature box (spans 3 rows) */}
            <View style={styles.row}>
              <Cell width="16%" style={styles.bold}>
                Payment Type:
              </Cell>
              <Cell width="8%" style={styles.center}>
                Cheque
              </Cell>
              <Cell width="8%" style={styles.center}>
                Transfer
              </Cell>
              <Cell width="8%" />
              <Cell width="16%" style={styles.bold}>
                Received By:
              </Cell>
              <Cell width="16%" />
              {/* Signature box spans the height of 3 rows */}
              <View
                style={[
                  styles.cell,
                  {
                    width: "28%",
                    minHeight: 16 * 3,
                  },
                ]}
              >
                <Text>{NBSP}</Text>
              </View>
            </View>

            {/* Row 2: blank cells under payment type cells + NID/PP/WP */}
            <View style={styles.row}>
              <Cell width="16%" />
              <Cell width="8%" />
              <Cell width="8%" />
              <Cell width="8%" />
              <Cell width="16%" style={styles.bold}>
                NID/PP/WP No.:
              </Cell>
              <Cell width="16%" />
            </View>

            {/* Row 3: Instr No / Date */}
            <View style={styles.row}>
              <Cell width="8%" style={styles.bold}>
                Instr. No.:
              </Cell>
              <Cell width="24%" />
              <Cell width="16%" style={styles.bold}>
                Date:
              </Cell>
              <Cell width="24%" />
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default PrintViewPdf;
