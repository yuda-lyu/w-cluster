// FasterPAM algorithm, ported 1:1 from src/fasterpam.rs
import { arrayAdapter } from './arrayadapter.mjs';
import { Rec, DistancePair, U32_MAX, find_min, choose_medoid_within_partition } from './util.mjs';
import { shuffle } from './initialization.mjs';

/**
 * Run the FasterPAM algorithm.
 *
 * If used multiple times, it is better to additionally shuffle the input data,
 * to increase randomness of the solutions found and hence increase the chance
 * of finding a better solution.
 *
 * @param mat - a pairwise distance matrix
 * @param med - the list of medoids (mutated in place)
 * @param maxiter - the maximum number of iterations allowed
 * @returns { loss, assi, nIter, nSwaps }
 *
 * Panics (throws) when the dissimilarity matrix is not square, or k is 0 or larger than N.
 */
export function fasterpam(mat, med, maxiter) {
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
  while (iter < maxiter) {
    iter += 1;
    const swaps_before = n_swaps, lastloss = loss;
    for (let j = 0; j < n; j++) {
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

/**
 * Run the FasterPAM algorithm with additional randomization.
 *
 * This increases the chance of finding a better solution when used multiple times,
 * as it decreases the dependency on the input data order.
 *
 * @param mat - a pairwise distance matrix
 * @param med - the list of medoids (mutated in place)
 * @param maxiter - the maximum number of iterations allowed
 * @param rng - random number generator for shuffling the input data
 * @returns { loss, assi, nIter, nSwaps }
 */
export function rand_fasterpam(mat, med, maxiter, rng = Math.random) {
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

/** Perform the initial assignment to medoids. Returns [loss, data] with data = Rec[]. */
export function initial_assignment(mat, med) {
  const n = mat.len(), k = med.length;
  if (!mat.isSquare()) throw new Error('Dissimilarity matrix is not square');
  if (!(n <= U32_MAX)) throw new Error('N is too large');
  if (!(k > 0 && k < U32_MAX)) throw new Error('invalid N');
  if (!(k <= n)) throw new Error('k must be at most N');
  const data = Array.from({ length: mat.len() }, () => Rec.empty());

  const firstcenter = med[0];
  let loss = 0;
  for (let i = 0; i < data.length; i++) {
    // *cur = Rec::new(...): overwrite the slot with a fresh Rec, then mutate it
    data[i] = new Rec(0, mat.get(i, firstcenter), U32_MAX, 0);
    const curRec = data[i];
    for (let m = 1; m < med.length; m++) {
      const me = med[m];
      const d = mat.get(i, me);
      if (d < curRec.near.d || i === me) {
        curRec.seco = curRec.near.clone();
        curRec.near = new DistancePair(m, d);
      } else if (curRec.seco.i === U32_MAX || d < curRec.seco.d) {
        curRec.seco = new DistancePair(m, d);
      }
    }
    loss += curRec.near.d;
  }
  return [loss, data];
}

/** Find the best swap for object j - FastPAM version. Returns [change, b]. */
export function find_best_swap(mat, removal_loss, data, j) {
  const ploss = removal_loss.slice();
  // Improvement from the journal version:
  let acc = 0;
  for (let o = 0; o < data.length; o++) {
    const reco = data[o];
    const doj = mat.get(o, j);
    // New medoid is closest:
    if (doj < reco.near.d) {
      acc += doj - reco.near.d;
      // loss already includes ds - dn, remove
      ploss[reco.near.i] += reco.near.d - reco.seco.d;
    } else if (doj < reco.seco.d) {
      // loss already includes ds - dn, adjust to d(xo) - dn
      ploss[reco.near.i] += doj - reco.seco.d;
    }
  }
  const [b, bloss] = find_min(ploss);
  return [bloss + acc, b]; // add the shared accumulator
}

/** Update the loss when removing each medoid. Mutates lossArr. */
export function update_removal_loss(data, loss) {
  loss.fill(0); // stable since 1.50
  for (let r = 0; r < data.length; r++) {
    const rec = data[r];
    loss[rec.near.i] += rec.seco.d - rec.near.d;
    // as N might be unsigned
  }
}

/** Update the second nearest medoid information. Called after each swap. Returns a fresh DistancePair. */
export function update_second_nearest(mat, med, n, b, o, doj) {
  let s = new DistancePair(b, doj);
  for (let i = 0; i < med.length; i++) {
    const mi = med[i];
    if (i === n || i === b) {
      continue;
    }
    const d = mat.get(o, mi);
    if (d < s.d) {
      s = new DistancePair(i, d);
    }
  }
  return s;
}

/** Perform a single swap. Returns the RAW summed loss (sum of near.d). */
export function do_swap(mat, med, data, b, j) {
  const n = mat.len();
  if (!(b < med.length)) throw new Error('invalid medoid number');
  if (!(j < n)) throw new Error('invalid object number');
  med[b] = j;
  let acc = 0;
  for (let o = 0; o < data.length; o++) {
    const reco = data[o];
    if (o === j) {
      if (reco.near.i !== b) {
        reco.seco = reco.near.clone();
      }
      reco.near = new DistancePair(b, 0);
      acc += 0;
      continue;
    }
    const doj = mat.get(o, j);
    // Nearest medoid is gone:
    if (reco.near.i === b) {
      if (doj < reco.seco.d) {
        reco.near = new DistancePair(b, doj);
      } else {
        reco.near = reco.seco.clone();
        reco.seco = update_second_nearest(mat, med, reco.near.i, b, o, doj);
      }
    } else {
      // nearest not removed
      if (doj < reco.near.d) {
        reco.seco = reco.near.clone();
        reco.near = new DistancePair(b, doj);
      } else if (doj < reco.seco.d) {
        reco.seco = new DistancePair(b, doj);
      } else if (reco.seco.i === b) {
        // second nearest was replaced
        reco.seco = update_second_nearest(mat, med, reco.near.i, b, o, doj);
      }
    }
    acc += reco.near.d;
  }
  return acc;
}
