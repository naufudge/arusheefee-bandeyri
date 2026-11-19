// Carlito advance widths (per 1000 em) for ASCII 32–126. Carlito is
// metric-compatible with Calibri, so this tells the PDFs that copy an Excel
// print when a value runs past its box the way Excel would see it.
const REG_W = [226,326,401,498,507,715,682,221,303,303,498,498,250,306,252,386,507,507,507,507,507,507,507,507,507,507,268,268,498,498,498,463,894,579,544,533,615,488,459,631,623,252,319,520,420,855,646,662,517,673,543,459,487,642,567,890,519,487,468,307,386,307,498,498,291,479,525,423,525,498,305,471,525,229,239,455,229,799,525,527,525,525,349,391,335,525,452,715,433,453,395,314,460,314,498];
const BOLD_W = [226,326,438,498,507,729,705,233,312,312,498,498,258,306,267,430,507,507,507,507,507,507,507,507,507,507,276,276,498,498,498,463,898,606,561,529,630,488,459,637,631,267,331,547,423,874,659,676,532,686,563,473,495,653,591,906,551,520,478,325,430,325,498,498,300,494,537,418,537,503,316,474,537,246,255,480,246,813,537,538,537,537,355,399,347,537,473,745,459,474,397,344,475,344,498];

/** Width of `text` in points when set in Carlito at `size`. */
export function carlitoWidth(text: string, bold: boolean, size: number): number {
  const table = bold ? BOLD_W : REG_W;
  let units = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    units += code >= 32 && code <= 126 ? table[code - 32] : 520;
  }
  return (units / 1000) * size;
}
