export type ProductSeed = {
  key: string;
  zhName: string;
  enName: string;
  family: string;
  keywords: string[];
  scenarios: string[];
};

export const yonyeProducts: ProductSeed[] = [
  {
    key: "surgical_tape",
    zhName: "医用胶带系列",
    enName: "Surgical Tape Series",
    family: "medical_tape",
    keywords: ["surgical tape", "PE tape", "non-woven tape", "silk tape", "cotton tape"],
    scenarios: ["wound care", "hospital supply", "first aid", "medical distributor"]
  },
  {
    key: "kinesiology_tape",
    zhName: "肌内效贴系列",
    enName: "Kinesiology Tape Series",
    family: "sports_medicine",
    keywords: ["kinesiology tape", "sports tape", "precut kinesiology tape", "printed kinesiology tape"],
    scenarios: ["sports medicine", "physiotherapy", "rehabilitation", "fitness recovery"]
  },
  {
    key: "cohesive_bandage",
    zhName: "自粘绷带系列",
    enName: "Cohesive Bandage Series",
    family: "bandage",
    keywords: ["cohesive bandage", "self adhesive bandage", "printed cohesive bandage"],
    scenarios: ["veterinary supply", "first aid", "sports protection", "pharmacy supply"]
  },
  {
    key: "sports_tape",
    zhName: "运动胶带系列",
    enName: "Sports Tape Series",
    family: "sports_medicine",
    keywords: ["sports tape", "athletic tape", "hockey tape", "underwrap"],
    scenarios: ["team sports", "sports medicine", "athletic training", "physical therapy"]
  },
  {
    key: "pop_bandage",
    zhName: "石膏绷带与骨科衬垫",
    enName: "POP Bandage and Orthopedic Padding",
    family: "orthopedic",
    keywords: ["plaster bandage", "POP bandage", "orthopedic padding", "PBT bandage"],
    scenarios: ["orthopedic supplier", "hospital procurement", "clinic supply", "medical wholesaler"]
  },
  {
    key: "wound_plaster",
    zhName: "创口贴系列",
    enName: "Wound Plaster Series",
    family: "wound_care",
    keywords: ["wound plaster", "band aid", "cartoon plaster", "waterproof plaster"],
    scenarios: ["pharmacy chain", "first aid brand", "retail healthcare", "private label"]
  },
  {
    key: "wound_dressing",
    zhName: "敷料贴系列",
    enName: "Wound Dressing Series",
    family: "wound_care",
    keywords: ["wound dressing", "PU dressing", "non-woven dressing", "sterile wound dressing"],
    scenarios: ["wound care", "hospital supply", "medical distributor", "surgical supply"]
  },
  {
    key: "acne_patch",
    zhName: "痘痘贴",
    enName: "Acne Patch",
    family: "personal_care",
    keywords: ["acne patch", "hydrocolloid patch", "pimple patch"],
    scenarios: ["beauty brand", "cosmetic distributor", "pharmacy chain", "e-commerce seller"]
  }
];

export function buildKeywordSet(productKeys: string[], extraKeywords: string[]): string[] {
  const selected = yonyeProducts.filter((product) => productKeys.includes(product.key));
  const values = selected.flatMap((product) => [...product.keywords, ...product.scenarios]);

  return Array.from(new Set([...values, ...extraKeywords].map((item) => item.trim()).filter(Boolean)));
}
