// Chemistry constants (mirror of the frontend model) + the calibration solver.
// The model is linear in per-concentrate ion yields, so calibration is a small
// ridge least-squares fit of correction factors toward the default model (=1).

export const SALTS: Record<string, { mm: number; Ca: number; Mg: number; HCO3: number }> = {
  mgcl2:  { mm: 95.21,  Ca: 0, Mg: 1, HCO3: 0 },
  mgso4:  { mm: 120.37, Ca: 0, Mg: 1, HCO3: 0 },
  cacl2:  { mm: 110.98, Ca: 1, Mg: 0, HCO3: 0 },
  khco3:  { mm: 100.12, Ca: 0, Mg: 0, HCO3: 1 },
  nahco3: { mm: 84.01,  Ca: 0, Mg: 0, HCO3: 1 },
  kcl:    { mm: 74.55,  Ca: 0, Mg: 0, HCO3: 0 },
  nacl:   { mm: 58.44,  Ca: 0, Mg: 0, HCO3: 0 },
};
export const ION = { Ca: 40.08, Mg: 24.31, HCO3: 61.02 };
export const COMP_DEFAULT: Record<string, Record<string, number>> = {
  T: { mgcl2: 0.40, cacl2: 0.30, nacl: 0.12, nahco3: 0.10, khco3: 0.08 },
  J: { mgcl2: 0.22, cacl2: 0.30, kcl: 0.10, khco3: 0.20, nahco3: 0.18 },
  L: { mgso4: 0.35, mgcl2: 0.20, kcl: 0.18, khco3: 0.12, nahco3: 0.08, nacl: 0.07 },
};
const KEYS = ["T", "J", "L"] as const;
const GH_CA = 2.497, GH_MG = 4.118, KH_HCO3 = 0.8197; // mg/L ion -> ppm CaCO3

export type Yields = Record<string, { Ca: number; Mg: number; HCO3: number }>;

// Default ion yield per unit concentrate (model ppm units), from the salt breakdown.
export function priorYields(): Yields {
  const Y: Yields = {} as Yields;
  for (const C of KEYS) {
    const comp = COMP_DEFAULT[C];
    let wsum = 0;
    for (const s in comp) wsum += comp[s];
    let Ca = 0, Mg = 0, HCO3 = 0;
    for (const s in comp) {
      const f = comp[s] / wsum, S = SALTS[s];
      Ca += f * S.Ca * ION.Ca / S.mm;
      Mg += f * S.Mg * ION.Mg / S.mm;
      HCO3 += f * S.HCO3 * ION.HCO3 / S.mm;
    }
    Y[C] = { Ca, Mg, HCO3 };
  }
  return Y;
}

// Solve a 3x3 system Mx=b (Gaussian elimination with partial pivoting).
function solve3(M: number[][], b: number[]): number[] {
  const a = M.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < 3; c++) {
    let p = c;
    for (let r = c + 1; r < 3; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    [a[c], a[p]] = [a[p], a[c]];
    const piv = a[c][c] || 1e-9;
    for (let r = 0; r < 3; r++) {
      if (r === c) continue;
      const f = a[r][c] / piv;
      for (let k = c; k < 4; k++) a[r][k] -= f * a[c][k];
    }
  }
  return [a[0][3] / (a[0][0] || 1e-9), a[1][3] / (a[1][1] || 1e-9), a[2][3] / (a[2][2] || 1e-9)];
}

// Ridge LS toward prior 1: (AᵀA + λI)x = Aᵀy + λ·1. λ ≈ 0.1 of a virtual observation, so
// diverse data converges quickly while rank-deficiency keeps sparse/collinear data near the
// default (unidentified directions stay at 1). Clamp [0.1, 5].
function ridge(A: number[][], y: number[]): number[] {
  const n = A.length;
  if (!n) return [1, 1, 1];
  const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const v = [0, 0, 0];
  let sq = 0;
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) sq += A[i][c] * A[i][c];
  const lam = Math.max(1e-9, 0.1 * sq / (3 * n));
  for (let i = 0; i < n; i++) {
    for (let r = 0; r < 3; r++) {
      v[r] += A[i][r] * y[i];
      for (let c = 0; c < 3; c++) M[r][c] += A[i][r] * A[i][c];
    }
  }
  for (let d = 0; d < 3; d++) { M[d][d] += lam; v[d] += lam; }
  return solve3(M, v).map((z) => Math.min(5, Math.max(0.1, isFinite(z) ? z : 1)));
}

export interface Reading {
  masses: { T: number; J: number; L: number };
  gh?: number | null;
  kh?: number | null;
  tds?: number | null;
}

export function solveCalibration(readings: Reading[]) {
  const Y0 = priorYields();
  const gh0: Record<string, number> = {}, kh0: Record<string, number> = {};
  for (const C of KEYS) {
    gh0[C] = GH_CA * Y0[C].Ca + GH_MG * Y0[C].Mg;
    kh0[C] = KH_HCO3 * Y0[C].HCO3;
  }

  const Ag: number[][] = [], yg: number[] = [];
  const Ak: number[][] = [], yk: number[] = [];
  for (const r of readings) {
    const m = r.masses;
    if (r.gh != null && isFinite(r.gh)) { Ag.push([m.T * gh0.T, m.J * gh0.J, m.L * gh0.L]); yg.push(r.gh); }
    if (r.kh != null && isFinite(r.kh)) { Ak.push([m.T * kh0.T, m.J * kh0.J, m.L * kh0.L]); yk.push(r.kh); }
  }
  const [aT, aJ, aL] = ridge(Ag, yg);
  const [bT, bJ, bL] = ridge(Ak, yk);
  const alpha = { T: aT, J: aJ, L: aL };
  const beta = { T: bT, J: bJ, L: bL };

  const yields: Yields = {} as Yields;
  for (const C of KEYS) {
    yields[C] = { Ca: Y0[C].Ca * alpha[C], Mg: Y0[C].Mg * alpha[C], HCO3: Y0[C].HCO3 * beta[C] };
  }

  // TDS constant (ppm per g/L); the model assumes 30. total ppm = sum masses = gl*30.
  let kTDS: number | null = null, tn = 0, tsum = 0;
  for (const r of readings) {
    if (r.tds == null || !isFinite(r.tds)) continue;
    const sum = r.masses.T + r.masses.J + r.masses.L;
    if (sum <= 0) continue;
    tsum += (r.tds * 30) / sum; tn++;
  }
  if (tn) kTDS = tsum / tn;

  return { n: readings.length, alpha, beta, yields, kTDS, ghReadings: yg.length, khReadings: yk.length };
}
