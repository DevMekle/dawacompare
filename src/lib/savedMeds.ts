// "My medicines": comparisons the customer saved on this device, to re-check at the next refill.
// Kept in this browser only (localStorage); nothing is sent anywhere.
import type { Formulation, MedicineRecord } from "../domain/types";

export interface SavedMed {
  key: string;
  kind: "catalogue" | "pack";
  brand: string;
  record?: MedicineRecord;            // kind "catalogue"
  formulation?: Formulation;          // kind "pack"
  mrp?: number;
  pack?: number;
  altName?: string;
  monthlySaving?: number | null;
  savedAt: string;
}

const KEY = "dc-saved-meds";

export function loadSaved(): SavedMed[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v.slice(0, 10) : [];
  } catch {
    return [];
  }
}

export function storeSaved(list: SavedMed[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 10))); } catch { /* storage unavailable: keep in memory only */ }
}
