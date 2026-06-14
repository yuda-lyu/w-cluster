// Parallel FasterPAM algorithm, ported 1:1 from src/par_fasterpam.rs
// JS is single-threaded; parallelism is collapsed to a sequential equivalent
// by delegating to fasterpam.mjs helpers (result-identical to the Rust parallel internals).
import { arrayAdapter } from './arrayadapter.mjs';
import { choose_medoid_within_partition } from './util.mjs';
import { initial_assignment, find_best_swap, do_swap, update_removal_loss } from './fasterpam.mjs';
import { shuffle } from './initialization.mjs';

/**
 * Run the FasterPAM algorithm (parallel version).
 *
 * For small data sets (n<1000) it is usually faster to use the non-parallel version.
 *
 * @param mat - a pairwise distance matrix
 * @param med - the list of medoids (mutated in place)
 * @param maxiter - the maximum number of iterations allowed
 * @param rng - random number generator for shuffling the input data
 * @returns { loss, assi, nIter, nSwaps }
 *
 * Panics (throws) when the dissimilarity matrix is not square, or k is 0 or larger than N.
 */
export function par_fasterpam(mat, med, maxiter, rng = Math.random) {
  mat = arrayAdapter(mat);
  const n = mat.len(), k = med.length;
  if (k === 1) {
    const assi = new Array(n).fill(0);
    const [swapped, loss] = choose_medoid_within_partition(mat, assi, med, 0);
    return { loss, assi, nIter: 1, nSwaps: swapped ? 1 : 0 };
  }
  let [loss, data] = initial_assignment(mat, med);

  let removal_loss = new Array(k).fill(0);
  update_removal_loss(data, removal_loss);
  let lastswap = n, n_swaps = 0, iter = 0;
  const seq = shuffle(rng, n); // random shuffling
  while (iter < maxiter) {
    iter += 1;
    const swaps_before = n_swaps, lastloss = loss;
    for (const j of seq) {
      if (j === lastswap) {
        break;
      }
      if (j === med[data[j].near.i]) {
        continue; // This already is a medoid
      }
      const [change, b] = find_best_swap(mat, removal_loss, data, j);
      if (change >= 0) {
        continue; // No improvement
      }
      n_swaps += 1;
      lastswap = j;
      // perform the swap
      loss = do_swap(mat, med, data, b, j);
      update_removal_loss(data, removal_loss);
    }
    if (n_swaps === swaps_before || loss >= lastloss) {
      break; // converged
    }
  }
  const assi = data.map((x) => x.near.i);
  return { loss, assi, nIter: iter, nSwaps: n_swaps };
}
