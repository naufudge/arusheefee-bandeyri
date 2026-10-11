/**
 * SAP asset classes and the capital GL code each one posts to, from the
 * "GL Codes" sheet of the asset creation form workbook. The default useful
 * life is per GL code; the asset creation form only records a life when it
 * differs from this default.
 */

interface GlClassGroup {
  glCode: number;
  glName: string;
  /** Default useful life, in years (0 = not depreciated). */
  defaultLife: number;
  /** [class code, class name] */
  classes: [string, string][];
}

const GROUPS: GlClassGroup[] = [
  {
    glCode: 421001,
    glName: "Land",
    defaultLife: 0,
    classes: [
      ["Z001", "Land - Agricultural"],
      ["Z002", "Land - Airports"],
      ["Z003", "Land - Cemetery"],
      ["Z004", "Land - Colleges"],
      ["Z005", "Land - Conventional Centres"],
      ["Z006", "Land - Flats"],
      ["Z007", "Land - Hospitals"],
      ["Z008", "Land - Hotels"],
      ["Z009", "Land - Industrial"],
      ["Z010", "Land - Military"],
      ["Z011", "Land - Mosques"],
      ["Z012", "Land - Offices"],
      ["Z013", "Land - Parks"],
      ["Z014", "Land - Prisons"],
      ["Z015", "Land - Private Schools"],
      ["Z016", "Land - Public Schools"],
      ["Z017", "Land - Reclaimed Areas"],
      ["Z018", "Land - Residential Area"],
      ["Z019", "Land - Resorts"],
      ["Z020", "Land - Restaurants and Café"],
      ["Z021", "Land - Roads"],
      ["Z022", "Land - Shops"],
      ["Z023", "Land - Sport Grounds"],
      ["Z024", "Land - Stadium"],
      ["Z025", "Land - Uninhabited islands"],
      ["Z099", "Land - Others"],
    ],
  },
  {
    glCode: 421002,
    glName: "Residential Buildings",
    defaultLife: 25,
    classes: [
      ["Z100", "Buildings - Flats"],
      ["Z124", "Other Residential Buildings"],
    ],
  },
  {
    glCode: 421003,
    glName: "Non-Residential Buildings",
    defaultLife: 25,
    classes: [
      ["Z125", "Buildings - Colleges"],
      ["Z126", "Buildings - Convention Centres"],
      ["Z127", "Buildings - Factories"],
      ["Z128", "Buildings - Hospitals"],
      ["Z129", "Buildings - Military Buildings"],
      ["Z130", "Buildings - Mosques"],
      ["Z131", "Buildings - Offices"],
      ["Z132", "Buildings - Prisons"],
      ["Z133", "Buildings - Schools"],
      ["Z224", "Other Non Residential Buildings"],
    ],
  },
  {
    glCode: 422001,
    glName: "Roads and Bridges",
    defaultLife: 25,
    classes: [
      ["Z325", "Bridges"],
      ["Z326", "Roads"],
    ],
  },
  {
    glCode: 422002,
    glName: "Airports",
    defaultLife: 25,
    classes: [
      ["Z225", "Apron"],
      ["Z226", "Oil Tanks"],
      ["Z227", "Runway"],
      ["Z228", "Terminal Buildings"],
      ["Z249", "Other Airport Buildings"],
    ],
  },
  {
    glCode: 422003,
    glName: "Wharves, Ports and Harbours",
    defaultLife: 25,
    classes: [
      ["Z250", "Harbors"],
      ["Z251", "Ports"],
      ["Z252", "Wharves"],
    ],
  },
  {
    glCode: 422004,
    glName: "Water & Sanitation Systems",
    defaultLife: 25,
    classes: [
      ["Z275", "Water & Sanitation Systems"],
    ],
  },
  {
    glCode: 422005,
    glName: "Electricity Systems",
    defaultLife: 25,
    classes: [
      ["Z300", "Electricity Reticulation Systems"],
    ],
  },
  {
    glCode: 422999,
    glName: "Other Infrastructure",
    defaultLife: 25,
    classes: [
      ["Z350", "Cemetery"],
      ["Z351", "Monuments"],
      ["Z352", "Museums"],
      ["Z353", "Parks"],
      ["Z354", "Sports Complex"],
      ["Z355", "Stadium"],
      ["Z399", "Other infrastructure"],
    ],
  },
  {
    glCode: 423001,
    glName: "Furniture & Fittings",
    defaultLife: 5,
    classes: [
      ["Z650", "College Furniture"],
      ["Z651", "Hospital and Health Center Furniture"],
      ["Z652", "Office Furniture"],
      ["Z653", "School Furniture"],
      ["Z654", "Household Furniture"],
      ["Z655", "Other Fittings"],
      ["Z699", "Other Furniture"],
    ],
  },
  {
    glCode: 423002,
    glName: "Machinery and Equipment",
    defaultLife: 5,
    classes: [
      ["Z700", "Hospital Equipment and Machinery"],
      ["Z701", "Laboratory Equipment and Machinery"],
      ["Z702", "Office Equipment and Machinery"],
    ],
  },
  {
    glCode: 423003,
    glName: "Vehicular Equipment",
    defaultLife: 8,
    classes: [
      ["Z450", "Barge"],
      ["Z451", "Cranes"],
      ["Z452", "Dredgers"],
      ["Z453", "Excavators"],
      ["Z454", "Fork lifts"],
      ["Z455", "Loaders"],
      ["Z499", "Other Vehicular Equipment"],
    ],
  },
  {
    glCode: 423004,
    glName: "Tools, Instruments, Apparatus",
    defaultLife: 5,
    classes: [
      ["Z775", "Apparatus"],
      ["Z776", "Instruments"],
      ["Z777", "Tools"],
    ],
  },
  {
    glCode: 423005,
    glName: "Reference Books & Exhibition Goods",
    defaultLife: 5,
    classes: [
      ["Z800", "Books"],
      ["Z801", "Exhibition Goods"],
    ],
  },
  {
    glCode: 423006,
    glName: "Communication Infrastructure",
    defaultLife: 5,
    classes: [
      ["Z625", "Network"],
    ],
  },
  {
    glCode: 423007,
    glName: "Computer Software",
    defaultLife: 5,
    classes: [
      ["Z600", "Software"],
    ],
  },
  {
    glCode: 423008,
    glName: "IT-Related Hardware",
    defaultLife: 5,
    classes: [
      ["Z550", "Computers"],
      ["Z551", "Printers"],
      ["Z552", "Projectors"],
      ["Z553", "Routers"],
      ["Z554", "Scanners"],
      ["Z555", "Servers"],
      ["Z556", "Switches"],
      ["Z599", "Other IT Equipment"],
    ],
  },
  {
    glCode: 423999,
    glName: "Other Equipment",
    defaultLife: 5,
    classes: [
      ["Z750", "Other Equipment and Machinery"],
    ],
  },
  {
    glCode: 424001,
    glName: "Motor Vehicles",
    defaultLife: 8,
    classes: [
      ["Z400", "Buses"],
      ["Z401", "Cars"],
      ["Z402", "Lorry"],
      ["Z403", "Military Vehicles"],
      ["Z404", "Motor cycles"],
      ["Z405", "Pick up"],
      ["Z406", "Trucks"],
      ["Z407", "Vans"],
      ["Z449", "Other Motor Vehicles"],
    ],
  },
  {
    glCode: 424002,
    glName: "Ships and Boats",
    defaultLife: 10,
    classes: [
      ["Z500", "Fishing Vessels"],
      ["Z501", "Goods carrier Dhoni"],
      ["Z502", "Passenger carrier Dhoni"],
      ["Z503", "Ships"],
      ["Z504", "Speed boats"],
      ["Z549", "Other Vessels"],
    ],
  },
  {
    glCode: 424003,
    glName: "Aerospace equipments",
    defaultLife: 10,
    classes: [
      ["Z825", "Aeroplanes"],
      ["Z826", "Helicopters"],
      ["Z827", "Jets"],
    ],
  },
];

export interface AssetClass {
  /** SAP asset class, e.g. "Z652". */
  code: string;
  /** e.g. "Office Furniture". */
  name: string;
  glCode: number;
  glName: string;
  defaultLife: number;
}

export const ASSET_CLASSES: AssetClass[] = GROUPS.flatMap((g) =>
  g.classes.map(([code, name]) => ({
    code,
    name,
    glCode: g.glCode,
    glName: g.glName,
    defaultLife: g.defaultLife,
  })),
);

const BY_CODE = new Map(ASSET_CLASSES.map((c) => [c.code, c]));

export const assetClassByCode = (code: string | null | undefined) =>
  code ? BY_CODE.get(code.trim().toUpperCase()) : undefined;

/** Options for a SearchableSelect: "Z652 · Office Furniture", hint "423001 Furniture & Fittings". */
export const assetClassOptions = () =>
  ASSET_CLASSES.map((c) => ({
    value: c.code,
    label: `${c.code} · ${c.name}`,
    hint: `${c.glCode} ${c.glName}`,
  }));
