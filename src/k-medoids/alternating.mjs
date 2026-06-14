// Alternating (k-means-style) k-medoids algorithm.
// Ported 1:1 from src/alternating.rs

import { arrayAdapter } from './arrayadapter.mjs';
import { USIZE_MAX, choose_medoid_within_partition } from './util.mjs';

/**
 * Run the Alternating algorithm, a k-means-style alternate optimization.
 *
 * This is fairly fast (O(n²), like the FasterPAM method), but because the
 * newly chosen medoid must cover the entire existing cluster, it tends to
 * get stuck in worse local optima as the alternatives. Hence, it is not
 * really recommended to use this algorithm (also known as "Alternate" in
 * classic facility location literature, and re-invented by Park and Jun 2009).
 *
 * @param {*} mat - a pairwise distance matrix (2D array or adapter object)
 * @param {number[]} med - the list of medoids (mutated in place)
 * @param {number} maxiter - the maximum number of iterations allowed
 * @returns {{ loss: number, assi: number[], nIter: number }}
 */
export function alternating(mat, med, maxiter) {
  mat = arrayAdapter(mat);
  const n = mat.len();
  const assi = new Array(n).fill(USIZE_MAX);
  let loss = assign_nearest(mat, med, assi);
  let iter = 0;
  while (iter < maxiter) {
    iter += 1;
    let changed = false;
    for (let i = 0; i < med.length; i++) {
      changed |= choose_medoid_within_partition(mat, assi, med, i)[0];
    }
    if (!changed) {
      break;
    }
    loss = assign_nearest(mat, med, assi);
  }
  return { loss, assi, nIter: iter };
}

/**
 * Assign each point to the nearest medoid, return total loss.
 * Mutates dataArr[i] = index into med of nearest medoid.
 *
 * @param {*} mat - already-wrapped matrix
 * @param {number[]} med - medoid point indices
 * @param {number[]} dataArr - assignment array, mutated in place
 * @returns {number} total loss
 */
export function assign_nearest(mat, med, dataArr) {
  const n = mat.len();
  const k = med.length;
  if (!mat.isSquare()) throw new Error('Dissimilarity matrix is not square');
  if (n > 4294967295) throw new Error('N is too large');
  if (!(k > 0 && k < 4294967295)) throw new Error('invalid N');
  if (k > n) throw new Error('k must be at most N');
  const firstcenter = med[0];
  let acc = 0;
  for (let i = 0; i < n; i++) {
    let best = [0, mat.get(i, firstcenter)];
    for (let m = 1; m < k; m++) {
      const mm = med[m];
      const dm = mat.get(i, mm);
      if (dm < best[1] || i === mm) {
        best = [m, dm];
      }
    }
    dataArr[i] = best[0];
    acc += best[1];
  }
  return acc;
}
