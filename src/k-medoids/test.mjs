// Translated unit tests for rust-kmedoids -> JS port.
// Self-contained Node test runner. Run with: node test.mjs
//
// Ported faithfully from the Rust #[cfg(test)] modules in src/*.rs.
// Each algorithm MUTATES the medoid array passed in, so every test case
// builds a FRESH med array.

import * as km from './index.mjs';
import { LowerTriangle, DenseMatrix } from './arrayadapter.mjs';

// ---- tiny harness ----------------------------------------------------------
let passed = 0;
let failed = 0;

function check(name, cond) {
  if (cond) {
    passed++;
    console.log(`PASS  ${name}`);
  } else {
    failed++;
    console.log(`FAIL  ${name}`);
  }
}

function eqArr(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function near(a, b) {
  return Math.abs(a - b) < 1e-9;
}

// The standard small dataset (LowerTriangle, n=5, without diagonal).
const D = new LowerTriangle(5, [1, 2, 3, 4, 5, 6, 7, 8, 9, 1]);

// ============================================================================
// FasterPAM
// ============================================================================
{
  // fasterpam(D, [0,1], 10): loss=4, nSwaps=2, nIter=2, assi=[0,0,0,1,1], med=[0,3]
  const med = [0, 1];
  const r = km.fasterpam(D, med, 10);
  const sil = km.silhouette(D, r.assi, false).sil;
  check('fasterpam simple: loss', near(r.loss, 4));
  check('fasterpam simple: nSwaps', r.nSwaps === 2);
  check('fasterpam simple: nIter', r.nIter === 2);
  check('fasterpam simple: assi', eqArr(r.assi, [0, 0, 0, 1, 1]));
  check('fasterpam simple: med', eqArr(med, [0, 3]));
  check('fasterpam simple: sil', near(sil, 0.7522494172494172));
}
{
  // fasterpam(D, [1], 10): loss=14, nSwaps=1, nIter=1, assi=[0,0,0,0,0], med=[0]
  const med = [1];
  const r = km.fasterpam(D, med, 10);
  const sil = km.silhouette(D, r.assi, false).sil;
  check('fasterpam single-cluster: loss', near(r.loss, 14));
  check('fasterpam single-cluster: nSwaps', r.nSwaps === 1);
  check('fasterpam single-cluster: nIter', r.nIter === 1);
  check('fasterpam single-cluster: assi', eqArr(r.assi, [0, 0, 0, 0, 0]));
  check('fasterpam single-cluster: med', eqArr(med, [0]));
  check('fasterpam single-cluster: sil', near(sil, 0));
}

// ============================================================================
// FastPAM1
// ============================================================================
{
  // fastpam1(D, [0,1], 10): loss=4, nSwaps=1, nIter=2, assi=[0,0,0,1,1], med=[0,3]
  const med = [0, 1];
  const r = km.fastpam1(D, med, 10);
  const sil = km.silhouette(D, r.assi, false).sil;
  check('fastpam1 simple: loss', near(r.loss, 4));
  check('fastpam1 simple: nSwaps', r.nSwaps === 1);
  check('fastpam1 simple: nIter', r.nIter === 2);
  check('fastpam1 simple: assi', eqArr(r.assi, [0, 0, 0, 1, 1]));
  check('fastpam1 simple: med', eqArr(med, [0, 3]));
  check('fastpam1 simple: sil', near(sil, 0.7522494172494172));
}

// ============================================================================
// Alternating
// ============================================================================
{
  // alternating(D, [0,1], 10): nIter=3, loss=4, assi=[1,1,1,0,0], med=[3,0]
  const med = [0, 1];
  const r = km.alternating(D, med, 10);
  const sil = km.silhouette(D, r.assi, false).sil;
  check('alternating: nIter', r.nIter === 3);
  check('alternating: loss', near(r.loss, 4));
  check('alternating: assi', eqArr(r.assi, [1, 1, 1, 0, 0]));
  check('alternating: med', eqArr(med, [3, 0]));
  check('alternating: sil', near(sil, 0.7522494172494172));
}

// ============================================================================
// PAM
// ============================================================================
{
  // pam_swap(D, [0,1], 10): loss=4, nSwaps=1, nIter=2, assi=[0,0,0,1,1], med=[0,3]
  const med = [0, 1];
  const r = km.pam_swap(D, med, 10);
  const sil = km.silhouette(D, r.assi, false).sil;
  check('pam_swap: loss', near(r.loss, 4));
  check('pam_swap: nSwaps', r.nSwaps === 1);
  check('pam_swap: nIter', r.nIter === 2);
  check('pam_swap: assi', eqArr(r.assi, [0, 0, 0, 1, 1]));
  check('pam_swap: med', eqArr(med, [0, 3]));
  check('pam_swap: sil', near(sil, 0.7522494172494172));
}
{
  // pam_build(D, 2): loss=4, assi=[0,0,0,1,1], meds=[0,3]
  const r = km.pam_build(D, 2);
  const sil = km.silhouette(D, r.assi, false).sil;
  check('pam_build: loss', near(r.loss, 4));
  check('pam_build: assi', eqArr(r.assi, [0, 0, 0, 1, 1]));
  check('pam_build: meds', eqArr(r.meds, [0, 3]));
  check('pam_build: sil', near(sil, 0.7522494172494172));
}
{
  // pam(D, 2, 10): nSwaps=0, nIter=1, loss=4, assi=[0,0,0,1,1], meds=[0,3]
  const r = km.pam(D, 2, 10);
  const sil = km.silhouette(D, r.assi, false).sil;
  check('pam: nSwaps', r.nSwaps === 0);
  check('pam: nIter', r.nIter === 1);
  check('pam: loss', near(r.loss, 4));
  check('pam: assi', eqArr(r.assi, [0, 0, 0, 1, 1]));
  check('pam: meds', eqArr(r.meds, [0, 3]));
  check('pam: sil', near(sil, 0.7522494172494172));
}

// ============================================================================
// FastMSC
// ============================================================================
{
  // fastmsc(D, [0,1,2], 10): loss=0.9047619047619048, nSwaps=1, nIter=2,
  //   assi=[0,0,2,1,1], med=[0,3,2]
  const med = [0, 1, 2];
  const r = km.fastmsc(D, med, 10);
  const sil = km.silhouette(D, r.assi, false).sil;
  const msil = km.medoid_silhouette(D, med, false).sil;
  check('fastmsc k3: loss', near(r.loss, 0.9047619047619048));
  check('fastmsc k3: msil', near(msil, 0.9047619047619048));
  check('fastmsc k3: nSwaps', r.nSwaps === 1);
  check('fastmsc k3: nIter', r.nIter === 2);
  check('fastmsc k3: assi', eqArr(r.assi, [0, 0, 2, 1, 1]));
  check('fastmsc k3: med', eqArr(med, [0, 3, 2]));
  check('fastmsc k3: sil', near(sil, 0.5622222222222222));
}
{
  // fastmsc(D, [0,1], 10): loss=0.8805555555555555, nSwaps=1, nIter=2,
  //   assi=[0,0,0,1,1], med=[0,4]
  const med = [0, 1];
  const r = km.fastmsc(D, med, 10);
  const sil = km.silhouette(D, r.assi, false).sil;
  const msil = km.medoid_silhouette(D, med, false).sil;
  check('fastmsc k2: loss', near(r.loss, 0.8805555555555555));
  check('fastmsc k2: msil', near(msil, 0.8805555555555555));
  check('fastmsc k2: nSwaps', r.nSwaps === 1);
  check('fastmsc k2: nIter', r.nIter === 2);
  check('fastmsc k2: assi', eqArr(r.assi, [0, 0, 0, 1, 1]));
  check('fastmsc k2: med', eqArr(med, [0, 4]));
  check('fastmsc k2: sil', near(sil, 0.7522494172494172));
}

// ============================================================================
// FasterMSC
// ============================================================================
{
  // fastermsc(D, [0,1,2], 10): loss=0.9047619047619048, nSwaps=1, nIter=2,
  //   assi=[0,0,2,1,1], med=[0,3,2]
  const med = [0, 1, 2];
  const r = km.fastermsc(D, med, 10);
  const sil = km.silhouette(D, r.assi, false).sil;
  const msil = km.medoid_silhouette(D, med, false).sil;
  check('fastermsc k3: loss', near(r.loss, 0.9047619047619048));
  check('fastermsc k3: msil', near(msil, 0.9047619047619048));
  check('fastermsc k3: nSwaps', r.nSwaps === 1);
  check('fastermsc k3: nIter', r.nIter === 2);
  check('fastermsc k3: assi', eqArr(r.assi, [0, 0, 2, 1, 1]));
  check('fastermsc k3: med', eqArr(med, [0, 3, 2]));
  check('fastermsc k3: sil', near(sil, 0.5622222222222222));
}
{
  // fastermsc(D, [0,1], 10): loss=0.8805555555555555, nSwaps=3, nIter=2,
  //   assi=[0,0,0,1,1], med=[0,4]
  const med = [0, 1];
  const r = km.fastermsc(D, med, 10);
  const sil = km.silhouette(D, r.assi, false).sil;
  const msil = km.medoid_silhouette(D, med, false).sil;
  check('fastermsc k2: loss', near(r.loss, 0.8805555555555555));
  check('fastermsc k2: msil', near(msil, 0.8805555555555555));
  check('fastermsc k2: nSwaps', r.nSwaps === 3);
  check('fastermsc k2: nIter', r.nIter === 2);
  check('fastermsc k2: assi', eqArr(r.assi, [0, 0, 0, 1, 1]));
  check('fastermsc k2: med', eqArr(med, [0, 4]));
  check('fastermsc k2: sil', near(sil, 0.7522494172494172));
}

// ============================================================================
// PAMSIL
// ============================================================================
{
  // pamsil(D, 2, 10): nSwaps=1, nIter=2, loss=0.7522494172494172,
  //   assi=[0,0,0,1,1], meds=[1,3]
  const r = km.pamsil(D, 2, 10);
  const sil = km.silhouette(D, r.assi, false).sil;
  check('pamsil k2: nSwaps', r.nSwaps === 1);
  check('pamsil k2: nIter', r.nIter === 2);
  check('pamsil k2: loss', near(r.loss, 0.7522494172494172));
  check('pamsil k2: assi', eqArr(r.assi, [0, 0, 0, 1, 1]));
  check('pamsil k2: meds', eqArr(r.meds, [1, 3]));
  check('pamsil k2: sil', near(sil, 0.7522494172494172));
}
{
  // pamsil(D, 3, 10): nSwaps=1, nIter=2, loss=0.5622222222222222,
  //   assi=[0,0,2,1,1], meds=[1,3,2]
  const r = km.pamsil(D, 3, 10);
  const sil = km.silhouette(D, r.assi, false).sil;
  check('pamsil k3: nSwaps', r.nSwaps === 1);
  check('pamsil k3: nIter', r.nIter === 2);
  check('pamsil k3: loss', near(r.loss, 0.5622222222222222));
  check('pamsil k3: assi', eqArr(r.assi, [0, 0, 2, 1, 1]));
  check('pamsil k3: meds', eqArr(r.meds, [1, 3, 2]));
  check('pamsil k3: sil', near(sil, 0.5622222222222222));
}
{
  // pamsil_swap(D, [0,1,2], 10): loss=0.5622222222222222, nSwaps=1, nIter=2,
  //   assi=[1,1,2,0,0], med=[3,1,2]
  const med = [0, 1, 2];
  const r = km.pamsil_swap(D, med, 10);
  const sil = km.silhouette(D, r.assi, false).sil;
  check('pamsil_swap: loss', near(r.loss, 0.5622222222222222));
  check('pamsil_swap: nSwaps', r.nSwaps === 1);
  check('pamsil_swap: nIter', r.nIter === 2);
  check('pamsil_swap: assi', eqArr(r.assi, [1, 1, 2, 0, 0]));
  check('pamsil_swap: med', eqArr(med, [3, 1, 2]));
  check('pamsil_swap: sil', near(sil, 0.5622222222222222));
}

// ============================================================================
// PAMMEDSIL
// ============================================================================
{
  // pammedsil(D, 3, 10): nSwaps=0, nIter=1, loss=0.9047619047619048,
  //   assi=[0,0,2,1,1], meds=[0,3,2]
  const r = km.pammedsil(D, 3, 10);
  const sil = km.silhouette(D, r.assi, false).sil;
  const msil = km.medoid_silhouette(D, r.meds, false).sil;
  check('pammedsil: nSwaps', r.nSwaps === 0);
  check('pammedsil: nIter', r.nIter === 1);
  check('pammedsil: loss', near(r.loss, 0.9047619047619048));
  check('pammedsil: msil', near(msil, 0.9047619047619048));
  check('pammedsil: assi', eqArr(r.assi, [0, 0, 2, 1, 1]));
  check('pammedsil: meds', eqArr(r.meds, [0, 3, 2]));
  check('pammedsil: sil', near(sil, 0.5622222222222222));
}
{
  // pammedsil_swap(D, [0,1,2], 10): loss=0.9047619047619048, nSwaps=1, nIter=2,
  //   assi=[0,0,2,1,1], med=[0,3,2]
  const med = [0, 1, 2];
  const r = km.pammedsil_swap(D, med, 10);
  const sil = km.silhouette(D, r.assi, false).sil;
  const msil = km.medoid_silhouette(D, med, false).sil;
  check('pammedsil_swap k3: loss', near(r.loss, 0.9047619047619048));
  check('pammedsil_swap k3: msil', near(msil, 0.9047619047619048));
  check('pammedsil_swap k3: nSwaps', r.nSwaps === 1);
  check('pammedsil_swap k3: nIter', r.nIter === 2);
  check('pammedsil_swap k3: assi', eqArr(r.assi, [0, 0, 2, 1, 1]));
  check('pammedsil_swap k3: med', eqArr(med, [0, 3, 2]));
  check('pammedsil_swap k3: sil', near(sil, 0.5622222222222222));
}
{
  // pammedsil_swap(D, [0,1], 10): loss=0.8805555555555555, nSwaps=1, nIter=2,
  //   assi=[0,0,0,1,1], med=[0,4]
  const med = [0, 1];
  const r = km.pammedsil_swap(D, med, 10);
  const sil = km.silhouette(D, r.assi, false).sil;
  const msil = km.medoid_silhouette(D, med, false).sil;
  check('pammedsil_swap k2: loss', near(r.loss, 0.8805555555555555));
  check('pammedsil_swap k2: msil', near(msil, 0.8805555555555555));
  check('pammedsil_swap k2: nSwaps', r.nSwaps === 1);
  check('pammedsil_swap k2: nIter', r.nIter === 2);
  check('pammedsil_swap k2: assi', eqArr(r.assi, [0, 0, 0, 1, 1]));
  check('pammedsil_swap k2: med', eqArr(med, [0, 4]));
  check('pammedsil_swap k2: sil', near(sil, 0.7522494172494172));
}

// ============================================================================
// Silhouette standalone
// ============================================================================
{
  const sil = km.silhouette(D, [0, 0, 0, 1, 1], false).sil;
  check('silhouette [0,0,0,1,1]', near(sil, 0.7522494172494172));
}
{
  const sil = km.silhouette(D, [0, 0, 2, 1, 1], false).sil;
  check('silhouette [0,0,2,1,1]', near(sil, 0.5622222222222222));
}

// ============================================================================
// DynMSC (2D dense arrays; pass a FIXED initial med for determinism)
// ============================================================================
{
  const D4 = [
    [0, 1, 2, 3],
    [1, 0, 4, 5],
    [2, 4, 0, 6],
    [3, 5, 6, 0],
  ];
  const med = [0, 1, 2];
  const r = km.dynmsc(D4, med, 2, 100);
  const msil = km.medoid_silhouette(D4, r.meds, false).sil;
  check('dynmsc D4: loss', near(r.loss, 0.9375));
  check('dynmsc D4: meds.length', r.meds.length === 3);
  check('dynmsc D4: msil', near(msil, 0.9375));
}
{
  const D5 = [
    [0, 1, 2, 3, 1],
    [1, 0, 4, 5, 2],
    [2, 4, 0, 6, 3],
    [3, 5, 6, 0, 4],
    [2, 1, 5, 6, 5],
  ];
  const med = [0, 1, 2];
  const r = km.dynmsc(D5, med, 1, 100);
  const msil = km.medoid_silhouette(D5, r.meds, false).sil;
  check('dynmsc D5: loss', near(r.loss, 0.87));
  check('dynmsc D5: meds.length', r.meds.length === 3);
  check('dynmsc D5: msil', near(msil, 0.87));
}

// ============================================================================
// RNG-dependent (assert only invariants; JS PRNG != Rust StdRng)
// ============================================================================
{
  const med = [0, 1];
  const r = km.rand_fasterpam(D, med, 10);
  check('rand_fasterpam: loss near 4', near(r.loss, 4));
}
{
  const med = [0, 1];
  const r = km.par_fasterpam(D, med, 10);
  check('par_fasterpam: loss near 4', near(r.loss, 4));
}

// ============================================================================
// Summary
// ============================================================================
console.log('');
console.log(`Summary: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
