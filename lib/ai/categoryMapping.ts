/**
 * Domain Category Keyword Mapping
 * Maps raw visual AI labels (from Cloudinary or Vision APIs) to fixed impact domains.
 */

export const DOMAIN_CATEGORIES = [
  "Environmental",
  "Infrastructure",
  "Community",
  "Disaster Response",
  "Uncategorized",
] as const;

export type DomainCategory = (typeof DOMAIN_CATEGORIES)[number];

export const KEYWORD_MAP: Record<string, DomainCategory> = {
  // Environmental (Restoration, Ecology, Water, Climate, Nature)
  water: "Environmental",
  river: "Environmental",
  lake: "Environmental",
  tree: "Environmental",
  forest: "Environmental",
  plant: "Environmental",
  grass: "Environmental",
  sky: "Environmental",
  cloud: "Environmental",
  mountain: "Environmental",
  hill: "Environmental",
  valley: "Environmental",
  nature: "Environmental",
  landscape: "Environmental",
  ocean: "Environmental",
  sea: "Environmental",
  stream: "Environmental",
  creek: "Environmental",
  canopy: "Environmental",
  rainforest: "Environmental",
  mangrove: "Environmental",
  vegetation: "Environmental",
  glacier: "Environmental",
  soil: "Environmental",
  wildlife: "Environmental",
  leaf: "Environmental",
  jungle: "Environmental",
  woodland: "Environmental",
  wetland: "Environmental",
  marsh: "Environmental",
  estuary: "Environmental",
  flora: "Environmental",
  fauna: "Environmental",
  coast: "Environmental",
  coastal: "Environmental",
  beach: "Environmental",
  wilderness: "Environmental",
  savanna: "Environmental",
  meadow: "Environmental",
  foliage: "Environmental",
  algae: "Environmental",
  coral: "Environmental",
  reef: "Environmental",
  rock: "Environmental",
  geology: "Environmental",
  terrain: "Environmental",
  watercourse: "Environmental",
  reservoir: "Environmental",
  reflection: "Environmental",
  mist: "Environmental",
  fog: "Environmental",
  sunrise: "Environmental",
  sunset: "Environmental",
  dawn: "Environmental",
  dusk: "Environmental",
  alps: "Environmental",
  ridge: "Environmental",
  cliff: "Environmental",
  massif: "Environmental",
  sound: "Environmental",
  fjord: "Environmental",
  pine: "Environmental",
  conifer: "Environmental",
  larch: "Environmental",
  fir: "Environmental",
  fern: "Environmental",
  herb: "Environmental",
  flower: "Environmental",

  // Infrastructure (Civil Works, Renewable Energy, Utilities)
  road: "Infrastructure",
  building: "Infrastructure",
  bridge: "Infrastructure",
  construction: "Infrastructure",
  house: "Infrastructure",
  "solar panel": "Infrastructure",
  solar: "Infrastructure",
  photovoltaic: "Infrastructure",
  scaffolding: "Infrastructure",
  pipe: "Infrastructure",
  pipeline: "Infrastructure",
  well: "Infrastructure",
  borehole: "Infrastructure",
  pump: "Infrastructure",
  dam: "Infrastructure",
  turbine: "Infrastructure",
  generator: "Infrastructure",
  facility: "Infrastructure",
  antenna: "Infrastructure",
  concrete: "Infrastructure",
  highway: "Infrastructure",
  street: "Infrastructure",
  pavement: "Infrastructure",
  architecture: "Infrastructure",
  roof: "Infrastructure",
  wall: "Infrastructure",
  tower: "Infrastructure",
  electric: "Infrastructure",
  power: "Infrastructure",
  grid: "Infrastructure",
  waterwork: "Infrastructure",
  sanitation: "Infrastructure",
  sewage: "Infrastructure",
  drainage: "Infrastructure",
  structure: "Infrastructure",
  tunnel: "Infrastructure",
  canal: "Infrastructure",
  vehicle: "Infrastructure",
  truck: "Infrastructure",
  car: "Infrastructure",
  equipment: "Infrastructure",
  machinery: "Infrastructure",
  asphalt: "Infrastructure",
  railway: "Infrastructure",
  warehouse: "Infrastructure",

  // Community (People, Education, Health, Workshops, Livelihoods)
  crowd: "Community",
  people: "Community",
  person: "Community",
  human: "Community",
  children: "Community",
  child: "Community",
  youth: "Community",
  meeting: "Community",
  school: "Community",
  classroom: "Community",
  training: "Community",
  workshop: "Community",
  farmer: "Community",
  village: "Community",
  gathering: "Community",
  clinic: "Community",
  hospital: "Community",
  council: "Community",
  student: "Community",
  teacher: "Community",
  worker: "Community",
  resident: "Community",
  family: "Community",
  women: "Community",
  men: "Community",
  elder: "Community",
  volunteer: "Community",
  civic: "Community",
  public: "Community",
  hand: "Community",
  finger: "Community",
  thumb: "Community",
  wrist: "Community",
  nail: "Community",
  audience: "Community",
  team: "Community",
  collaboration: "Community",
  education: "Community",
  healthcare: "Community",

  // Disaster Response (Damage, Floods, Fires, Crises, Relief)
  debris: "Disaster Response",
  flood: "Disaster Response",
  flooding: "Disaster Response",
  inundation: "Disaster Response",
  rubble: "Disaster Response",
  rescue: "Disaster Response",
  fire: "Disaster Response",
  wildfire: "Disaster Response",
  smoke: "Disaster Response",
  damage: "Disaster Response",
  destroyed: "Disaster Response",
  erosion: "Disaster Response",
  landslide: "Disaster Response",
  mudslide: "Disaster Response",
  drought: "Disaster Response",
  emergency: "Disaster Response",
  cyclone: "Disaster Response",
  hurricane: "Disaster Response",
  typhoon: "Disaster Response",
  tsunami: "Disaster Response",
  earthquake: "Disaster Response",
  hazard: "Disaster Response",
  casualty: "Disaster Response",
  shelter: "Disaster Response",
  ruins: "Disaster Response",
  submerged: "Disaster Response",
  devastation: "Disaster Response",
};

/**
 * Maps a single label string to a domain category.
 */
export function mapLabelToCategory(label: string): DomainCategory {
  if (!label) return "Uncategorized";
  const key = label.toLowerCase();
  for (const [keyword, category] of Object.entries(KEYWORD_MAP)) {
    if (key.includes(keyword)) return category;
  }
  return "Uncategorized";
}

/**
 * Assigns ONE primary category to the asset:
 * The category whose matching labels have the highest total confidence.
 * Returns "Uncategorized" only if no label matches.
 */
export function determinePrimaryCategory(
  items: Array<{ label: string; confidence?: number }>
): DomainCategory {
  if (!items || items.length === 0) return "Uncategorized";

  const scores: Partial<Record<DomainCategory, number>> = {};

  for (const item of items) {
    const cat = mapLabelToCategory(item.label);
    if (cat !== "Uncategorized") {
      const weight = typeof item.confidence === "number" ? item.confidence : 1.0;
      scores[cat] = (scores[cat] || 0) + weight;
    }
  }

  let topCategory: DomainCategory = "Uncategorized";
  let maxScore = 0;

  for (const [cat, score] of Object.entries(scores)) {
    if (score && score > maxScore) {
      maxScore = score;
      topCategory = cat as DomainCategory;
    }
  }

  return topCategory;
}

/**
 * Backward compatibility alias for determinePrimaryCategory
 */
export function determineDominantCategory(labels: string[]): DomainCategory {
  return determinePrimaryCategory(labels.map((l) => ({ label: l, confidence: 1.0 })));
}
