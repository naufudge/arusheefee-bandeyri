import { getAttr, numToCol, parseAttrs, type XlsxTemplate } from "./xlsx-template";

// Reads a filled sheet's printed layout (column widths, row heights, text,
// fonts, borders, merges, images) so the PDF can draw it cell for cell, the
// way Excel prints it. Positions are in points, from the top-left of the
// print range, before any fit-to-page scaling.

export type BorderStyle = "thin" | "hair" | "medium" | "thick" | "dashed" | "dotted" | "double";
type Borders = { top?: BorderStyle; right?: BorderStyle; bottom?: BorderStyle; left?: BorderStyle };

export type LayoutBox = { x: number; y: number; w: number; h: number; borders: Borders };

export type LayoutText = {
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  bold: boolean;
  italic: boolean;
  size: number;
  align: "left" | "center" | "right";
  valign: "top" | "center" | "bottom";
  wrap: boolean;
};

export type LayoutImage = { src: string; x: number; y: number; w: number; h: number };

export type SheetLayout = {
  width: number;
  height: number;
  orientation: "portrait" | "landscape";
  margins: { top: number; right: number; bottom: number; left: number };
  boxes: LayoutBox[];
  texts: LayoutText[];
  images: LayoutImage[];
  /** Left edge of each column by letter, and the top of each row by number. */
  colX: Record<string, number>;
  colW: Record<string, number>;
  rowY: Record<number, number>;
  rowH: Record<number, number>;
};

type Xf = {
  numFmt: string;
  bold: boolean;
  italic: boolean;
  size: number;
  borders: Borders;
  horizontal?: string;
  vertical?: string;
  wrap: boolean;
};

const EMU_PER_PT = 12700;

// Built-in formats the templates rely on (ECMA-376 §18.8.30).
const BUILTIN_FORMATS: Record<number, string> = {
  0: "General",
  1: "0",
  2: "0.00",
  3: "#,##0",
  4: "#,##0.00",
  9: "0%",
  10: "0.00%",
  14: "m/d/yyyy",
  22: "m/d/yyyy h:mm",
  37: "#,##0 ;(#,##0)",
  38: "#,##0 ;[Red](#,##0)",
  39: "#,##0.00;(#,##0.00)",
  40: "#,##0.00;[Red](#,##0.00)",
  43: '_(* #,##0.00_);_(* \\(#,##0.00\\);_(* "-"??_);_(@_)',
  44: '_("$"* #,##0.00_);_("$"* \\(#,##0.00\\);_("$"* "-"??_);_(@_)',
  49: "@",
};

/** Excel's column width (in characters) to points, for Calibri 11 (max digit width 7px). */
export function columnWidthPt(width: number): number {
  const px = Math.trunc(((256 * width + Math.trunc(128 / 7)) / 256) * 7);
  return px * 0.75;
}

async function readStyles(book: XlsxTemplate): Promise<Xf[]> {
  const xml = await book.text("xl/styles.xml");
  const numFmts = new Map<number, string>();
  for (const m of xml.matchAll(/<numFmt\b([^>]*)\/>/g)) {
    const a = parseAttrs(m[1]);
    numFmts.set(Number(getAttr(a, "numFmtId")), unescapeAttr(getAttr(a, "formatCode") ?? "General"));
  }
  const fonts = [...(/<fonts\b[^>]*>([\s\S]*?)<\/fonts>/.exec(xml)?.[1] ?? "").matchAll(/<font\b[^>]*?(?:\/>|>([\s\S]*?)<\/font>)/g)].map(
    (m) => {
      const f = m[1] ?? "";
      return {
        bold: /<b\/>|<b val="(?:1|true)"\/>/.test(f),
        italic: /<i\/>|<i val="(?:1|true)"\/>/.test(f),
        size: Number(/<sz val="([\d.]+)"/.exec(f)?.[1] ?? 11),
      };
    },
  );
  const borders = [...(/<borders\b[^>]*>([\s\S]*?)<\/borders>/.exec(xml)?.[1] ?? "").matchAll(/<border\b[^>]*?(?:\/>|>([\s\S]*?)<\/border>)/g)].map(
    (m) => {
      const b = m[1] ?? "";
      const side = (s: string) => /^(thin|hair|medium|thick|dashed|dotted|double)/.exec(new RegExp(`<${s} style="(\\w+)"`).exec(b)?.[1] ?? "")?.[1] as BorderStyle | undefined;
      return { top: side("top"), right: side("right"), bottom: side("bottom"), left: side("left") };
    },
  );
  const xfsXml = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml)?.[1] ?? "";
  return [...xfsXml.matchAll(/<xf\b([^>]*?)(?:\/>|>([\s\S]*?)<\/xf>)/g)].map((m) => {
    const a = parseAttrs(m[1]);
    const align = parseAttrs(/<alignment\b([^>]*)\/?>/.exec(m[2] ?? "")?.[1] ?? "");
    const numFmtId = Number(getAttr(a, "numFmtId") ?? 0);
    const font = fonts[Number(getAttr(a, "fontId") ?? 0)] ?? { bold: false, italic: false, size: 11 };
    return {
      numFmt: numFmts.get(numFmtId) ?? BUILTIN_FORMATS[numFmtId] ?? "General",
      bold: font.bold,
      italic: font.italic,
      size: font.size,
      borders: borders[Number(getAttr(a, "borderId") ?? 0)] ?? {},
      horizontal: getAttr(align, "horizontal"),
      vertical: getAttr(align, "vertical"),
      wrap: getAttr(align, "wrapText") === "1",
    };
  });
}

const unescapeAttr = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&apos;/g, "'").replace(/&amp;/g, "&");

const pad2 = (n: number) => String(n).padStart(2, "0");

/** A number as Excel displays it with this format code (the subset the templates use). */
export function formatNumber(v: number, code: string): string {
  if (code === "General") {
    return Number.isInteger(v) ? String(v) : String(Number(v.toPrecision(11)));
  }
  const sections = code.split(";");
  // What a section displays: no quoted text, colour tags, padding or fill.
  const plain = (s: string) =>
    s.replace(/"[^"]*"|\[[^\]]*\]|\\.|_.|\*./g, (m) => (m.startsWith("\\") ? m[1] : ""));
  const pick = v > 0 || sections.length === 1 ? sections[0] : v < 0 ? (sections[1] ?? sections[0]) : (sections[2] ?? sections[0]);
  const visible = plain(pick);

  if (/[yd]/i.test(visible) || /m\/|\/m/i.test(visible)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v * 86_400_000));
    const y = d.getUTCFullYear();
    const mo = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    if (/yyyy-mm-dd/i.test(visible)) return `${y}-${pad2(mo)}-${pad2(day)}`;
    if (/dd\.mm\.yyyy/i.test(visible)) return `${pad2(day)}.${pad2(mo)}.${y}`;
    return `${mo}/${day}/${y}`;
  }
  // The zero section of an accounting format shows a dash.
  if (v === 0 && sections.length >= 3 && /"-"/.test(sections[2])) return "-";

  const decimals = /\.(0+)/.exec(visible)?.[1].length ?? 0;
  const grouped = /#,##/.test(visible);
  const abs = Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: grouped,
  });
  if (v < 0) return sections.length > 1 && /\(/.test(visible) ? `(${abs})` : `-${abs}`;
  return abs;
}

/**
 * The printed layout of `sheetName`. Call after the workbook is finalised so
 * formula cells carry their cached results.
 */
export async function sheetLayout(book: XlsxTemplate, sheetName: string): Promise<SheetLayout> {
  const sheet = book.sheet(sheetName);
  const xfs = await readStyles(book);
  const frame = sheet.frameXml();

  // Column widths.
  const fmt = parseAttrs(/<sheetFormatPr\b([^>]*)\/?>/.exec(frame)?.[1] ?? "");
  const defaultColPt = getAttr(fmt, "defaultColWidth") ? columnWidthPt(Number(getAttr(fmt, "defaultColWidth"))) : 48;
  const defaultRowPt = Number(getAttr(fmt, "defaultRowHeight") ?? 15);
  const colWidth = new Map<number, number>();
  for (const m of frame.matchAll(/<col\b([^>]*)\/>/g)) {
    const a = parseAttrs(m[1]);
    const w = getAttr(a, "hidden") === "1" ? 0 : columnWidthPt(Number(getAttr(a, "width") ?? 8.43));
    for (let c = Number(getAttr(a, "min")); c <= Number(getAttr(a, "max")); c++) colWidth.set(c, w);
  }
  const widthOf = (c: number) => colWidth.get(c) ?? defaultColPt;

  const rows = sheet.rowsForLayout();
  const rowHeight = new Map(rows.map((r) => [r.r, r.hidden ? 0 : (r.ht ?? defaultRowPt)]));
  const heightOf = (r: number) => rowHeight.get(r) ?? defaultRowPt;

  const merges = [...frame.matchAll(/<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"/g)].map((m) => ({
    c1: colNum(m[1]),
    r1: Number(m[2]),
    c2: colNum(m[3]),
    r2: Number(m[4]),
  }));

  // Images and where they sit.
  const anchors = await readImages(book, sheet.path, frame);

  // Print range: the sheet's print area, otherwise everything that prints.
  let maxCol = 1;
  let maxRow = 1;
  const printArea = await readPrintArea(book, sheetName);
  if (printArea) {
    maxCol = printArea.c2;
    maxRow = printArea.r2;
  } else {
    for (const row of rows) {
      for (const cell of row.cells) {
        const ref = `${numToCol(cell.col)}${row.r}`;
        const xf = cell.style !== undefined ? xfs[cell.style] : undefined;
        const hasBorder = xf && Object.values(xf.borders).some(Boolean);
        if ((sheet.value(ref) ?? "") !== "" || hasBorder) {
          maxCol = Math.max(maxCol, cell.col);
          maxRow = Math.max(maxRow, row.r);
        }
      }
    }
    for (const m of merges) {
      if (sheet.value(`${numToCol(m.c1)}${m.r1}`) !== null) {
        maxCol = Math.max(maxCol, m.c2);
        maxRow = Math.max(maxRow, m.r2);
      }
    }
    for (const a of anchors) {
      maxCol = Math.max(maxCol, a.toCol + 1);
      maxRow = Math.max(maxRow, a.toRow + 1);
    }
  }

  const colX: Record<string, number> = {};
  const colW: Record<string, number> = {};
  let x = 0;
  for (let c = 1; c <= maxCol + 26; c++) {
    colX[numToCol(c)] = x;
    colW[numToCol(c)] = widthOf(c);
    x += widthOf(c);
  }
  const rowY: Record<number, number> = {};
  const rowH: Record<number, number> = {};
  let y = 0;
  for (let r = 1; r <= maxRow + 50; r++) {
    rowY[r] = y;
    rowH[r] = heightOf(r);
    y += heightOf(r);
  }
  const width = colX[numToCol(maxCol + 1)];
  const height = rowY[maxRow + 1];

  const mergeAt = (c: number, r: number) => merges.find((m) => c >= m.c1 && c <= m.c2 && r >= m.r1 && r <= m.r2);
  const textAt = (c: number, r: number) => {
    const v = sheet.value(`${numToCol(c)}${r}`);
    return v !== null && v !== "";
  };

  const boxes: LayoutBox[] = [];
  const texts: LayoutText[] = [];
  for (const row of rows) {
    if (row.r > maxRow || rowHeight.get(row.r) === 0) continue;
    for (const cell of row.cells) {
      if (cell.col > maxCol) continue;
      const col = numToCol(cell.col);
      const xf = cell.style !== undefined ? xfs[cell.style] : xfs[0];
      if (!xf) continue;
      const box = { x: colX[col], y: rowY[row.r], w: colW[col], h: rowH[row.r] };
      const merge = mergeAt(cell.col, row.r);
      // Inside a merged range Excel draws only the range's outline.
      const borders: Borders = merge
        ? {
            top: row.r === merge.r1 ? xf.borders.top : undefined,
            bottom: row.r === merge.r2 ? xf.borders.bottom : undefined,
            left: cell.col === merge.c1 ? xf.borders.left : undefined,
            right: cell.col === merge.c2 ? xf.borders.right : undefined,
          }
        : xf.borders;
      if (Object.values(borders).some(Boolean)) boxes.push({ ...box, borders });

      if (merge && (merge.c1 !== cell.col || merge.r1 !== row.r)) continue; // covered by its merge
      const value = sheet.value(`${col}${row.r}`);
      if (value === null || value === "") continue;
      const isNumber = typeof value === "number";
      const text = isNumber ? formatNumber(value, xf.numFmt) : value;

      let rect = box;
      if (merge) {
        rect = {
          x: colX[numToCol(merge.c1)],
          y: rowY[merge.r1],
          w: colX[numToCol(merge.c2 + 1)] - colX[numToCol(merge.c1)],
          h: rowY[merge.r2 + 1] - rowY[merge.r1],
        };
      }
      const horizontal = xf.horizontal ?? "general";
      const align: LayoutText["align"] =
        horizontal === "center" || horizontal === "centerContinuous"
          ? "center"
          : horizontal === "right" || (horizontal === "general" && isNumber)
            ? "right"
            : isNumber && /_\(|_-/.test(xf.numFmt)
              ? "right"
              : "left";
      // Like Excel, unwrapped left-aligned text runs on over empty cells.
      if (!merge && !xf.wrap && align === "left") {
        let c = cell.col + 1;
        while (c <= maxCol && !textAt(c, row.r) && !mergeAt(c, row.r)) c++;
        rect = { ...rect, w: colX[numToCol(c)] - rect.x };
      }
      texts.push({
        ...rect,
        text,
        bold: xf.bold,
        italic: xf.italic,
        size: xf.size,
        align,
        valign: xf.vertical === "center" ? "center" : xf.vertical === "top" ? "top" : "bottom",
        wrap: xf.wrap,
      });
    }
  }

  const images: LayoutImage[] = anchors.map((a) => ({
    src: a.src,
    x: colX[numToCol(a.fromCol + 1)] + a.colOff / EMU_PER_PT,
    y: rowY[a.fromRow + 1] + a.rowOff / EMU_PER_PT,
    w: a.cx / EMU_PER_PT,
    h: a.cy / EMU_PER_PT,
  }));

  const setup = parseAttrs(/<pageSetup\b([^>]*)\/?>/.exec(frame)?.[1] ?? "");
  const pm = parseAttrs(/<pageMargins\b([^>]*)\/?>/.exec(frame)?.[1] ?? "");
  const inch = (name: string, fallback: number) => Number(getAttr(pm, name) ?? fallback) * 72;

  return {
    width,
    height,
    orientation: getAttr(setup, "orientation") === "landscape" ? "landscape" : "portrait",
    margins: { top: inch("top", 0.75), right: inch("right", 0.7), bottom: inch("bottom", 0.75), left: inch("left", 0.7) },
    boxes,
    texts,
    images,
    colX,
    colW,
    rowY,
    rowH,
  };
}

function colNum(col: string): number {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

type Anchor = {
  src: string;
  fromCol: number;
  fromRow: number;
  colOff: number;
  rowOff: number;
  toCol: number;
  toRow: number;
  cx: number;
  cy: number;
};

async function readImages(book: XlsxTemplate, sheetPath: string, frame: string): Promise<Anchor[]> {
  const drawingPath = await book.drawingPathFor(sheetPath, frame);
  if (!drawingPath) return [];
  const xml = await book.text(drawingPath);
  const rels = await book.relationships(drawingPath);
  const out: Anchor[] = [];
  for (const m of xml.matchAll(/<xdr:(twoCellAnchor|oneCellAnchor)\b[^>]*>([\s\S]*?)<\/xdr:\1>/g)) {
    const body = m[2];
    const embed = /r:embed="([^"]+)"/.exec(body)?.[1];
    const media = embed ? rels.get(embed) : undefined;
    const file = media ? book.zip.file(media) : null;
    if (!file) continue;
    const point = (tag: string) => {
      const p = new RegExp(`<xdr:${tag}>([\\s\\S]*?)</xdr:${tag}>`).exec(body)?.[1] ?? "";
      const n = (k: string) => Number(new RegExp(`<xdr:${k}>(\\d+)</xdr:${k}>`).exec(p)?.[1] ?? 0);
      return { col: n("col"), colOff: n("colOff"), row: n("row"), rowOff: n("rowOff") };
    };
    const from = point("from");
    const to = m[1] === "twoCellAnchor" ? point("to") : from;
    const ext = /<a:ext cx="(\d+)" cy="(\d+)"/.exec(body);
    const ext2 = /<xdr:ext cx="(\d+)" cy="(\d+)"/.exec(body);
    const size = ext ?? ext2;
    if (!size) continue;
    const mime = media!.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
    out.push({
      src: `data:${mime};base64,${await file.async("base64")}`,
      fromCol: from.col,
      fromRow: from.row,
      colOff: from.colOff,
      rowOff: from.rowOff,
      toCol: to.col,
      toRow: to.row,
      cx: Number(size[1]),
      cy: Number(size[2]),
    });
  }
  return out;
}

async function readPrintArea(book: XlsxTemplate, sheetName: string) {
  const xml = await book.text("xl/workbook.xml");
  const names = [...xml.matchAll(/<sheet\b([^>]*)\/>/g)].map((m) => getAttr(parseAttrs(m[1]), "name"));
  const index = names.indexOf(sheetName);
  for (const m of xml.matchAll(/<definedName\b([^>]*)>([^<]*)<\/definedName>/g)) {
    const a = parseAttrs(m[1]);
    if (getAttr(a, "name") !== "_xlnm.Print_Area" || Number(getAttr(a, "localSheetId")) !== index) continue;
    const r = /\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)/.exec(m[2]);
    if (r) return { c1: colNum(r[1]), r1: Number(r[2]), c2: colNum(r[3]), r2: Number(r[4]) };
  }
  return null;
}
