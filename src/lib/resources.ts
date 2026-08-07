// Resource whitelists for the generic /api/:res CRUD. Column names are static
// (never user-supplied), so the FIELDS map is the single source of truth for what
// a client may write per resource, and SHAREABLE marks which resources support the
// community pool (shared=1) + adopt flow.

// Writable fields per resource (whitelist — column names are static, never user-supplied).
export const FIELDS: Record<string, string[]> = {
  recipes:      ["name", "mode", "ratios", "target_gl", "drops_per_g", "shared"],
  beans:        ["name", "origin", "process", "varietal", "roaster", "roast_date", "notes", "altitude", "producer", "region", "harvest", "context", "color", "photo_key", "suggestion", "tasting_notes", "shared"],
  brews:        ["recipe_id", "bean_id", "grind", "brew_time", "water_ml", "gh", "kh", "tds", "tasting_note", "score", "photo_key", "shared", "brewed_at"],
  calibrations: ["name", "comp", "reading_count", "shared"],
  readings:     ["ratios", "ppm", "measured_tds", "measured_gh", "measured_kh"],
  user_drops:   ["name", "note", "color", "comp", "dose_model", "dose_json", "shared"],
};
export const SHAREABLE = new Set(["recipes", "beans", "calibrations"]);
