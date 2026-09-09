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
import { PvValues } from "@/schemas/PvSchema";
import { formatNumberWithCommas, numberToWords } from "@/utils/helpers";
import { CurrencyNames } from "@/lib/constants/currencies";

Font.register({ family: "Faruma", src: "/fonts/Faruma.ttf" });
Font.register({ family: "MVWaheed", src: "/fonts/MVWaheed.otf" });

const BORDER = "#000000";
const NBSP = " ";

// Column geometry, as a percent of a bordered section's content width. The GL
// table is six equal columns; the Gross Total band below it reuses that grid
// for its outer dividers so the totals sit directly under the figures they
// total. Both sections carry a 1pt frame, so their percentages resolve against
// the same box and the dividers line up exactly.
const GL_COL = 16.66;

const GROSS_LABEL = GL_COL; // meets the GL table's first divider
const GROSS_AMOUNT = 100 - GL_COL * 5; // starts under "Amt. in MVR"
const GROSS_CURRENCY = 10;
const GROSS_WORDS = 100 - GROSS_LABEL - GROSS_CURRENCY - GROSS_AMOUNT;
const GROSS_BODY = 100 - GROSS_LABEL;

const DELIVERY_SIGNATURE = 28;
const DELIVERY_BODY = 100 - DELIVERY_SIGNATURE;

/**
 * Re-bases a width given as a percent of the section onto a nested container
 * that is only `container` percent wide. Needed wherever a cell spans several
 * rows: the spanning cell sits beside a nested column holding those rows, so
 * the rows measure against the nested width rather than the section's.
 */
const rebase = (width: number, container: number) =>
  `${(width / container) * 100}%`;

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

// Numeric DD/MM/YYYY for the posted stamp ("…posted on 13/06/2026").
const formatDmyNumeric = (date?: Date | null) => {
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
  topBand: { marginBottom: 6, alignItems: "flex-start" },
});

interface Props {
  pv: PvValues;
}

/**
 * A bordered table cell.
 *
 * `minHeight` is a floor, not a fixed height, and there is no `flex` — so a
 * cell is exactly as tall as its own content. Lay cells out ROW-MAJOR (one
 * `styles.row` per record, cells inside it): siblings in a flex row stretch to
 * the tallest of them, which is what keeps dividers level when a cell wraps.
 * Stacking cells into columns and placing those columns side by side does NOT
 * align them — each column sizes its rows independently. To span a cell across
 * several rows, put it beside a nested column holding those rows (see the
 * Gross Total and Payment Delivery blocks) rather than padding it out to a
 * fixed height.
 */
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
  // Units for spelling out the document-currency total. Undefined for a
  // currency we hold no names for, in which case numberToWords falls back
  // to its Rufiyaa/Laari defaults.
  const docUnits = CurrencyNames[pv.currency as keyof typeof CurrencyNames];

  // Single-invoice document number prints top-left above the header.
  // (Multi-invoice doc numbers print inside each invoice's comments cell.)
  const singleDocNumber =
    pv.invoiceDetails.length === 1
      ? pv.invoiceDetails[0].documentNumber
      : undefined;
  const isPosted = Boolean(pv.postedOn);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Top band above the frame: single-invoice document number (left)
            and the posted stamp (right). */}
        {(singleDocNumber || isPosted) && (
          <View style={[styles.row, styles.topBand]}>
            <View style={{ width: "50%" }}>
              {singleDocNumber ? (
                <Text style={styles.bold}>{singleDocNumber}</Text>
              ) : null}
            </View>
            <View style={{ width: "50%", alignItems: "flex-end" }}>
              {isPosted ? (
                <>
                  <Text style={[styles.bold, styles.right]}>
                    This PV has been posted on{" "}
                    {formatDmyNumeric(pv.postedOn)}
                  </Text>
                  {pv.postedBy?.signature ? (
                    // react-pdf's <Image> doesn't take `alt`; jsx-a11y is a
                    // false positive here.
                    // eslint-disable-next-line jsx-a11y/alt-text
                    <Image
                      src={pv.postedBy.signature}
                      style={{
                        maxHeight: 28,
                        maxWidth: 130,
                        objectFit: "contain",
                        marginTop: 2,
                      }}
                    />
                  ) : null}
                  {pv.postedBy?.name ? (
                    <Text style={styles.right}>{pv.postedBy.name}</Text>
                  ) : null}
                </>
              ) : null}
            </View>
          </View>
        )}

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
                {/* Invoice header. Row-major, so a long invoice number wraps
                    without dragging its heading out of line with the rest. */}
                <View style={styles.row}>
                  <Cell width="25%" style={[styles.bold, styles.center]}>
                    Invoice No.
                  </Cell>
                  <Cell width="25%" style={[styles.bold, styles.center]}>
                    Invoice Date
                  </Cell>
                  <Cell width="25%" style={[styles.bold, styles.center]}>
                    Invoice Total
                  </Cell>
                  <Cell width="25%" style={[styles.bold, styles.center]}>
                    MVR
                  </Cell>
                </View>
                <View style={styles.row}>
                  <Cell width="25%" style={styles.center}>
                    {invoice.invoiceNumber ?? ""}
                  </Cell>
                  <Cell width="25%" style={styles.center}>
                    {formatDate(invoice.invoiceDate)}
                  </Cell>
                  <Cell width="25%" style={styles.center}>
                    {isMVR
                      ? formatNumberWithCommas(invMvr)
                      : formatNumberWithCommas(invoice.invoiceTotal)}
                  </Cell>
                  <Cell width="25%" style={styles.center}>
                    {formatNumberWithCommas(invMvr)}
                  </Cell>
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
                    {/* Multi-invoice: the document number prints right-aligned
                        inside this invoice's comments cell. */}
                    {pv.invoiceDetails.length > 1 && invoice.documentNumber ? (
                      <Text style={[styles.bold, styles.right]}>
                        Doc. No: {invoice.documentNumber}
                      </Text>
                    ) : null}
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

          {/* Gross Total. The label spans both rows by sitting beside a nested
              column that holds them, so each row's cells stretch together and
              the amount in words can wrap to any number of lines without
              knocking the dividers out of line. The 1pt frame matches the
              invoice block, which is what puts the figures on its column
              grid. */}
          <View
            style={[styles.sectionGap, { borderWidth: 1, borderColor: BORDER }]}
            wrap={false}
          >
            <View style={styles.row}>
              <View
                style={[
                  styles.cell,
                  {
                    width: `${GROSS_LABEL}%`,
                    alignItems: "center",
                    justifyContent: "center",
                  },
                ]}
              >
                <Text style={styles.bold}>Gross Total</Text>
                <Text style={styles.dhivehi}>މުޅި ޖުމްލަ</Text>
              </View>
              <View style={{ width: `${GROSS_BODY}%` }}>
                {(
                  [
                    {
                      code: pv.currency,
                      words: isMVR
                        ? numberToWords(grossTotal * pv.exchangeRate)
                        : numberToWords(
                            grossTotal,
                            docUnits?.major,
                            docUnits?.minor,
                          ),
                      amount: grossTotal,
                    },
                    {
                      code: "MVR",
                      words: isMVR
                        ? numberToWords(grossTotal)
                        : numberToWords(grossTotal * pv.exchangeRate),
                      amount: grossTotal * pv.exchangeRate,
                    },
                  ] as const
                ).map((row, idx) => (
                  <View key={idx} style={styles.row}>
                    <Cell
                      width={rebase(GROSS_CURRENCY, GROSS_BODY)}
                      style={styles.center}
                    >
                      {row.code}
                    </Cell>
                    <Cell width={rebase(GROSS_WORDS, GROSS_BODY)}>
                      {row.words}
                    </Cell>
                    <Cell
                      width={rebase(GROSS_AMOUNT, GROSS_BODY)}
                      style={styles.right}
                    >
                      {formatNumberWithCommas(row.amount, true)}
                    </Cell>
                  </View>
                ))}
              </View>
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
                <Cell width="28.58%" minHeight={40}>
                  {row.person?.signature ? (
                    // react-pdf's <Image> doesn't take `alt` (it's PDF,
                    // not HTML); the jsx-a11y rule is a false positive.
                    // eslint-disable-next-line jsx-a11y/alt-text
                    <Image
                      src={row.person.signature}
                      style={{
                        maxHeight: 32,
                        maxWidth: "100%",
                        objectFit: "contain",
                        alignSelf: "center",
                      }}
                    />
                  ) : null}
                </Cell>
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

            {/* The signature box spans all three rows by sitting beside a
                nested column that holds them, so it tracks their real height
                instead of being padded out to a fixed multiple of a row. */}
            <View style={styles.row}>
              <View style={{ width: `${DELIVERY_BODY}%` }}>
                {/* Row 1: Payment Type / Cheque / Transfer / blank / Received By */}
                <View style={styles.row}>
                  <Cell width={rebase(16, DELIVERY_BODY)} style={styles.bold}>
                    Payment Type:
                  </Cell>
                  <Cell width={rebase(8, DELIVERY_BODY)} style={styles.center}>
                    Cheque
                  </Cell>
                  <Cell width={rebase(8, DELIVERY_BODY)} style={styles.center}>
                    Transfer
                  </Cell>
                  <Cell width={rebase(8, DELIVERY_BODY)} />
                  <Cell width={rebase(16, DELIVERY_BODY)} style={styles.bold}>
                    Received By:
                  </Cell>
                  <Cell width={rebase(16, DELIVERY_BODY)} />
                </View>

                {/* Row 2: blank cells under payment type cells + NID/PP/WP */}
                <View style={styles.row}>
                  <Cell width={rebase(16, DELIVERY_BODY)} />
                  <Cell width={rebase(8, DELIVERY_BODY)} />
                  <Cell width={rebase(8, DELIVERY_BODY)} />
                  <Cell width={rebase(8, DELIVERY_BODY)} />
                  <Cell width={rebase(16, DELIVERY_BODY)} style={styles.bold}>
                    NID/PP/WP No.:
                  </Cell>
                  <Cell width={rebase(16, DELIVERY_BODY)} />
                </View>

                {/* Row 3: Instr No / Date */}
                <View style={styles.row}>
                  <Cell width={rebase(8, DELIVERY_BODY)} style={styles.bold}>
                    Instr. No.:
                  </Cell>
                  <Cell width={rebase(24, DELIVERY_BODY)} />
                  <Cell width={rebase(16, DELIVERY_BODY)} style={styles.bold}>
                    Date:
                  </Cell>
                  <Cell width={rebase(24, DELIVERY_BODY)} />
                </View>
              </View>

              {/* Signature box */}
              <Cell width={`${DELIVERY_SIGNATURE}%`} />
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default PrintViewPdf;
