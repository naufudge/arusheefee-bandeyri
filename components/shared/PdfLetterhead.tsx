"use client";

import React from "react";
import { View, Image, StyleSheet } from "@react-pdf/renderer";

const BORDER = "#000000";

const styles = StyleSheet.create({
  // ----- Letterhead -----
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingBottom: 8,
  },
  // Balanced left/right cells keep the centered emblem on the page centre.
  headerSide: { width: 96 },
  headerCenter: { flex: 1, alignItems: "center", paddingHorizontal: 8 },
  // Bismillah calligraphy, text-sized, sits directly above the emblem.
  bismi: { height: 18, objectFit: "contain", marginBottom: 2 },
  emblem: { height: 28, objectFit: "contain" },
  // Portrait mark + wordmark; larger, and nudged down so it sits lower than the emblem.
  fullLogo: { height: 90, objectFit: "contain", marginTop: 30 },
  rule: { borderBottomWidth: 1.5, borderColor: BORDER },
});

/**
 * Shared National Archives letterhead for the @react-pdf/renderer forms
 * (treasury reconciliation, GSR requisition, petty cash). Renders the
 * Bismillah calligraphy above a centred national emblem, the full Archives
 * logo lower on the right, then the horizontal rule. Edit here to update the
 * header on every form at once.
 */
const PdfLetterhead: React.FC = () => (
  <>
    <View style={styles.header}>
      <View style={styles.headerSide} />
      <View style={styles.headerCenter}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src="/bismi.png" style={styles.bismi} />
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src="/emblem.png" style={styles.emblem} />
      </View>
      <View style={[styles.headerSide, { alignItems: "flex-end" }]}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src="/full-logo.png" style={styles.fullLogo} />
      </View>
    </View>
    <View style={styles.rule} />
  </>
);

export default PdfLetterhead;
