// Ported 1:1 from src/fastmsc.rs (FastMSC algorithm).
import { arrayAdapter } from './arrayadapter.mjs';
import { USIZE_MAX, choose_medoid_within_partition } from './util.mjs';
import { initial_assignment, update_removal_loss, find_best_swap, do_swap, initial_assignment_k2, find_best_swap_k2, do_swap_k2 } from './fastermsc.mjs';

/**
 * Run the FastMSC algorithm, which yields the same results as the original PAMMEDSIL.
 *
 * This is faster than PAMMEDSIL, but slower than FasterMSC, and mostly of interest for academic reasons.
 * This is the improved version, which costs O(n^2) per iteration to find the best swap.
 *
 * @param {object} mat - a pairwise distance matrix
 * @param {number[]} med - the list of medoids (mutated in place)
 * @param {number} maxiter - the maximum number of iterations allowed
 * returns { loss, assi, nIter, nSwaps }
 */
export function fastmsc(mat, med, maxiter) {
  mat = arrayAdapter(mat);
  const n = mat.len(), k = med.length;
  if (k === 1) {
    const assi = new Array(n).fill(0);
    const [swapped, loss] = choose_medoid_within_partition(mat, assi, med, 0);
    return { loss, assi, nIter: 1, nSwaps: swapped ? 1 : 0 };
  }
  if (k === 2) { // special hadling, as there is no third
    return fastmsc_k2(mat, med, maxiter);
  }
  let [loss, data] = initial_assignment(mat, med);

  let removal_loss = new Array(k).fill(0);
  let n_swaps = 0, iter = 0;
  while (iter < maxiter) {
    iter += 1;
    let best = [0, USIZE_MAX, USIZE_MAX];
    update_removal_loss(data, removal_loss);
    for (let j = 0; j < n; j++) {
      if (j === med[data[j].near.i]) {
        continue; // This already is a medoid
      }
      const [change, b] = find_best_swap(mat, removal_loss, data, j);
      if (change <= best[0]) {
        continue; // No improvement
      }
      best = [change, b, j];
    }
    if (best[0] > 0) {
      n_swaps += 1;
      // perform the swap
      const newloss = do_swap(mat, med, data, best[1], best[2]);
      if (newloss >= loss) {
        break; // Probably numerically unstable now.
      }
      loss = newloss;
    } else {
      break; // No improvement, or NaN.
    }
  }
  const assi = data.map((x) => x.near.i);
  loss = 1 - loss / n;
  return { loss, assi, nIter: iter, nSwaps: n_swaps };
}

/** Special case k=2 of the FastMSC algorithm. */
function fastmsc_k2(mat, med, maxiter) {
  const n = mat.len(), k = med.length;
  if (!(k === 2)) throw new Error('Only valid for k=2');
  let [loss, assi, data] = initial_assignment_k2(mat, med);
  let n_swaps = 0, iter = 0;
  while (iter < maxiter) {
    iter += 1;
    let best = [0, k, USIZE_MAX];
    for (let j = 0; j < n; j++) {
      if (j === med[assi[j]]) {
        continue; // This already is a medoid
      }
      const [newloss, b] = find_best_swap_k2(mat, data, j); // assi not used, see below
      if (best[2] === USIZE_MAX || newloss < best[0]) {
        best = [newloss, b, j];
      }
    }
    if (!(best[0] < loss)) {
      break; // No improvement
    }
    // perform the swap
    n_swaps += 1;
    const newloss = do_swap_k2(mat, med, assi, data, best[1], best[2]);
    if (!(newloss < loss)) {
      break; // Probably numerically unstable
    }
    loss = newloss;
  }
  loss = 1 - loss / n;
  return { loss, assi, nIter: iter, nSwaps: n_swaps };
}
