import { describe, it, expect } from "vitest";
import {
  priorYields,
  solveCalibration,
  SALTS,
  ION,
  type Reading,
} from "../../src/chem";

describe("priorYields", () => {
  const Y = priorYields();

  it("produces a yield row for each concentrate", () => {
    expect(Object.keys(Y).sort()).toEqual(["J", "L", "T"]);
  });

  it("L carries Mg (from MgSO4/MgCl2) and no calcium", () => {
    expect(Y.L.Mg).toBeGreaterThan(0);
    expect(Y.L.Ca).toBe(0); // no calcium salt in the L blend
  });

  it("matches the hand-computed Ca yield for T (cacl2 fraction × Ca molar / mm)", () => {
    // T comp: mgcl2 .40, cacl2 .30, nacl .12, nahco3 .10, khco3 .08 → wsum 1.0
    const f = 0.3; // cacl2 fraction (wsum is 1)
    const expected = (f * SALTS.cacl2.Ca * ION.Ca) / SALTS.cacl2.mm;
    expect(Y.T.Ca).toBeCloseTo(expected, 6);
  });
});

describe("solveCalibration", () => {
  it("returns the default model (factors ≈1) with no readings", () => {
    const out = solveCalibration([]);
    expect(out.n).toBe(0);
    expect(out.alpha).toEqual({ T: 1, J: 1, L: 1 });
    expect(out.beta).toEqual({ T: 1, J: 1, L: 1 });
    expect(out.kTDS).toBeNull();
  });

  it("recovers the prior when readings exactly match the default model", () => {
    const Y = priorYields();
    const ghOf = (m: Reading["masses"]) =>
      2.497 * (m.T * Y.T.Ca + m.J * Y.J.Ca + m.L * Y.L.Ca) +
      4.118 * (m.T * Y.T.Mg + m.J * Y.J.Mg + m.L * Y.L.Mg);
    const khOf = (m: Reading["masses"]) =>
      0.8197 * (m.T * Y.T.HCO3 + m.J * Y.J.HCO3 + m.L * Y.L.HCO3);

    const readings: Reading[] = [
      { masses: { T: 1, J: 0, L: 0 } },
      { masses: { T: 0, J: 1, L: 0 } },
      { masses: { T: 0, J: 0, L: 1 } },
    ].map((r) => ({ masses: r.masses, gh: ghOf(r.masses), kh: khOf(r.masses) }));

    const out = solveCalibration(readings);
    expect(out.alpha.T).toBeCloseTo(1, 2);
    expect(out.alpha.L).toBeCloseTo(1, 2);
    expect(out.beta.J).toBeCloseTo(1, 2);
  });

  it("clamps correction factors into [0.1, 5]", () => {
    const wild: Reading[] = [
      { masses: { T: 1, J: 0, L: 0 }, gh: 99999, kh: 99999 },
    ];
    const out = solveCalibration(wild);
    for (const v of [...Object.values(out.alpha), ...Object.values(out.beta)]) {
      expect(v).toBeGreaterThanOrEqual(0.1);
      expect(v).toBeLessThanOrEqual(5);
    }
  });

  it("derives the TDS constant from masses and measured tds", () => {
    const out = solveCalibration([{ masses: { T: 1, J: 1, L: 1 }, tds: 100 }]);
    // kTDS = (tds*30)/sumMasses = 100*30/3 = 1000
    expect(out.kTDS).toBeCloseTo(1000, 6);
  });
});
