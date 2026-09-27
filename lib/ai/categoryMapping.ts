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
  // Environmental
  river: "Environmental",
  flood: "Environmental",
  forest: "Environmental",
  water: "Environmental",
  tree: "Environmental",
  solar: "Environmental",
  canopy: "Environmental",
  rainforest: "Environmental",
  mangrove: "Environmental",
  vegetation: "Environmental",
  glacier: "Environmental",
  nature: "Environmental",
  ocean: "Environmental",
  lake: "Environmental",
  soil: "Environmental",
  wildlife: "Environmental",
  plant: "Environmental",
  leaf: "Environmental",
  jungle: "Environmental",
  creek: "Environmental",
  landscape: "Environmental",
  woodland: "Environmental",

  // Infrastructure
  scaffolding: "Infrastructure",
  construction: "Infrastructure",
  road: "Infrastructure",
  building: "Infrastructure",
  bridge: "Infrastructure",
  pipe: "Infrastructure",
  pipeline: "Infrastructure",
  well: "Infrastructure",
  borehole: "Infrastructure",
  pump: "Infrastructure",
  "solar panel": "Infrastructure",
  photovoltaic: "Infrastructure",
  dam: "Infrastructure",
  turbine: "Infrastructure",
  generator: "Infrastructure",
  facility: "Infrastructure",
  antenna: "Infrastructure",
  concrete: "Infrastructure",
  highway: "Infrastructure",

  // Community
  crowd: "Community",
  meeting: "Community",
  school: "Community",
  people: "Community",
  person: "Community",
  human: "Community",
  children: "Community",
  youth: "Community",
  training: "Community",
  workshop: "Community",
  farmer: "Community",
  village: "Community",
  gathering: "Community",
  clinic: "Community",
  classroom: "Community",
  council: "Community",

  // Disaster Response
  debris: "Disaster Response",
  rubble: "Disaster Response",
  rescue: "Disaster Response",
  fire: "Disaster Response",
  damage: "Disaster Response",
  destroyed: "Disaster Response",
  erosion: "Disaster Response",
  landslide: "Disaster Response",
  mudslide: "Disaster Response",
  drought: "Disaster Response",
  emergency: "Disaster Response",
  cyclone: "Disaster Response",
  hurricane: "Disaster Response",
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
 * Determines the dominant category from multiple labels by frequency / weight.
 */
export function determineDominantCategory(labels: string[]): DomainCategory {
  if (!labels || labels.length === 0) return "Uncategorized";

  const scores: Record<string, number> = {};
  for (const label of labels) {
    const cat = mapLabelToCategory(label);
    if (cat !== "Uncategorized") {
      scores[cat] = (scores[cat] || 0) + 1;
    }
  }

  let topCat: DomainCategory = "Uncategorized";
  let maxScore = 0;
  for (const [cat, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      topCat = cat as DomainCategory;
    }
  }

  return topCat;
}
