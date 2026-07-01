/**
 * Nutrition-lookup seam (L6). Enrichment, never a gate — a `null`/empty result
 * means "type it in yourself" (L5), never a blocked flow. Crowd-sourced fields
 * may be missing, so every field is optional. Adapter (Open Food Facts) lives
 * in the food kernel; the core only defines the contract.
 */
export interface NutritionResult {
  name: string;
  barcode?: string;
  /** Macros per 100 g, each optional (a field may simply be absent). */
  per100g?: {
    kcal?: number;
    proteinG?: number;
    carbsG?: number;
    fatG?: number;
  };
}

export interface NutritionPort {
  byBarcode(barcode: string): Promise<NutritionResult | null>;
  search(query: string): Promise<NutritionResult[]>;
}
