// Text normalisation used by the verification layer and eligibility rules.

/** Salt names that refer to the same active moiety for matching purposes (demo list). */
const SALT_ALIASES: Record<string, string> = {
  "metformin hydrochloride": "metformin",
  "metformin hcl": "metformin",
  "amlodipine besylate": "amlodipine",
  "amlodipine besilate": "amlodipine",
  hctz: "hydrochlorothiazide",
  "cetirizine hydrochloride": "cetirizine",
  "cetirizine dihydrochloride": "cetirizine",
  "cetirizine hcl": "cetirizine",
  cetrizine: "cetirizine",
  "cetrizine hydrochloride": "cetirizine",
  acetaminophen: "paracetamol",
  "atorvastatin calcium": "atorvastatin",
  "rosuvastatin calcium": "rosuvastatin",
  "pantoprazole sodium": "pantoprazole",
  "losartan potassium": "losartan",
  "levocetirizine dihydrochloride": "levocetirizine",
  "levocetrizine": "levocetirizine",
  "montelukast sodium": "montelukast",
  amoxycillin: "amoxicillin",
  "amoxycillin trihydrate": "amoxicillin",
  "amoxicillin trihydrate": "amoxicillin",
  "clavulanate potassium": "clavulanic acid",
  "potassium clavulanate": "clavulanic acid",
  "diluted potassium clavulanate": "clavulanic acid",
  "acetylsalicylic acid": "aspirin",
  "clopidogrel bisulfate": "clopidogrel",
  "clopidogrel bisulphate": "clopidogrel",
  "levothyroxine sodium": "levothyroxine",
  thyroxine: "levothyroxine",
  "thyroxine sodium": "levothyroxine",
};

export function normalizeIngredients(input: string | string[]): string[] {
  const parts = Array.isArray(input) ? input : input.split(/\+|,|&|\band\b/i);
  return parts
    .map((s) => s.trim().toLowerCase().replace(/\s+/g, " "))
    .filter(Boolean)
    .map((s) => SALT_ALIASES[s] ?? s)
    .sort();
}

/** Canonical salt name for one search term, so common misspellings still find the product. */
export function canonicalSalt(term: string): string {
  const k = term.trim().toLowerCase().replace(/\s+/g, " ");
  return SALT_ALIASES[k] ?? k;
}

export function sameIngredients(a: string | string[], b: string | string[]): boolean {
  return normalizeIngredients(a).join("|") === normalizeIngredients(b).join("|");
}

export function sharesIngredient(a: string | string[], b: string | string[]): boolean {
  const nb = normalizeIngredients(b);
  return normalizeIngredients(a).some((x) => nb.includes(x));
}

/** "500 mg", "500mg", "500" → "500mg"; "40 mg + 12.5 mg" → "40mg+12.5mg". */
export function normalizeStrength(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/milligrams?|mgs/g, "mg")
    .split("+")
    .map((p) => (/^\d+(\.\d+)?$/.test(p) ? p + "mg" : p))
    .join("+");
}

/** Brand family: the leading word of the brand, letters only ("Glucora SR 500" → "glucora"). */
export function brandFamily(s: string): string {
  const first = s.trim().toLowerCase().split(/[\s\-]+/)[0] ?? "";
  return first.replace(/[^a-zऀ-ॿ]/g, "");
}

const RELEASE_ALIASES: Record<string, string> = {
  ir: "IR", "immediate-release": "IR", "immediate release": "IR",
  sr: "SR", "sustained-release": "SR", "sustained release": "SR",
  er: "ER", xr: "ER", "extended-release": "ER", "extended release": "ER",
  mr: "MR", cr: "MR", "modified-release": "MR",
  dr: "DR", ec: "DR", "delayed-release": "DR",
};

export function normalizeRelease(s: string): string {
  const k = s.trim().toLowerCase();
  return RELEASE_ALIASES[k] ?? s.trim().toUpperCase();
}

export function normalizeForm(s: string): string {
  const k = s.trim().toLowerCase();
  if (k.startsWith("tab")) return "Tablet";
  if (k.startsWith("cap")) return "Capsule";
  return s.trim();
}
