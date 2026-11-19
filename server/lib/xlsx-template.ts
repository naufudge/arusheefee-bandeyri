import JSZip from "jszip";

// Fills an official .xlsx template by editing cell XML directly. Unlike a
// round trip through exceljs, every part we don't touch (styles, logos,
// printer settings, sensitivity label, custom properties) stays byte-for-byte
// as the issuer made it. Supports exactly what the Fiyes templates need:
// plain values, simple-reference formulas and rebuilding a block of rows;
// anything else fails loudly rather than producing a subtly broken file.

export type CellValue = string | number | null;

type Attr = [name: string, value: string];
type Cell = { col: number; attrs: Attr[]; inner: string };
type Row = { r: number; attrs: Attr[]; cells: Cell[]; selfClosing: boolean };

// "A22", "$C$3", "Data_Entry!C3" or "'Sheet name'!C3".
const SIMPLE_REF = /^(?:(?:'([^']+)'|([A-Za-z_][\w.]*))!)?\$?([A-Z]{1,3})\$?(\d+)$/;
const FORMULA = /<f(?:\s[^>]*)?>([\s\S]*?)<\/f>/;
const HAS_FORMULA = /<f[\s>/]/;

export function colToNum(col: string): number {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

export function numToCol(n: number): string {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function splitRef(ref: string): { col: number; row: number } {
  const m = /^([A-Z]{1,3})(\d+)$/.exec(ref);
  if (!m) throw new Error(`Bad cell reference "${ref}"`);
  return { col: colToNum(m[1]), row: Number(m[2]) };
}

export function escapeXml(s: string): string {
  return s
    // Control characters are illegal in XML 1.0 and would corrupt the file.
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

export const parseAttrs = (s: string): Attr[] =>
  [...s.matchAll(/([\w:]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]);

const attrsXml = (attrs: Attr[]) => attrs.map(([k, v]) => ` ${k}="${v}"`).join("");

export const getAttr = (attrs: Attr[], name: string) => attrs.find(([k]) => k === name)?.[1];

function setAttr(attrs: Attr[], name: string, value: string | null): Attr[] {
  const i = attrs.findIndex(([k]) => k === name);
  if (value === null) return i === -1 ? attrs : attrs.filter(([k]) => k !== name);
  if (i === -1) return [...attrs, [name, value]];
  const out = [...attrs];
  out[i] = [name, value];
  return out;
}

/** A <t> element, with `xml:space` when Excel needs it to keep edge whitespace. */
const textElement = (text: string) =>
  /^\s|\s$|[\n\t]/.test(text)
    ? `<t xml:space="preserve">${escapeXml(text)}</t>`
    : `<t>${escapeXml(text)}</t>`;

/** Visible text of an <si> or <is>: its runs, without phonetic hints. */
function plainText(inner: string): string {
  return [...inner.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "").matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
    .map((m) => unescapeXml(m[1]))
    .join("");
}

class SharedStrings {
  private items: string[] = []; // inner XML of each <si>
  private texts: string[] = [];
  private rootAttrs: Attr[] = [];
  private prolog = "";
  changed = false;

  constructor(xml: string | null) {
    if (!xml) {
      this.prolog = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
      this.rootAttrs = [["xmlns", "http://schemas.openxmlformats.org/spreadsheetml/2006/main"]];
      return;
    }
    const root = /<sst\b([^>]*)>/.exec(xml);
    if (!root) throw new Error("sharedStrings.xml has no <sst> root");
    this.prolog = xml.slice(0, root.index);
    this.rootAttrs = parseAttrs(root[1]);
    for (const m of xml.matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)) {
      const inner = m[1] ?? "";
      this.items.push(inner);
      this.texts.push(plainText(inner));
    }
  }

  text(index: number): string {
    const t = this.texts[index];
    if (t === undefined) throw new Error(`Shared string ${index} doesn't exist`);
    return t;
  }

  indexOf(text: string): number {
    const found = this.texts.indexOf(text);
    if (found !== -1) return found;
    this.items.push(textElement(text));
    this.texts.push(text);
    this.changed = true;
    return this.texts.length - 1;
  }

  /** Blanks strings no cell uses (e.g. a template's sample names), without renumbering. */
  blankUnused(used: Set<number>) {
    for (let i = 0; i < this.items.length; i++) {
      if (!used.has(i) && this.texts[i] !== "") {
        this.items[i] = "<t></t>";
        this.texts[i] = "";
        this.changed = true;
      }
    }
  }

  toXml(referenceCount: number): string {
    let attrs = setAttr(this.rootAttrs, "count", String(referenceCount));
    attrs = setAttr(attrs, "uniqueCount", String(this.items.length));
    return `${this.prolog}<sst${attrsXml(attrs)}>${this.items.map((i) => `<si>${i}</si>`).join("")}</sst>`;
  }
}

export class XlsxSheet {
  private head = "";
  private tail = "";
  private rows: Row[] = [];
  dirty = false;

  constructor(
    private book: XlsxTemplate,
    readonly name: string,
    readonly path: string,
    private original: string,
    /** 0-based "from" rows of the images anchored on this sheet. */
    readonly anchorRows: number[],
  ) {
    const open = /<sheetData\s*\/>|<sheetData\b[^>]*>/.exec(original);
    if (!open) throw new Error(`Sheet "${name}" has no <sheetData>`);
    if (open[0].endsWith("/>")) {
      this.head = original.slice(0, open.index) + "<sheetData>";
      this.tail = "</sheetData>" + original.slice(open.index + open[0].length);
      return;
    }
    const close = original.indexOf("</sheetData>", open.index);
    this.head = original.slice(0, open.index + open[0].length);
    this.tail = original.slice(close);
    const body = original.slice(open.index + open[0].length, close);
    for (const m of body.matchAll(/<row\b([^>]*?)(\/>|>([\s\S]*?)<\/row>)/g)) {
      const attrs = parseAttrs(m[1]);
      const cells: Cell[] = [];
      for (const c of (m[3] ?? "").matchAll(/<c\b([^>]*?)(\/>|>([\s\S]*?)<\/c>)/g)) {
        const cAttrs = parseAttrs(c[1]);
        cells.push({ col: splitRef(getAttr(cAttrs, "r") ?? "").col, attrs: cAttrs, inner: c[3] ?? "" });
      }
      this.rows.push({ r: Number(getAttr(attrs, "r")), attrs, cells, selfClosing: m[2] === "/>" });
    }
  }

  private findRow(r: number): Row | undefined {
    return this.rows.find((x) => x.r === r);
  }

  private findCell(ref: string): Cell | undefined {
    const { col, row } = splitRef(ref);
    return this.findRow(row)?.cells.find((c) => c.col === col);
  }

  private ensureCell(ref: string): Cell {
    const { col, row: r } = splitRef(ref);
    let row = this.findRow(r);
    if (!row) {
      row = { r, attrs: [["r", String(r)]], cells: [], selfClosing: false };
      this.rows.push(row);
      this.rows.sort((a, b) => a.r - b.r);
    }
    let cell = row.cells.find((c) => c.col === col);
    if (!cell) {
      cell = { col, attrs: [["r", ref]], inner: "" };
      row.cells.push(cell);
      row.cells.sort((a, b) => a.col - b.col);
      row.selfClosing = false;
    }
    return cell;
  }

  styleOf(ref: string): number | undefined {
    const s = this.findCell(ref) && getAttr(this.findCell(ref)!.attrs, "s");
    return s === undefined ? undefined : Number(s);
  }

  formulaOf(ref: string): string | undefined {
    const m = FORMULA.exec(this.findCell(ref)?.inner ?? "");
    return m ? unescapeXml(m[1]) : undefined;
  }

  /** The cell's value as Excel shows it (a formula's cached result). */
  value(ref: string): CellValue {
    const cell = this.findCell(ref);
    if (!cell) return null;
    const t = getAttr(cell.attrs, "t");
    if (t === "inlineStr") return plainText(cell.inner);
    const v = /<v>([\s\S]*?)<\/v>/.exec(cell.inner)?.[1];
    if (v === undefined) return null;
    if (t === "s") return this.book.strings.text(Number(v));
    if (t === "str" || t === "e") return unescapeXml(v);
    return Number(v);
  }

  /** Writes a plain value, keeping the cell's style. null or "" leaves it empty. */
  set(ref: string, value: CellValue) {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error(`Refusing to write ${value} into ${this.name}!${ref}`);
    }
    // Already holds exactly this value: leave the XML as issued.
    const existing = this.findCell(ref);
    const wanted = value === "" ? null : value;
    if (existing ? !HAS_FORMULA.test(existing.inner) && this.value(ref) === wanted : wanted === null) return;
    const cell = this.ensureCell(ref);
    if (HAS_FORMULA.test(cell.inner)) this.book.formulasMoved = true;
    let attrs = setAttr(cell.attrs, "t", null);
    let inner = "";
    if (typeof value === "string" && value !== "") {
      attrs = setAttr(attrs, "t", "s");
      inner = `<v>${this.book.strings.indexOf(value)}</v>`;
    } else if (typeof value === "number") {
      inner = `<v>${value}</v>`;
    }
    cell.attrs = attrs;
    cell.inner = inner;
    this.dirty = true;
  }

  /** Writes a simple-reference formula; its cached result is filled in on save. */
  setFormula(ref: string, formula: string) {
    if (!SIMPLE_REF.test(formula)) throw new Error(`Unsupported formula "${formula}"`);
    const cell = this.ensureCell(ref);
    if (this.formulaOf(ref) !== formula) this.book.formulasMoved = true;
    cell.attrs = setAttr(cell.attrs, "t", null);
    cell.inner = `<f>${escapeXml(formula)}</f>`;
    this.dirty = true;
  }

  /** Every formula cell, as [ref, formula]. */
  formulas(): [string, string][] {
    const out: [string, string][] = [];
    for (const row of this.rows) {
      for (const cell of row.cells) {
        const m = FORMULA.exec(cell.inner);
        if (m) out.push([`${numToCol(cell.col)}${row.r}`, unescapeXml(m[1])]);
      }
    }
    return out;
  }

  /** Sets a formula cell's cached result; returns whether anything changed. */
  setCachedResult(ref: string, result: CellValue): boolean {
    const cell = this.findCell(ref);
    if (!cell) return false;
    const f = /<f(?:\s[^>]*)?>[\s\S]*?<\/f>|<f(?:\s[^>]*)?\/>/.exec(cell.inner)?.[0] ?? "";
    const attrs = setAttr(cell.attrs, "t", typeof result === "string" ? "str" : null);
    const inner =
      result === null ? f : `${f}<v>${typeof result === "string" ? escapeXml(result) : result}</v>`;
    if (inner === cell.inner && attrsXml(attrs) === attrsXml(cell.attrs)) return false;
    cell.attrs = attrs;
    cell.inner = inner;
    this.dirty = true;
    return true;
  }

  stringRefs(): number[] {
    const out: number[] = [];
    for (const row of this.rows) {
      for (const cell of row.cells) {
        if (getAttr(cell.attrs, "t") !== "s") continue;
        const v = /<v>(\d+)<\/v>/.exec(cell.inner);
        if (v) out.push(Number(v[1]));
      }
    }
    return out;
  }

  /**
   * Replaces rows `first`..`last` with clones of template rows: `plan[i]` is
   * the row (numbered as before the rebuild) whose height and cell styles the
   * new row `first + i` takes. Clones carry styles only; set values after.
   * Rows below the block move by the size difference, with every reference
   * to them (formulas, merges, print areas).
   */
  rebuildRows(first: number, last: number, plan: number[]) {
    const templates = new Map<number, Row>();
    for (const r of new Set(plan)) {
      const src = this.findRow(r);
      if (!src) throw new Error(`Template row ${r} doesn't exist in "${this.name}"`);
      templates.set(r, src);
    }
    const delta = plan.length - (last - first + 1);
    for (const m of this.tail.matchAll(/<mergeCell ref="[A-Z]+(\d+)(?::[A-Z]+(\d+))?"/g)) {
      const top = Number(m[1]);
      const bottom = Number(m[2] ?? m[1]);
      if (bottom >= first && top <= last) {
        throw new Error(`Can't rebuild rows ${first}-${last} of "${this.name}": merged cells overlap them`);
      }
    }
    if (delta !== 0) {
      if (/<(?:conditionalFormatting|dataValidations|hyperlinks|tableParts)\b/.test(this.tail)) {
        throw new Error(`Can't move rows in "${this.name}": it has row-anchored features`);
      }
      if (this.anchorRows.some((r0) => r0 + 1 > last)) {
        throw new Error(`Can't move rows in "${this.name}": an image is anchored below row ${last}`);
      }
    }

    const below = this.rows.filter((x) => x.r > last);
    for (const row of below) {
      const to = row.r + delta;
      row.r = to;
      row.attrs = setAttr(row.attrs, "r", String(to));
      for (const cell of row.cells) cell.attrs = setAttr(cell.attrs, "r", `${numToCol(cell.col)}${to}`);
    }

    const clones: Row[] = plan.map((src, i) => {
      const r = first + i;
      const t = templates.get(src)!;
      return {
        r,
        attrs: setAttr(t.attrs, "r", String(r)),
        selfClosing: t.selfClosing,
        cells: t.cells.map((c) => ({
          col: c.col,
          attrs: setAttr(setAttr(c.attrs, "r", `${numToCol(c.col)}${r}`), "t", null),
          inner: "",
        })),
      };
    });

    this.rows = [...this.rows.filter((x) => x.r < first), ...clones, ...below];
    if (delta !== 0) this.book.shiftReferences(this.name, last, delta);
    this.book.formulasMoved = true;
    this.dirty = true;
  }

  /** Shifts row numbers > `after` by `delta` in this sheet's merged ranges. */
  shiftMerges(after: number, delta: number) {
    const next = this.tail.replace(/<mergeCell ref="([^"]+)"/g, (_, ref: string) => {
      const moved = ref.replace(/([A-Z]+)(\d+)/g, (__, c: string, r: string) =>
        `${c}${Number(r) > after ? Number(r) + delta : r}`,
      );
      return `<mergeCell ref="${moved}"`;
    });
    if (next !== this.tail) {
      this.tail = next;
      this.dirty = true;
    }
  }

  /** Moves this sheet's formula refs that point at `target` rows > `after`. */
  shiftFormulaRefs(target: string, after: number, delta: number) {
    for (const row of this.rows) {
      for (const cell of row.cells) {
        const m = /(<f(?:\s[^>]*)?>)([\s\S]*?)(<\/f>)/.exec(cell.inner);
        if (!m) continue;
        const formula = unescapeXml(m[2]);
        const ref = SIMPLE_REF.exec(formula);
        if (!ref || (ref[1] ?? ref[2] ?? this.name) !== target || Number(ref[4]) <= after) continue;
        const moved = formula.replace(/\d+$/, (r) => String(Number(r) + delta));
        cell.inner = cell.inner.replace(m[0], `${m[1]}${escapeXml(moved)}${m[3]}`);
        this.dirty = true;
      }
    }
  }

  usedRange(): string {
    let minR = Infinity;
    let maxR = 0;
    let minC = Infinity;
    let maxC = 0;
    for (const row of this.rows) {
      for (const cell of row.cells) {
        minR = Math.min(minR, row.r);
        maxR = Math.max(maxR, row.r);
        minC = Math.min(minC, cell.col);
        maxC = Math.max(maxC, cell.col);
      }
    }
    if (maxR === 0) return "A1";
    const a = `${numToCol(minC)}${minR}`;
    const b = `${numToCol(maxC)}${maxR}`;
    return a === b ? a : `${a}:${b}`;
  }

  /** Rows and styled cells, for reading the printed layout. */
  rowsForLayout(): { r: number; ht?: number; hidden: boolean; cells: { col: number; style?: number }[] }[] {
    return this.rows.map((row) => ({
      r: row.r,
      ht: getAttr(row.attrs, "ht") ? Number(getAttr(row.attrs, "ht")) : undefined,
      hidden: getAttr(row.attrs, "hidden") === "1",
      cells: row.cells.map((c) => ({
        col: c.col,
        style: getAttr(c.attrs, "s") ? Number(getAttr(c.attrs, "s")) : undefined,
      })),
    }));
  }

  /** The XML around sheetData (columns, merges, page setup). */
  frameXml(): string {
    return this.head + this.tail;
  }

  toXml(): string {
    if (!this.dirty) return this.original;
    const body = this.rows
      .map((row) => {
        if (row.cells.length === 0 && row.selfClosing) return `<row${attrsXml(row.attrs)}/>`;
        const cells = row.cells
          .map((c) => (c.inner ? `<c${attrsXml(c.attrs)}>${c.inner}</c>` : `<c${attrsXml(c.attrs)}/>`))
          .join("");
        return `<row${attrsXml(row.attrs)}>${cells}</row>`;
      })
      .join("");
    const head = this.head.replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="${this.usedRange()}"/>`);
    return head + body + this.tail;
  }
}

export class XlsxTemplate {
  /** Set when formula cells were added, removed or moved: calcChain is then stale. */
  formulasMoved = false;
  private sheets = new Map<string, XlsxSheet>();
  private nameShifts: { sheet: string; after: number; delta: number }[] = [];

  private constructor(
    readonly zip: JSZip,
    readonly strings: SharedStrings,
  ) {}

  static async load(data: Buffer | Uint8Array): Promise<XlsxTemplate> {
    // createFolders: false keeps JSZip from adding folder entries on save.
    const zip = await JSZip.loadAsync(data, { createFolders: false });
    const sst = zip.file("xl/sharedStrings.xml");
    const book = new XlsxTemplate(zip, new SharedStrings(sst ? await sst.async("string") : null));

    const workbook = await book.text("xl/workbook.xml");
    const targets = await book.relationships("xl/workbook.xml");
    for (const m of workbook.matchAll(/<sheet\b([^>]*)\/>/g)) {
      const a = parseAttrs(m[1]);
      const name = unescapeXml(getAttr(a, "name") ?? "");
      const path = targets.get(getAttr(a, "r:id") ?? "");
      if (!path) continue;
      const xml = await book.text(path);
      const drawing = await book.drawingPathFor(path, xml);
      const anchors = drawing
        ? [...(await book.text(drawing)).matchAll(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/g)].map((x) =>
            Number(x[1]),
          )
        : [];
      book.sheets.set(name, new XlsxSheet(book, name, path, xml, anchors));
    }
    return book;
  }

  async text(path: string): Promise<string> {
    const f = this.zip.file(path);
    if (!f) throw new Error(`Template is missing ${path}`);
    return f.async("string");
  }

  /** Relationship id → resolved part path, for the part at `owner`. */
  async relationships(owner: string): Promise<Map<string, string>> {
    const relsPath = owner.replace(/([^/]+)$/, "_rels/$1.rels");
    const f = this.zip.file(relsPath);
    if (!f) return new Map();
    const xml = await f.async("string");
    const out = new Map<string, string>();
    for (const m of xml.matchAll(/<Relationship\b([^>]*?)\/?>/g)) {
      const a = parseAttrs(m[1]);
      const id = getAttr(a, "Id");
      const target = getAttr(a, "Target");
      if (id && target && getAttr(a, "TargetMode") !== "External") out.set(id, resolvePath(owner, target));
    }
    return out;
  }

  /** The drawing part a sheet uses, if any. */
  async drawingPathFor(sheetPath: string, sheetXml: string): Promise<string | null> {
    const rid = /<drawing r:id="([^"]+)"/.exec(sheetXml)?.[1];
    if (!rid) return null;
    return (await this.relationships(sheetPath)).get(rid) ?? null;
  }

  sheet(name: string): XlsxSheet {
    const s = this.sheets.get(name);
    if (!s) throw new Error(`Template has no sheet "${name}"`);
    return s;
  }

  /** Moves every reference to `sheet` rows > `after` by `delta`. */
  shiftReferences(sheet: string, after: number, delta: number) {
    for (const s of this.sheets.values()) s.shiftFormulaRefs(sheet, after, delta);
    this.sheet(sheet).shiftMerges(after, delta);
    this.nameShifts.push({ sheet, after, delta });
  }

  /**
   * Fills each simple-reference formula's cached result from the cell it
   * points at, so readers that don't recalculate (and Excel's first paint)
   * show the new figures.
   */
  refreshFormulas() {
    for (let pass = 0; pass < 5; pass++) {
      let changed = false;
      for (const s of this.sheets.values()) {
        for (const [ref, formula] of s.formulas()) {
          const m = SIMPLE_REF.exec(formula);
          if (!m) continue;
          const target = this.sheets.get(m[1] ?? m[2] ?? s.name);
          if (!target) continue;
          changed = s.setCachedResult(ref, target.value(`${m[3]}${m[4]}`)) || changed;
        }
      }
      if (!changed) return;
    }
  }

  /** Finalises cached results and unused strings; call before reading or saving. */
  finalize() {
    this.refreshFormulas();
    // Blank strings no cell uses any more, so a template's sample data
    // doesn't travel inside every generated file.
    const used = new Set<number>();
    for (const s of this.sheets.values()) for (const i of s.stringRefs()) used.add(i);
    this.strings.blankUnused(used);
  }

  async toBuffer(): Promise<Buffer> {
    this.finalize();
    let refs = 0;
    for (const s of this.sheets.values()) {
      refs += s.stringRefs().length;
      if (s.dirty) this.zip.file(s.path, s.toXml());
    }
    if (this.strings.changed) this.zip.file("xl/sharedStrings.xml", this.strings.toXml(refs));
    if (this.nameShifts.length) await this.shiftDefinedNames();
    if (this.formulasMoved) await this.dropCalcChain();
    return this.zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });
  }

  private async shiftDefinedNames() {
    const before = await this.text("xl/workbook.xml");
    let xml = before;
    for (const { sheet, after, delta } of this.nameShifts) {
      xml = xml.replace(/(<definedName\b[^>]*>)([^<]*)(<\/definedName>)/g, (_, open, body: string, close) => {
        const moved = body.replace(
          /((?:'[^']+'|[A-Za-z_][\w.]*)!)(\$?[A-Z]{1,3}\$?\d+(?::\$?[A-Z]{1,3}\$?\d+)?)/g,
          (m, prefix: string, range: string) => {
            if (prefix.slice(0, -1).replace(/^'|'$/g, "") !== sheet) return m;
            return (
              prefix +
              range.replace(/(\$?[A-Z]{1,3}\$?)(\d+)/g, (__, c: string, r: string) =>
                `${c}${Number(r) > after ? Number(r) + delta : r}`,
              )
            );
          },
        );
        return open + moved + close;
      });
    }
    if (xml !== before) this.zip.file("xl/workbook.xml", xml);
  }

  // Excel rebuilds a missing calcChain silently, but a stale one makes it
  // offer to repair the file.
  private async dropCalcChain() {
    if (!this.zip.file("xl/calcChain.xml")) return;
    this.zip.remove("xl/calcChain.xml");
    const rels = await this.text("xl/_rels/workbook.xml.rels");
    this.zip.file(
      "xl/_rels/workbook.xml.rels",
      rels.replace(/<Relationship\b[^>]*Target="(?:\/xl\/)?calcChain\.xml"[^>]*\/>/, ""),
    );
    const types = await this.text("[Content_Types].xml");
    this.zip.file(
      "[Content_Types].xml",
      types.replace(/<Override\b[^>]*PartName="\/xl\/calcChain\.xml"[^>]*\/>/, ""),
    );
  }
}

/** Resolves a relationship target against the part that owns it. */
export function resolvePath(from: string, target: string): string {
  if (target.startsWith("/")) return target.slice(1);
  const parts = from.split("/").slice(0, -1);
  for (const seg of target.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg && seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}
