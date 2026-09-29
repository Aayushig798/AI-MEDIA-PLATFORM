import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Impact domain keywords mapping
const KEYWORD_MAP = {
  // Environmental
  water: "Environmental", river: "Environmental", lake: "Environmental",
  tree: "Environmental", forest: "Environmental", plant: "Environmental",
  grass: "Environmental", sky: "Environmental", cloud: "Environmental",
  mountain: "Environmental", hill: "Environmental", valley: "Environmental",
  nature: "Environmental", landscape: "Environmental", ocean: "Environmental",
  sea: "Environmental", stream: "Environmental", creek: "Environmental",
  canopy: "Environmental", rainforest: "Environmental", mangrove: "Environmental",
  vegetation: "Environmental", glacier: "Environmental", soil: "Environmental",
  wildlife: "Environmental", leaf: "Environmental", jungle: "Environmental",
  woodland: "Environmental", wetland: "Environmental", marsh: "Environmental",
  estuary: "Environmental", flora: "Environmental", fauna: "Environmental",
  coast: "Environmental", coastal: "Environmental", beach: "Environmental",
  wilderness: "Environmental", savanna: "Environmental", meadow: "Environmental",
  foliage: "Environmental", algae: "Environmental", coral: "Environmental",
  reef: "Environmental", rock: "Environmental", geology: "Environmental",
  terrain: "Environmental", watercourse: "Environmental", reservoir: "Environmental",
  reflection: "Environmental", mist: "Environmental", fog: "Environmental",
  sunrise: "Environmental", sunset: "Environmental", dawn: "Environmental",
  dusk: "Environmental", alps: "Environmental", ridge: "Environmental",
  cliff: "Environmental", massif: "Environmental", sound: "Environmental",
  fjord: "Environmental", pine: "Environmental", conifer: "Environmental",
  larch: "Environmental", fir: "Environmental", fern: "Environmental",
  herb: "Environmental", flower: "Environmental",

  // Infrastructure
  road: "Infrastructure", building: "Infrastructure", bridge: "Infrastructure",
  construction: "Infrastructure", house: "Infrastructure", "solar panel": "Infrastructure",
  solar: "Infrastructure", photovoltaic: "Infrastructure", scaffolding: "Infrastructure",
  pipe: "Infrastructure", pipeline: "Infrastructure", well: "Infrastructure",
  borehole: "Infrastructure", dam: "Infrastructure", tower: "Infrastructure",
  antenna: "Infrastructure", highway: "Infrastructure", concrete: "Infrastructure",
  brick: "Infrastructure", steel: "Infrastructure", architecture: "Infrastructure",
  facade: "Infrastructure", roof: "Infrastructure", window: "Infrastructure",
  door: "Infrastructure", foundation: "Infrastructure", turbine: "Infrastructure",
  wind: "Infrastructure", electricity: "Infrastructure", grid: "Infrastructure",
  generator: "Infrastructure", vehicle: "Infrastructure", truck: "Infrastructure",
  excavator: "Infrastructure", crane: "Infrastructure", bulldozer: "Infrastructure",
  pavement: "Infrastructure", culvert: "Infrastructure", canal: "Infrastructure",
  aqueduct: "Infrastructure", tank: "Infrastructure", silo: "Infrastructure",
  warehouse: "Infrastructure", chimney: "Infrastructure", pier: "Infrastructure",
  dock: "Infrastructure", harbor: "Infrastructure", railway: "Infrastructure",
  train: "Infrastructure", track: "Infrastructure", asphalt: "Infrastructure",
  overpass: "Infrastructure", viaduct: "Infrastructure", tunnel: "Infrastructure",

  // Community
  people: "Community", person: "Community", child: "Community", children: "Community",
  meeting: "Community", gathering: "Community", workshop: "Community",
  classroom: "Community", school: "Community", clinic: "Community",
  hospital: "Community", farmer: "Community", worker: "Community",
  team: "Community", community: "Community", crowd: "Community",
  human: "Community", group: "Community", woman: "Community", women: "Community",
  man: "Community", men: "Community", youth: "Community", elder: "Community",
  family: "Community", resident: "Community", villager: "Community",
  volunteer: "Community", doctor: "Community", nurse: "Community",
  teacher: "Community", student: "Community", market: "Community",
  vendor: "Community", cooperation: "Community", participation: "Community",
  education: "Community", training: "Community", healthcare: "Community",
  smile: "Community", event: "Community", audience: "Community",
  assembly: "Community", celebration: "Community", festival: "Community",

  // Disaster Response
  flood: "Disaster Response", damage: "Disaster Response", fire: "Disaster Response",
  smoke: "Disaster Response", rubble: "Disaster Response", debris: "Disaster Response",
  erosion: "Disaster Response", landslide: "Disaster Response", mudslide: "Disaster Response",
  drought: "Disaster Response", emergency: "Disaster Response", hazard: "Disaster Response",
  crisis: "Disaster Response", storm: "Disaster Response", hurricane: "Disaster Response",
  cyclone: "Disaster Response", tornado: "Disaster Response", tsunami: "Disaster Response",
  earthquake: "Disaster Response", rescue: "Disaster Response", shelter: "Disaster Response",
  destroyed: "Disaster Response", collapsed: "Disaster Response", washed: "Disaster Response",
  ash: "Disaster Response", flame: "Disaster Response", burn: "Disaster Response",
  charred: "Disaster Response", charred: "Disaster Response", crack: "Disaster Response",
  fissure: "Disaster Response", overflow: "Disaster Response", wreckage: "Disaster Response",
  ruins: "Disaster Response", submerged: "Disaster Response", devastation: "Disaster Response",
};

function mapLabelToCategory(label) {
  if (!label) return "Uncategorized";
  const key = label.toLowerCase();
  for (const [keyword, category] of Object.entries(KEYWORD_MAP)) {
    if (key.includes(keyword)) return category;
  }
  return "Uncategorized";
}

function determinePrimaryCategory(items) {
  if (!items || items.length === 0) return "Uncategorized";
  const scores = {};
  for (const item of items) {
    const cat = mapLabelToCategory(item.label);
    if (cat !== "Uncategorized") {
      const weight = typeof item.confidence === "number" ? item.confidence : 1.0;
      scores[cat] = (scores[cat] || 0) + weight;
    }
  }

  let topCategory = "Uncategorized";
  let maxScore = 0;
  for (const [cat, score] of Object.entries(scores)) {
    if (score && score > maxScore) {
      maxScore = score;
      topCategory = cat;
    }
  }
  return topCategory;
}

async function migrate() {
  console.log("Starting Category Migration for existing MediaAssets...");

  const assets = await prisma.mediaAsset.findMany({
    include: {
      aiTags: { orderBy: { confidence: "desc" } },
      categories: { include: { category: true } },
    },
  });

  console.log(`Found ${assets.length} total media assets in database.`);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const asset of assets) {
    // If the asset was explicitly edited by user, skip it
    if (asset.categorySource === "user") {
      console.log(`[SKIP] Asset ${asset.id} has categorySource='user' (manualCategory: ${asset.manualCategory})`);
      skippedCount++;
      continue;
    }

    // Determine the AI primary category from aiTags, or from existing categories relation
    let primaryCategory = determinePrimaryCategory(asset.aiTags);

    if (primaryCategory === "Uncategorized" && asset.categories?.length > 0) {
      const existingRelName = asset.categories[0].category?.name;
      if (existingRelName) {
        primaryCategory = existingRelName;
      }
    }

    console.log(
      `[UPDATE] Asset ${asset.id}: replacing '${asset.manualCategory}' with AI primary category '${primaryCategory}' (categorySource: 'ai')`
    );

    // Update Category and MediaAssetCategory record as well
    const cat = await prisma.category.upsert({
      where: { name: primaryCategory },
      update: {},
      create: { name: primaryCategory },
    });

    await prisma.mediaAssetCategory.deleteMany({ where: { mediaAssetId: asset.id } });
    await prisma.mediaAssetCategory.create({
      data: { mediaAssetId: asset.id, categoryId: cat.id },
    });

    await prisma.mediaAsset.update({
      where: { id: asset.id },
      data: {
        manualCategory: primaryCategory,
        categorySource: "ai",
      },
    });

    updatedCount++;
  }

  console.log(`Migration finished. Updated: ${updatedCount}, Skipped: ${skippedCount}.`);
}

migrate()
  .catch((err) => {
    console.error("Migration error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
