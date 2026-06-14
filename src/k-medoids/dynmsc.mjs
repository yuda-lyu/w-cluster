// Ported 1:1 from src/dynmsc.rs (DynMSC algorithm).
import { arrayAdapter } from './arrayadapter.mjs';
import { Reco, DistancePair, U32_MAX, USIZE_MAX, choose_medoid_within_partition } from './util.mjs';
import { _loss, initial_assignment, update_removal_loss, find_best_swap, do_swap, fastermsc_k2 } from './fastermsc.mjs';

/**
 * Run the DynMSC algorithm.
 *
 * We begin with a maximum number of clusters, optimize the Average Medoid Silhouette,
 * then decrease the number of clusters by one, and repeat until we have reached a
 * minimum number of clusters. During this process, we store the solution with the
 * highest AMS to return later.
 *
 * @param {object} mat - a pairwise distance matrix
 * @param {number[]} med - the list of medoids
 * @param {number} mink - the minimum number of clusters
 * @param {number} maxiter - the maximum number of iterations allowed
 * returns { loss, assi, nIter, nSwaps, meds, losses }
 */
export function dynmsc(mat, med, mink, maxiter) {
  mat = arrayAdapter(mat);
  med = med.slice(); // Rust: let mut med = med.to_owned();
  const n = mat.len();
  let k = med.length;
  const minimum_k = Math.min(Math.max(mink, 1), k);
  if (k === 1) {
    const return_loss = new Array(1).fill(0);
    const assi = new Array(n).fill(0);
    const [swapped, loss] = choose_medoid_within_partition(mat, assi, med, 0);
    return_loss[0] = loss;
    const return_meds = med.slice();
    return { loss, assi, nIter: 1, nSwaps: swapped ? 1 : 0, meds: return_meds, losses: return_loss };
  }
  let [loss, data] = initial_assignment(mat, med);

  const return_loss = new Array(k - minimum_k + 1).fill(0);
  let best_loss = 0;
  let return_assi = [0, n]; // Rust: vec![0, n]; overwritten before being meaningfully used
  let return_iter = 0;
  let return_swaps = 0;
  let lastswap, n_swaps, iter;
  let removal_loss = new Array(k).fill(0);
  let return_meds = med.slice();
  while (k >= 3 && k >= minimum_k) {
    update_removal_loss(data, removal_loss);
    lastswap = n;
    n_swaps = 0;
    iter = 0;
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
        if (change <= 0) {
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
    let r = [0, USIZE_MAX];
    for (let o = 0; o < removal_loss.length; o++) {
      const remloss = removal_loss[o];
      if (o === 0 || remloss < r[0]) {
        r = [remloss, o];
      }
    }
    loss = 1 - loss / n;
    return_loss[k - minimum_k] = loss;
    const assi = data.map((x) => x.near.i);
    if (loss > best_loss) {
      best_loss = loss;
      return_assi = assi;
      return_meds = med.slice();
    }
    return_swaps += n_swaps;
    return_iter += iter;
    loss = remove_med(mat, med, data, r[1]);
    removal_loss.splice(r[1], 1);
    k = med.length;
  }
  if (minimum_k <= 2) {
    const { loss: loss2, assi: assi2, nIter: iter2, nSwaps: n_swaps2 } = fastermsc_k2(mat, med, maxiter);
    return_loss[2 - minimum_k] = loss2;
    if (loss2 > best_loss) {
      best_loss = loss2;
      return_meds = med.slice();
      return_assi = assi2;
    }
    return_swaps += n_swaps2;
    return_iter += iter2;
  }
  if (minimum_k <= 1) {
    return_loss[0] = 0;
  }
  return { loss: best_loss, assi: return_assi, nIter: return_iter, nSwaps: return_swaps, meds: return_meds, losses: return_loss };
}

/**
 * Update the third nearest medoid information. Called after each swap.
 * Returns a fresh DistancePair.
 */
export function update_third_nearest_without_new(mat, med, n, s, b, o) {
  let dist = new DistancePair(b, 0);
  for (let i = 0; i < med.length; i++) {
    const mi = med[i];
    if (i === n || i === s) {
      continue;
    }
    const d = mat.get(o, mi);
    if (dist.i === b || d < dist.d) {
      dist = new DistancePair(i, d);
    }
  }
  return dist;
}

/** Remove one medoid. Returns RAW loss. */
export function remove_med(mat, med, data, b) {
  const l = med.length - 1;
  if (!(b < med.length)) throw new Error('invalid medoid number');
  med[b] = med[l];
  med.splice(l, 1);
  let acc = 0;
  for (let o = 0; o < data.length; o++) {
    const reco = data[o];
    if (reco.near.i === b) {
      // nearest medoid is gone
      if (reco.seco.i === l) {
        reco.seco.i = b;
      }
      if (reco.third.i === l) {
        reco.third.i = b;
      }
      reco.near = reco.seco.clone();
      reco.seco = reco.third.clone();
      reco.third = update_third_nearest_without_new(mat, med, reco.near.i, reco.seco.i, b, o);
    } else if (reco.seco.i === b) {
      // second nearest is gone
      if (reco.near.i === l) {
        reco.near.i = b;
      }
      if (reco.third.i === l) {
        reco.third.i = b;
      }
      reco.seco = reco.third.clone();
      reco.third = update_third_nearest_without_new(mat, med, reco.near.i, reco.seco.i, b, o);
    } else if (reco.third.i === b) {
      // third nearest is gone
      if (reco.near.i === l) {
        reco.near.i = b;
      }
      if (reco.seco.i === l) {
        reco.seco.i = b;
      }
      reco.third = update_third_nearest_without_new(mat, med, reco.near.i, reco.seco.i, b, o);
    } else {
      if (reco.near.i === l) {
        reco.near.i = b;
      }
      if (reco.seco.i === l) {
        reco.seco.i = b;
      }
      if (reco.third.i === l) {
        reco.third.i = b;
      }
    }
    acc += _loss(reco.near.d, reco.seco.d);
  }
  return acc;
}
