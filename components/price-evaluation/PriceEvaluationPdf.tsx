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
import {
  computeComparison,
  isDhivehi,
  unitMvr,
  VENDOR_COUNT,
} from "@/lib/price-eval";

// Dhivehi (Thaana) fonts — shared with the GSR / petty cash / treasury PDFs.
Font.register({ family: "Faruma", src: "/fonts/Faruma.ttf" });
Font.register({ family: "MVWaheed", src: "/fonts/MVWaheed.otf" });

const BORDER = "#000000";
const NBSP = " ";
// Shades taken from the Excel form.
const TITLE_BG = "#ddd9c4";
const LABEL_BG = "#f2f2f2";
const BUDGET_BG = "#dbeef4";
const ITEM_HEAD_BG = "#d9d9d9";
const CHOSEN_BG = "#eeece1";
const SIGN_HEAD_BG = "#f2dcdb";

// Comparison table columns (% of the table). DOM order is left→right; the
// form reads right→left, so the item column is last and each vendor group is
// [total, rate, qty].
const ITEM_W = 28;
const V = { total: 9.5, rate: 9.5, qty: 5 }; // one vendor group = 24%
// A table-relative width as a share of the vendor block (everything but the
// item column), for cells nested inside that block.
const rebase = (w: number) => (w * 100) / (100 - ITEM_W);

export interface PriceEvalPdfPerson {
  name?: string;
  designation?: string;
  /** `data:` URL, present once this person has signed. */
  signature?: string | null;
}

export interface PriceEvalPdfData {
  evalNum: string;
  date: string;
  section: string;
  method: string;
  glCode: number;
  budgetBalance: number | null;
  budgetAvailable: boolean | null;
  gstRate: number;
  vendors: {
    name: string;
    currency: string;
    exchangeRate: number;
    chargesGst: boolean;
    discountPercent?: number | null;
  }[];
  items: { name: string; qty: number; rates: (number | null)[] }[];
  selectedVendor: number | null;
  selectionReason: string;
  preparedBy: PriceEvalPdfPerson;
  budgetCheckedBy: PriceEvalPdfPerson;
  checkedBy: PriceEvalPdfPerson;
  approvedBy: PriceEvalPdfPerson;
  /** Minimum item rows (pads with blanks). */
  minRows?: number;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 22,
    paddingBottom: 22,
    paddingHorizontal: 24,
    fontFamily: "Helvetica",
    fontSize: 8.5,
    color: "#000",
  },
  frame: { borderWidth: 1, borderColor: BORDER },
  row: { flexDirection: "row" },
  cell: {
    borderWidth: 0.5,
    borderColor: BORDER,
    paddingVertical: 2,
    paddingHorizontal: 4,
    justifyContent: "center",
    minHeight: 17,
  },
  bold: { fontFamily: "Helvetica-Bold" },
  center: { textAlign: "center" },
  right: { textAlign: "right" },
  // `direction: "rtl"` sets the bidi base so Latin digits inside Dhivehi
  // text (GST %, vendor counts) come out in the right order.
  dv: { fontFamily: "Faruma", fontSize: 9, textAlign: "right", direction: "rtl" },
  dvC: { fontFamily: "Faruma", fontSize: 9, textAlign: "center", direction: "rtl" },
  org: { fontFamily: "MVWaheed", fontSize: 15, textAlign: "center" },
  orgSub: { fontFamily: "Faruma", fontSize: 9.5, textAlign: "center", direction: "rtl", marginTop: 1 },
  title: { fontFamily: "MVWaheed", fontSize: 14, textAlign: "center" },
  small: { fontSize: 6.5, color: "#333", textAlign: "center", marginTop: 1 },
  box: {
    width: 9,
    height: 9,
    borderWidth: 0.75,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  boxFill: { width: 5, height: 5, backgroundColor: BORDER },
  signImg: { maxHeight: 26, maxWidth: "90%", objectFit: "contain", alignSelf: "center" },
  smallSignImg: { maxHeight: 15, maxWidth: "95%", objectFit: "contain", alignSelf: "center" },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyStyle = any;

const fmt = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? NBSP : (formatNumberWithCommas(n) ?? NBSP);
const fmtQty = (n: number) =>
  Number.isInteger(n) ? String(n) : n.toLocaleString("en-US", { maximumFractionDigits: 2 });

// A cell holding text; Dhivehi text switches to Faruma automatically.
const Cell: React.FC<{
  w: number;
  children?: React.ReactNode;
  align?: "center" | "right";
  bg?: string;
  bold?: boolean;
  style?: AnyStyle;
}> = ({ w, children, align = "center", bg, bold, style }) => {
  const text = typeof children === "string" || typeof children === "number";
  const dv = typeof children === "string" && isDhivehi(children);
  return (
    <View style={[styles.cell, { width: `${w}%` }, bg ? { backgroundColor: bg } : null, style] as AnyStyle}>
      {text ? (
        <Text
          style={
            [
              dv ? (align === "right" ? styles.dv : styles.dvC) : align === "right" ? styles.right : styles.center,
              bold && !dv ? styles.bold : null,
            ] as AnyStyle
          }
        >
          {children === "" ? NBSP : children}
        </Text>
      ) : (
        (children ?? <Text>{NBSP}</Text>)
      )}
    </View>
  );
};

const Tick: React.FC<{ on: boolean }> = ({ on }) => (
  <View style={styles.box}>{on ? <View style={styles.boxFill} /> : null}</View>
);

const PriceEvaluationPdf: React.FC<{ data: PriceEvalPdfData }> = ({ data }) => {
  const comparison = computeComparison(data.items, data.vendors, data.gstRate);
  const minRows = data.minRows ?? 4;
  const rows = [
    ...data.items.map((it, i) => ({ item: it, index: i })),
    ...Array.from({ length: Math.max(0, minRows - data.items.length) }, () => null),
  ];
  // Vendors read right to left from cheapest to dearest: the lowest total
  // sits next to the item column, the highest at the far left. Vendors with
  // no prices go furthest left; ties keep their form order.
  const rank = (v: number) =>
    comparison.vendors[v]?.quotedAny ? comparison.vendors[v].total : Number.POSITIVE_INFINITY;
  const vendorOrder = Array.from({ length: VENDOR_COUNT }, (_, v) => v)
    .sort((a, b) => rank(a) - rank(b) || a - b)
    .reverse();
  const shade = (v: number) => (data.selectedVendor === v ? CHOSEN_BG : undefined);
  // The discount row is printed only when a vendor offered one, so other
  // evaluations match the paper form exactly.
  const anyDiscount = comparison.vendors.some((t) => t.discount > 0);

  return (
    <Document title={`Price Evaluation ${data.evalNum}`} author="National Archives of Maldives">
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.frame}>
          {/* ---------- Organisation + title ---------- */}
          <View style={{ paddingTop: 6, paddingBottom: 5 }}>
            <Text style={styles.org}>ދިވެހިރާއްޖޭގެ ޤައުމީ އަރުޝީފު</Text>
            <Text style={styles.orgSub}>މާލެ، ދިވެހިރާއްޖެ</Text>
          </View>
          <View style={[styles.cell, { backgroundColor: TITLE_BG, paddingVertical: 4 }]}>
            <Text style={styles.title}>އަގުބަލާ ފޯމް</Text>
          </View>

          {/* ---------- Section · number · date ---------- */}
          <View style={styles.row}>
            <Cell w={14}>{data.date}</Cell>
            <Cell w={6} align="right" bg={LABEL_BG}>ތާރީޚް:</Cell>
            <Cell w={14}>{data.evalNum}</Cell>
            <Cell w={10} align="right" bg={LABEL_BG}>ފޯމު ނަމްބަރު:</Cell>
            <Cell w={28} align="right">{data.section}</Cell>
            <Cell w={28} align="right" bg={LABEL_BG}>ތަކެތީ / ޚިދުމަތަށް އެދުނު ސެކްޝަން:</Cell>
          </View>

          {/* ---------- Budget availability ---------- */}
          <View style={styles.row}>
            <Cell w={24} align="right" bg={BUDGET_BG}>ބަޖެޓު ޗެކްކޮށްދިނީ</Cell>
            <Cell w={4}><Tick on={data.budgetAvailable === false} /></Cell>
            <Cell w={8} align="right">ނެތް</Cell>
            <Cell w={4}><Tick on={data.budgetAvailable === true} /></Cell>
            <Cell w={8} align="right">އެބަހުރި</Cell>
            <Cell w={24} align="right" bg={LABEL_BG}>މި ޚަރަދު ކުރުމަށް ބަޖެޓުގައި ފައިސާ</Cell>
            <Cell w={28} align="right" bg={LABEL_BG}>{`އަގުބެލި ގޮތް : ${data.method}`}</Cell>
          </View>
          <View style={styles.row}>
            <Cell w={10}>
              {data.budgetCheckedBy.signature ? (
                // react-pdf <Image> has no `alt` (it's PDF, not HTML).
                // eslint-disable-next-line jsx-a11y/alt-text
                <Image src={data.budgetCheckedBy.signature} style={styles.smallSignImg} />
              ) : null}
            </Cell>
            <Cell w={14}>{data.budgetCheckedBy.name ?? ""}</Cell>
            <Cell w={9.5} align="right" bg={BUDGET_BG}>ނަމާއި ސޮއި</Cell>
            <Cell w={12.5}>{data.budgetBalance == null ? "" : fmt(data.budgetBalance)}</Cell>
            <Cell w={9} align="right" bg={LABEL_BG}>ކޯޑު ބާކީ</Cell>
            <Cell w={8}>{String(data.glCode)}</Cell>
            <Cell w={9} align="right" bg={LABEL_BG}>ބަޖެޓް ކޯޑް</Cell>
            <Cell w={28} align="right" bg={LABEL_BG}>ބަޖެޓު ހުރި / ނެތް ބެލުން</Cell>
          </View>

          {/* ---------- Comparison ---------- */}
          {/* Two header rows for the vendors; the item heading spans both. */}
          <View style={styles.row}>
            <View style={{ width: `${100 - ITEM_W}%` }}>
              <View style={styles.row}>
                {vendorOrder.map((v) => {
                  const vendor = data.vendors[v];
                  const foreign = vendor && vendor.currency !== "MVR";
                  return (
                    <Cell key={v} w={rebase(V.total + V.rate + V.qty)} bg={shade(v)}>
                      <Text style={[isDhivehi(vendor?.name ?? "") ? styles.dvC : [styles.center, styles.bold]] as AnyStyle}>
                        {vendor?.name || NBSP}
                      </Text>
                      {foreign ? (
                        <Text style={styles.small}>
                          {`${vendor.currency} @ ${vendor.exchangeRate}`}
                        </Text>
                      ) : null}
                    </Cell>
                  );
                })}
              </View>
              <View style={styles.row}>
                {vendorOrder.map((v) => (
                  <React.Fragment key={v}>
                    <Cell w={rebase(V.total)} bg={shade(v)}>ޖުމްލަ</Cell>
                    <Cell w={rebase(V.rate)} bg={shade(v)}>ރޭޓް</Cell>
                    <Cell w={rebase(V.qty)} bg={shade(v)}>އަދަދު</Cell>
                  </React.Fragment>
                ))}
              </View>
            </View>
            <View style={[styles.cell, { width: `${ITEM_W}%`, backgroundColor: ITEM_HEAD_BG }] as AnyStyle}>
              <Text style={styles.dvC}>ތަކެތީ / ޚިދުމަތުގެ ނަން</Text>
            </View>
          </View>

          {rows.map((r, i) => (
            <View style={styles.row} key={i} wrap={false}>
              {vendorOrder.map((v) => {
                if (!r) {
                  return (
                    <React.Fragment key={v}>
                      <Cell w={V.total} bg={shade(v)}>{""}</Cell>
                      <Cell w={V.rate} bg={shade(v)}>{""}</Cell>
                      <Cell w={V.qty} bg={shade(v)}>{""}</Cell>
                    </React.Fragment>
                  );
                }
                const rate = r.item.rates[v];
                const vendor = data.vendors[v];
                const line = comparison.vendors[v]?.lines[r.index];
                return (
                  <React.Fragment key={v}>
                    <Cell w={V.total} bg={shade(v)}>{line == null ? "-" : fmt(line)}</Cell>
                    <Cell w={V.rate} bg={shade(v)}>
                      {rate == null || !vendor ? "" : fmt(unitMvr(rate, vendor.exchangeRate))}
                    </Cell>
                    <Cell w={V.qty} bg={shade(v)}>{rate == null ? "" : fmtQty(r.item.qty)}</Cell>
                  </React.Fragment>
                );
              })}
              <Cell w={ITEM_W} align={r && isDhivehi(r.item.name) ? "right" : "center"}>
                {r ? r.item.name : ""}
              </Cell>
            </View>
          ))}

          {/* Discount (only when offered) */}
          {anyDiscount ? (
            <View style={styles.row}>
              {vendorOrder.map((v) => {
                const t = comparison.vendors[v];
                const pct = data.vendors[v]?.discountPercent;
                return (
                  <React.Fragment key={v}>
                    <Cell w={V.total} bg={shade(v)}>{t && t.discount > 0 ? `-${fmt(t.discount)}` : "-"}</Cell>
                    <Cell w={V.rate + V.qty} bg={shade(v)}>{t && t.discount > 0 && pct ? `${pct}%` : ""}</Cell>
                  </React.Fragment>
                );
              })}
              <Cell w={ITEM_W} align="right">ޑިސްކައުންޓް</Cell>
            </View>
          ) : null}
          {/* GST */}
          <View style={styles.row}>
            {vendorOrder.map((v) => {
              const t = comparison.vendors[v];
              return (
                <React.Fragment key={v}>
                  <Cell w={V.total} bg={shade(v)}>{t && t.gst > 0 ? fmt(t.gst) : "-"}</Cell>
                  <Cell w={V.rate + V.qty} bg={shade(v)}>{""}</Cell>
                </React.Fragment>
              );
            })}
            <Cell w={ITEM_W} align="right">{`${data.gstRate}% ޖީ.އެސް.ޓީ`}</Cell>
          </View>
          {/* Totals */}
          <View style={styles.row}>
            {vendorOrder.map((v) => {
              const t = comparison.vendors[v];
              return (
                <React.Fragment key={v}>
                  <Cell w={V.total} bold bg={shade(v)}>{t && t.quotedAny ? fmt(t.total) : "-"}</Cell>
                  <Cell w={V.rate + V.qty} bg={shade(v)}>{""}</Cell>
                </React.Fragment>
              );
            })}
            <Cell w={ITEM_W} align="right" bg={LABEL_BG}>ޖުމްލަ</Cell>
          </View>

          {/* ---------- Reason ---------- */}
          <View style={styles.row}>
            <View style={[styles.cell, { width: "100%", minHeight: 26 }]}>
              <Text style={styles.dv}>
                {`ތަކެތި/ޚިދުމަތް ހޯދަން އަގަށް އެއްބަސްވި ސަބަބު: ${data.selectionReason}`}
              </Text>
            </View>
          </View>

          {/* ---------- Signatures (RTL: prepared · checked · approved) ---------- */}
          <View style={styles.row}>
            {(
              [
                ["ހަރަދު ކުރުމުގެ ހުއްދަ ދެއްވި", data.approvedBy, 33],
                ["ޗެކްކުރި:", data.checkedBy, 33],
                ["މަޢުލޫމާތު ސާފުކޮށް ތައްޔާރުކުރީ:", data.preparedBy, 34],
              ] as const
            ).map(([label, person, w]) => (
              <View key={label} style={{ width: `${w}%` }}>
                <Cell w={100} align="right" bg={SIGN_HEAD_BG}>{label}</Cell>
                <View style={styles.row}>
                  <View style={[styles.cell, { width: "75%", minHeight: 32 }]}>
                    {person.signature ? (
                      // eslint-disable-next-line jsx-a11y/alt-text
                      <Image src={person.signature} style={styles.signImg} />
                    ) : (
                      <Text>{NBSP}</Text>
                    )}
                  </View>
                  <Cell w={25} align="right">ސޮއި:</Cell>
                </View>
                <View style={styles.row}>
                  <Cell w={75} align="right">{person.name ?? ""}</Cell>
                  <Cell w={25} align="right">ނަން:</Cell>
                </View>
                <View style={styles.row}>
                  <Cell w={75} align="right">{person.designation ?? ""}</Cell>
                  <Cell w={25} align="right">މަޤާމް:</Cell>
                </View>
              </View>
            ))}
          </View>
        </View>
      </Page>
    </Document>
  );
};

export default PriceEvaluationPdf;
