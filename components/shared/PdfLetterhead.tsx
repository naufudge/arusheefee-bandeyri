"use client";

import React from "react";
import { View, Image, StyleSheet } from "@react-pdf/renderer";

const BORDER = "#000000";

const styles = StyleSheet.create({
  // Top band: Bismillah + national emblem, centred above the logo row.
  crest: {
    alignItems: "center",
    marginBottom: 4,
  },
  // Second band: optional Number / Date on the left, Archives logo on the right.
  logoRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingBottom: 8,
  },
  logoSide: { flex: 1, justifyContent: "flex-end" },
  // Bismillah calligraphy, text-sized, sits directly above the emblem.
  bismi: { height: 18, objectFit: "contain", marginBottom: 2 },
  emblem: { height: 28, objectFit: "contain" },
  fullLogo: { height: 90, objectFit: "contain" },
  rule: { borderBottomWidth: 1.5, borderColor: BORDER },
});

/**
 * Shared National Archives letterhead for the @react-pdf/renderer forms
 * (treasury reconciliation, GSR requisition, petty cash).
 *
 * Layout:
 *   1. Bismillah + national emblem (centred, top)
 *   2. Optional left slot (e.g. Number / Date) + Archives logo (same row)
 *   3. Horizontal rule
 */
const PdfLetterhead: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => (
  <>
    <View style={styles.crest}>
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <Image src="/bismi.png" style={styles.bismi} />
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <Image src="/emblem.png" style={styles.emblem} />
    </View>
    <View style={styles.logoRow}>
      <View style={styles.logoSide}>{children}</View>
      <View style={[styles.logoSide, { alignItems: "flex-end" }]}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src="/full-logo.png" style={styles.fullLogo} />
      </View>
    </View>
    <View style={styles.rule} />
  </>
);

export default PdfLetterhead;
