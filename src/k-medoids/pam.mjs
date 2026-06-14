// PAM (BUILD and SWAP) algorithm, ported 1:1 from src/pam.rs
import { arrayAdapter } from './arrayadapter.mjs';
import { Rec, DistancePair, U32_MAX, USIZE_MAX, choose_medoid_within_partition } from './util.mjs';
import { initial_assignment, do_swap } from './fasterpam.mjs';

/**
 * Run the original PAM SWAP algorithm (no BUILD, but given initial medoids).
 *
 * Provided for academic reasons to see the performance difference.
 *
 * @param mat - a pairwise distance matrix
 * @param med - the list of medoids (mutated in place)
 * @param maxiter - the maximum number of iterations allowed
 * @returns { loss, assi, nIter, nSwaps }
 */
export function pam_swap(mat, med, maxiter) {
  mat = arrayAdapter(mat);
  const [loss, data] = initial_assignment(mat, med);
  const [nloss, assi, nIter, nSwaps] = pam_optimize(mat, med, data, maxiter, loss);
  return { loss: nloss, assi, nIter, nSwaps };
}

/**
 * Run the original PAM BUILD algorithm.
 *
 * Provided for academic reasons to see the performance difference.
 *
 * @param mat - a pairwise distance matrix
 * @param k - the number of medoids to pick
 * @returns { loss, assi, meds }
 */
export function pam_build(mat, k) {
  mat = arrayAdapter(mat);
  const n = mat.len();
  if (!mat.isSquare()) throw new Error('Dissimilarity matrix is not square');
  if (!(n <= U32_MAX)) throw new Error('N is too large');
  if (!(k > 0 && k < U32_MAX)) throw new Error('invalid N');
  if (!(k <= n)) throw new Error('k must be at most N');
  const meds = [];
  const data = [];
  const loss = pam_build_initialize(mat, meds, data, k);
  const assi = data.map((x) => x.near.i);
  return { loss, assi, meds };
}

/**
 * Run the original PAM algorithm (BUILD and SWAP).
 *
 * Provided for academic reasons to see the performance difference.
 *
 * @param mat - a pairwise distance matrix
 * @param k - the number of medoids to pick
 * @param maxiter - the maximum number of iterations allowed
 * @returns { loss, assi, meds, nIter, nSwaps }
 */
export function pam(mat, k, maxiter) {
  mat = arrayAdapter(mat);
  const n = mat.len();
  if (!mat.isSquare()) throw new Error('Dissimilarity matrix is not square');
  if (!(n <= U32_MAX)) throw new Error('N is too large');
  if (!(k > 0 && k < U32_MAX)) throw new Error('invalid N');
  if (!(k <= n)) throw new Error('k must be at most N');
  const meds = [];
  const data = [];
  const loss = pam_build_initialize(mat, meds, data, k);
  const [nloss, assi, nIter, nSwaps] = pam_optimize(mat, meds, data, maxiter, loss);
  return { loss: nloss, assi, meds, nIter, nSwaps }; // also return medoids
}

/** Main optimization function of PAM, not exposed (use pam_swap or pam). Returns [loss, assi, nIter, nSwaps]. */
function pam_optimize(mat, med, data, maxiter, loss) {
  const n = mat.len(), k = med.length;
  if (k === 1) {
    const assi = new Array(n).fill(0);
    const [swapped, sloss] = choose_medoid_within_partition(mat, assi, med, 0);
    return [sloss, assi, 1, swapped ? 1 : 0];
  }
  let n_swaps = 0, iter = 0;
  while (iter < maxiter) {
    iter += 1;
    let best = [0, k, USIZE_MAX];
    for (let j = 0; j < n; j++) {
      if (j === med[data[j].near.i]) {
        continue; // This already is a medoid
      }
      const [change, b] = find_best_swap_pam(mat, med, data, j);
      if (change >= best[0]) {
        continue; // No improvement
      }
      best = [change, b, j];
    }
    if (best[0] < 0) {
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
  return [loss, assi, iter, n_swaps];
}

/** Find the best swap for object j - slower PAM version. Returns [acc_best, m_best]. */
function find_best_swap_pam(mat, med, data, j) {
  const recj = data[j];
  let best = [0, USIZE_MAX];
  for (let m = 0; m < med.length; m++) {
    let acc = -recj.near.d; // j becomes medoid
    for (let o = 0; o < data.length; o++) {
      const reco = data[o];
      if (o === j) {
        continue;
      }
      const doj = mat.get(o, j);
      // Current medoid is being replaced:
      if (reco.near.i === m) {
        if (doj < reco.seco.d) {
          // Assign to new medoid:
          acc += doj - reco.near.d;
        } else {
          // Assign to second nearest instead:
          acc += reco.seco.d - reco.near.d;
        }
      } else if (doj < reco.near.d) {
        // new mediod is closer:
        acc += doj - reco.near.d;
      } // else no change
    }
    if (acc < best[0]) {
      best = [acc, m];
    }
  }
  return best;
}

/** Not exposed. Use pam_build or pam. Pushes into medsArr (numbers) and dataArr (Rec). Returns loss. */
export function pam_build_initialize(mat, meds, data, k) {
  const n = mat.len();
  if (!mat.isSquare()) throw new Error('Dissimilarity matrix is not square');
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
  for (let j = 0; j < n; j++) {
    data.push(new Rec(0, mat.get(j, best[1]), U32_MAX, 0));
  }
  // choose remaining medoids
  for (let l = 1; l < k; l++) {
    best = [0, k];
    for (let i = 0; i < data.length; i++) {
      let sum = -data[i].near.d;
      for (let j = 0; j < data.length; j++) {
        const dj = data[j];
        if (j !== i) {
          const d = mat.get(j, i);
          if (d < dj.near.d) {
            sum += d - dj.near.d;
          }
        }
      }
      if (i === 0 || sum < best[0]) {
        best = [sum, i];
      }
    }
    if (best[0] >= 0) { break; } // No further improvements - duplicates etc.
    // Update assignments:
    loss = 0;
    for (let j = 0; j < data.length; j++) {
      const recj = data[j];
      if (j === best[1]) {
        recj.seco = recj.near.clone();
        recj.near = new DistancePair(l, 0);
        continue;
      }
      const dj = mat.get(j, best[1]);
      if (dj < recj.near.d) {
        recj.seco = recj.near.clone();
        recj.near = new DistancePair(l, dj);
      } else if (recj.seco.i === U32_MAX || dj < recj.seco.d) {
        recj.seco = new DistancePair(l, dj);
      }
      loss += recj.near.d;
    }
    meds.push(best[1]);
  }
  return loss;
}
