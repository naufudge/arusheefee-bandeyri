
type Employee = {
    name: string;
    designation: string;
}

export const Employees: Employee[] = [
    {name: "Sharumeela Abdul Fatah", designation: "Accounts Officer"},
    {name: "Sharmeela Mohamed", designation: "Senior Finance Officer"},
    {name: "Imad Mohamed", designation: "Chief Corporate Executive"},
    {name: "Aminath Shiuna", designation: "Senior Archivist"},
    {name: "Hawwa Samha Shuaib", designation: "Archives Officer"},
    {name: "Fathimath Nahuza", designation: "Archives Officer"},
    {name: "Aishath Yaania", designation: "Administrative Officer"},
    {name: "Mohamed Nauf Ali Shareef", designation: "Archives Officer"},
    {name: "Aishath Soniya", designation: "Deputy Director"},
    {name: "Mohamed Zeehan Abdulla", designation: "Director"},
    {name: "Naajee Ali Naseer", designation: "HR Officer"},
    {name: "Fazna Luthfee", designation: "Administrative Officer"},
    {name: "Hoodh Sameer", designation: "Project Officer"},
    {name: "Ahmed Asim", designation: "Consultant"},
]

export const Currencies: string[] = [
    "MVR",
    "USD",
    "AUD",
    "CAD",
    "DKK",
    "EUR",
    "HKD",
    "JPY",
    "NOK",
    "SGD",
    "SAR",
    "GBP",
    "CHF",
    "SEK",
    "LKR",
    "INR",
    "THB",
    "MYR",
    "IDR",
    "AED",
]

/**
 * Series ids in the MMA statistics database, table 4038 —
 * "Exchange Rates (MVR per Foreign Currency)". Each series is the monthly
 * end-of-period mid rate, already expressed in MVR per one unit of the
 * foreign currency, so no USD-peg arithmetic is needed.
 *
 * Browse them at https://database.mma.gov.mv/viya/explore/4038 — keep this
 * map in step with `Currencies` above. MVR is deliberately absent (its rate
 * is always 1); MMA also publishes CNY (4042) and NZD (4051), which we
 * don't currently offer.
 */
export const MmaSeriesIds: Record<string, number> = {
    USD: 4039,
    AUD: 4040,
    CAD: 4041,
    DKK: 4043,
    EUR: 4044,
    GBP: 4045,
    HKD: 4046,
    INR: 4047,
    IDR: 4048,
    JPY: 4049,
    MYR: 4050,
    NOK: 4052,
    SAR: 4053,
    SGD: 4054,
    LKR: 4055,
    SEK: 4056,
    CHF: 4057,
    THB: 4058,
    AED: 4059,
}

/**
 * Currency units used to spell out a gross total — `major` for the whole
 * part, `minor` for the two-decimal remainder. Both are passed to
 * `numberToWords`, so a GBP voucher reads "… Pounds, Fifty Pence" rather
 * than borrowing the Rufiyaa/Laari defaults.
 */
export const CurrencyNames = {
    "MVR": { major: "Rufiyaa", minor: "Laari" },
    "USD": { major: "Dollars", minor: "Cents" },
    "AUD": { major: "Australian Dollars", minor: "Cents" },
    "CAD": { major: "Canadian Dollars", minor: "Cents" },
    "DKK": { major: "Danish Kroner", minor: "Øre" },
    "EUR": { major: "Euro", minor: "Cents" },
    "HKD": { major: "Hong Kong Dollars", minor: "Cents" },
    "JPY": { major: "Yen", minor: "Sen" },
    "NOK": { major: "Norwegian Kroner", minor: "Øre" },
    "SGD": { major: "Singapore Dollars", minor: "Cents" },
    "SAR": { major: "Saudi Riyals", minor: "Halalas" },
    "GBP": { major: "Pounds", minor: "Pence" },
    "CHF": { major: "Swiss Francs", minor: "Centimes" },
    "SEK": { major: "Swedish Kronor", minor: "Öre" },
    "LKR": { major: "Sri Lankan Rupees", minor: "Cents" },
    "INR": { major: "Indian Rupees", minor: "Paise" },
    "THB": { major: "Baht", minor: "Satang" },
    "MYR": { major: "Ringgit", minor: "Sen" },
    "IDR": { major: "Rupiah", minor: "Sen" },
    "AED": { major: "Dirhams", minor: "Fils" },
}