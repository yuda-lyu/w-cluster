// PAMSIL: PAM combined with direct Silhouette optimization.
// Ported 1:1 from src/pamsil.rs

import { arrayAdapter } from './arrayadapter.mjs';
import { USIZE_MAX, choose_medoid_within_partition } from './util.mjs';
import { assign_nearest } from './alternating.mjs';
import { silhouette } from './silhouette.mjs';

/**
 * Run the original PAMSIL SWAP algorithm (no BUILD, but given initial medoids).
 *
 * @param {*} mat - a pairwise distance matrix
 * @param {number[]} med - the list of medoids (mutated in place)
 * @param {number} maxiter - the maximum number of iterations allowed
 * @returns {{ loss: number, assi: number[], nIter: number, nSwaps: number }}
 */
export function pamsil(mat, k, maxiter) {
  mat = arrayAdapter(mat);
  const n = mat.len();
  if (!mat.isSquare()) throw new Error('Dissimilarity matrix is not square');
  if (!(n <= 4294967295)) throw new Error('N is too large');
  if (!(k > 0 && k < 4294967295)) throw new Error('invalid N');
  if (!(k <= n)) throw new Error('k must be at most N');
  const meds = [];
  const assi = new Array(n).fill(0);
  pamsil_build_initialize(mat, meds, assi, k);
  const [nloss, n_iter, n_swap] = pamsil_optimize(mat, meds, assi, maxiter);
  return { loss: nloss, assi, meds, nIter: n_iter, nSwaps: n_swap }; // also return medoids
}

/**
 * Run the original PAMSIL SWAP algorithm (no BUILD, but given initial medoids).
 *
 * @param {*} mat - a pairwise distance matrix
 * @param {number[]} med - the list of medoids (mutated in place)
 * @param {number} maxiter - the maximum number of iterations allowed
 * @returns {{ loss: number, assi: number[], nIter: number, nSwaps: number }}
 */
export function pamsil_swap(mat, med, maxiter) {
  mat = arrayAdapter(mat);
  const n = mat.len();
  const assi = new Array(n).fill(0);
  assign_nearest(mat, med, assi);
  const [nloss, n_iter, n_swap] = pamsil_optimize(mat, med, assi, maxiter);
  return { loss: nloss, assi, nIter: n_iter, nSwaps: n_swap };
}

/**
 * Main optimization function of PAMSIL, not exposed (use pamsil_swap or pamsil).
 * @returns {[number, number, number]} [loss, n_iter, n_swaps]
 */
function pamsil_optimize(mat, med, assi, maxiter) {
  const n = mat.len(), k = med.length;
  if (k === 1) {
    const [swapped, loss] = choose_medoid_within_partition(mat, assi, med, 0);
    return [loss, 1, swapped ? 1 : 0];
  }
  let n_swaps = 0, iter = 0;
  let sil = silhouette(mat, assi, false).sil;
  while (iter < maxiter) {
    iter += 1;
    let best = [0, k, USIZE_MAX];
    for (let m = 0; m < k; m++) {
      const medm = med[m]; // preseve previous value
      for (let j = 0; j < n; j++) {
        if (j === medm || j === med[assi[j]]) {
          continue; // This already is a medoid
        }
        med[m] = j; // replace
        assign_nearest(mat, med, assi);
        const siltemp = silhouette(mat, assi, false).sil;
        if (siltemp <= best[0]) {
          continue; // No improvement
        }
        best = [siltemp, m, j];
      }
      med[m] = medm; // restore
    }
    if (best[0] <= sil) {
      break; // no improvement
    }
    n_swaps += 1;
    med[best[1]] = best[2];
    sil = best[0];
  }
  assign_nearest(mat, med, assi);
  return [sil, iter, n_swaps];
}

/**
 * Not exposed. Use pamsil_build or pamsil.
 * Standard PAM BUILD storing nearest distance per point in a plain number array `data`.
 * @returns {number} loss
 */
function pamsil_build_initialize(mat, meds, assi, k) {
  const n = mat.len();
  // choose first medoid
  let best = [0, k];
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) {
      if (j !== i) {
        sum += mat.get(j, i);
      }
    }
    if (i === 0 || sum < best[0]) {
      best = [sum, i];
    }
  }
  let loss = best[0];
  meds.push(best[1]);
  const data = [];
  assi.fill(0);
  for (let j = 0; j < n; j++) {
    data.push(mat.get(j, best[1]));
  }
  // choose remaining medoids
  for (let _ = 1; _ < k; _++) {
    best = [0, k];
    for (let i = 0; i < data.length; i++) {
      const di = data[i];
      let sum = -di;
      for (let j = 0; j < data.length; j++) {
        const dnear = data[j];
        if (j !== i) {
          const d = mat.get(j, i);
          if (d < dnear) {
            sum += d - dnear;
          }
        }
      }
      if (i === 0 || sum < best[0]) {
        best = [sum, i];
      }
    }
    if (!(best[0] <= 0)) throw new Error('assertion failed: best.0 <= L::zero()');
    // Update assignments:
    loss = 0;
    for (let j = 0; j < data.length; j++) {
      if (j === best[1]) {
        data[j] = 0;
        continue;
      }
      const dj = mat.get(j, best[1]);
      if (dj < data[j]) {
        data[j] = dj;
      }
      loss += data[j];
    }
    meds.push(best[1]);
  }
  return loss;
}
