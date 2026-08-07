import { describe, it, expect } from "vitest";
import { recipeModel, type DropModel } from "../../src/lib/catalog";

// A minimal drop model: one brand drop + one custom drop, both calcium-only so GH is easy
// to reason about. This mirrors what loadDropModel(env, [owner]) produces once the author's
// user_drops are merged in.
const SALT = { cacl2: { mm: 110.98, Ca: 1, Mg: 0, HCO3: 0 } };
function model(withCustom: boolean): DropModel {
  const DROP: any = {
    apax_tonik: { name: "TONIK", color: "#e8b500", comp: { cacl2: 1 } },
  };
  if (withCustom) DROP["d-custom"] = { name: "House Mix", color: "#3aa", comp: { cacl2: 1 } };
  return { SALT, DROP, BRAND: {} } as unknown as DropModel;
}

const recipe = (s: Record<string, number>) => ({
  mode: "single",
  drops_per_g: 20,
  target_gl: 3.5,
  ratios: JSON.stringify({ vol: { s: 500 }, tgt: { s: 3.5 }, dpg: { s: 20 }, waters: 1, preset: { s: "Custom" }, s }),
});

describe("recipeModel — custom drops", () => {
  it("resolves a custom drop by NAME, never its raw id", () => {
    const st = recipeModel(recipe({ apax_tonik: 2, "d-custom": 1.5 }), model(true));
    const names = st.breakdown.map((x: any) => x.name);
    expect(names).toContain("TONIK");
    expect(names).toContain("House Mix");
    expect(names).not.toContain("d-custom"); // the bug: it used to print the raw id
  });

  it("counts a custom drop's minerals in GH (not silently dropped)", () => {
    const mixed = recipeModel(recipe({ apax_tonik: 2, "d-custom": 1.5 }), model(true));
    // Same recipe rendered WITHOUT the custom drop in the model = the old broken behaviour:
    // its comp is missing, so recipeBlend skips it and GH is understated.
    const broken = recipeModel(recipe({ apax_tonik: 2, "d-custom": 1.5 }), model(false));
    expect(mixed.GH).toBeGreaterThan(0);
    expect(mixed.GH).toBeGreaterThan(broken.GH); // the custom drop must lift GH
  });

  it("falls back to a friendly label (not a UUID) for an unresolvable id", () => {
    const st = recipeModel(recipe({ "deleted-drop-id": 1 }), model(true));
    expect(st.breakdown.map((x: any) => x.name)).toContain("Custom drop");
  });
});

describe("recipeModel — strength is derived (drops + starting water)", () => {
  const recWith = (s: Record<string, number>, start?: any) => ({
    mode: "single", drops_per_g: 20, target_gl: 3.5,
    ratios: JSON.stringify({ vol: { s: 500 }, tgt: { s: 3.5 }, dpg: { s: 20 }, waters: 1, s, ...(start ? { start } : {}) }),
  });

  it("empty drop set + RO → 0 ppm even when the stored target is stale", () => {
    // ratios.tgt is 3.5 (would be 105 ppm under the old formula) but no drops are dosed.
    const st = recipeModel(recWith({}), model(true));
    expect(st.ppm).toBe(0);
    expect(st.drops).toBe(0);
  });

  it("empty drop set + spring starting water → the starting water's ppm", () => {
    const st = recipeModel(recWith({}, { type: "spring", gh: 80, kh: 50 }), model(true));
    expect(st.ppm).toBe(130); // startTDS = gh + kh, no concentrate
  });

  it("dosed drops → ppm = concentrate g/L × 30 (+ starting water)", () => {
    // The client saves tgt = the actual drop sum, so recipeDose scales to it: tonik 1.25 +
    // lylac 0.5 = 1.75 g/L → round(1.75 × 30) = 53 ppm on RO (matches the live calculator).
    const dosed = {
      mode: "single", drops_per_g: 20, target_gl: 1.75,
      ratios: JSON.stringify({ vol: { s: 500 }, tgt: { s: 1.75 }, dpg: { s: 20 }, waters: 1, s: { apax_tonik: 1.25, apax_lylac: 0.5 } }),
    };
    expect(recipeModel(dosed, model(true)).ppm).toBe(53);
  });
});
