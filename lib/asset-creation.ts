// Asset creation (SAP Asset Master Data Creation Form) — shared by the form,
// the server, the detail page and the PDF.

/** The three signatories, in signing order. */
export const AC_ROLES = [
  { key: "requestedBy", label: "Requested by" },
  { key: "authorizedBy", label: "Authorised by" },
  { key: "sapUpdatedBy", label: "SAP Asset Master Update by" },
] as const;

export type AcRole = (typeof AC_ROLES)[number]["key"];

/** Which signatory acts at each pending stage. */
export const STAGE_ROLE = {
  PENDING_AUTHORIZATION: "authorizedBy",
  PENDING_SAP_UPDATE: "sapUpdatedBy",
} as const satisfies Record<string, AcRole>;

export type PendingStatus = keyof typeof STAGE_ROLE;

export const isPendingStatus = (status: string): status is PendingStatus =>
  status in STAGE_ROLE;

/** "Request for" options, as printed on the form. */
export const REQUEST_TYPES = [
  { value: "CREATE", label: "Create" },
  { value: "AMEND", label: "Amend" },
  { value: "DELETE", label: "Delete" },
  { value: "BLOCK", label: "Block" },
] as const;

export type RequestType = (typeof REQUEST_TYPES)[number]["value"];

export const requestTypeLabel = (type: string) =>
  REQUEST_TYPES.find((t) => t.value === type)?.label ?? type;

/** Most forms one set can hold. */
export const MAX_FORMS = 50;

/** Form numbers are "{business area}/{year}/{NNN}", e.g. "1506/2026/009". */
export const FORM_NUM_FORMAT = /^(\d+)\/(\d{4})\/(\d+)$/;

const pad3 = (n: number) => String(n).padStart(3, "0");

/**
 * `count` consecutive form numbers for `year`, following the highest number
 * already used for that business area and year.
 */
export function nextFormNums(
  businessArea: string,
  year: number,
  existing: string[],
  count: number,
): string[] {
  let max = 0;
  for (const num of existing) {
    const m = FORM_NUM_FORMAT.exec(num.trim());
    if (m && m[1] === businessArea && Number(m[2]) === year) {
      max = Math.max(max, Number(m[3]));
    }
  }
  return Array.from(
    { length: count },
    (_, i) => `${businessArea}/${year}/${pad3(max + 1 + i)}`,
  );
}

/**
 * The number after `formNum` ("1506/2026/009" → "1506/2026/010"), or null
 * when it isn't in the standard format.
 */
export function followingFormNum(formNum: string): string | null {
  const m = FORM_NUM_FORMAT.exec(formNum.trim());
  if (!m) return null;
  return `${m[1]}/${m[2]}/${pad3(Number(m[3]) + 1)}`;
}

/**
 * A set's numbers as one label: "1506/2026/009–013" when they run in
 * sequence, otherwise "1506/2026/009 +4".
 */
export function formNumRange(nums: string[]): string {
  if (nums.length === 0) return "—";
  if (nums.length === 1) return nums[0];
  const first = FORM_NUM_FORMAT.exec(nums[0]);
  const last = FORM_NUM_FORMAT.exec(nums[nums.length - 1]);
  const consecutive =
    first &&
    nums.every((n, i) => {
      const m = FORM_NUM_FORMAT.exec(n);
      return (
        m &&
        m[1] === first[1] &&
        m[2] === first[2] &&
        Number(m[3]) === Number(first[3]) + i
      );
    });
  if (consecutive && last) return `${nums[0]}–${last[3]}`;
  return `${nums[0]} +${nums.length - 1}`;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** A register entry's price: the form's original value shared across its pieces. */
export const perPiecePrice = (
  originalValue: number | null | undefined,
  quantity: number,
) =>
  originalValue == null || quantity <= 0
    ? null
    : round2(originalValue / quantity);

/** SAP coding printed in the form header, defaulted from Settings → General. */
export interface AssetCoding {
  agencyName: string;
  businessArea: string;
  costCentre: string;
  fund: string;
  functionalArea: string;
}

export const ASSET_CODING_FIELDS: {
  key: keyof AssetCoding;
  label: string;
  placeholder: string;
}[] = [
  { key: "agencyName", label: "Agency name", placeholder: "National Archives" },
  { key: "businessArea", label: "Business area", placeholder: "1506" },
  { key: "costCentre", label: "Cost centre / WBS", placeholder: "C15069999" },
  { key: "fund", label: "Fund", placeholder: "GOM" },
  {
    key: "functionalArea",
    label: "Functional area",
    placeholder: "S067005001001001",
  },
];
