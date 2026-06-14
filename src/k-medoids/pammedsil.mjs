// Ported 1:1 from src/pammedsil.rs (PAMMEDSIL algorithm).
import { arrayAdapter } from './arrayadapter.mjs';
import { Reco, DistancePair, U32_MAX, USIZE_MAX, choose_medoid_within_partition } from './util.mjs';
import { _loss, initial_assignment, do_swap } from './fastermsc.mjs';

/**
 * Run the original PAMMEDSIL SWAP algorithm (no initialization, but given initial medoids).
 * @param {object} mat - pairwise distance matrix
 * @param {number[]} med - the list of medoids (mutated in place)
 * @param {number} maxiter - the maximum number of iterations allowed
 * returns { loss, assi, nIter, nSwaps }
 */
export function pammedsil_swap(mat, med, maxiter) {
  mat = arrayAdapter(mat);
  const [loss, data] = initial_assignment(mat, med);
  return pammedsil_optimize(mat, med, data, maxiter, loss);
}

/**
 * Run the original PAM BUILD algorithm combined with the PAMMEDSIL SWAP.
 * @param {object} mat - pairwise distance matrix
 * @param {number} k - the number of medoids to pick
 * @param {number} maxiter - the maximum number of iterations allowed
 * returns { loss, assi, meds, nIter, nSwaps }
 */
export function pammedsil(mat, k, maxiter) {
  mat = arrayAdapter(mat);
  const n = mat.len();
  if (!mat.isSquare()) throw new Error('Dissimilarity matrix is not square');
  if (!(n <= U32_MAX)) throw new Error('N is too large');
  if (!(k > 0 && k < U32_MAX)) throw new Error('invalid N');
  if (!(k <= n)) throw new Error('k must be at most N');
  const meds = [];
  const data = [];
  const loss = pammedsil_build_initialize(mat, meds, data, k);
  const { loss: nloss, assi, nIter, nSwaps } = pammedsil_optimize(mat, meds, data, maxiter, loss);
  return { loss: nloss, assi, meds, nIter, nSwaps }; // also return medoids
}

/** Main optimization function of PAMMEDSIL, not exposed (use pammedsil_swap or pammedsil) */
function pammedsil_optimize(mat, med, data, maxiter, loss) {
  const n = mat.len(), k = med.length;
  if (k === 1) {
    const assi = new Array(n).fill(0);
    const [swapped, lloss] = choose_medoid_within_partition(mat, assi, med, 0);
    return { loss: lloss, assi, nIter: 1, nSwaps: swapped ? 1 : 0 };
  }
  let n_swaps = 0, iter = 0;
  while (iter < maxiter) {
    iter += 1;
    let best = [0, k, USIZE_MAX];
    for (let j = 0; j < n; j++) {
      if (j === med[data[j].near.i]) {
        continue; // This already is a medoid
      }
      const [change, b] = (k === 2)
        ? find_best_swap_pammedsil_k2(mat, med, data, j)
        : find_best_swap_pammedsil(mat, med, data, j);
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

/** Find the best swap for object j. Returns [change, b]. */
function find_best_swap_pammedsil(mat, med, data, j) {
  const recj = data[j];
  let best = [0, USIZE_MAX];
  for (let m = 0; m < med.length; m++) {
    let acc = _loss(recj.near.d, recj.seco.d); // j becomes medoid
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
          acc += _loss(reco.near.d, reco.seco.d) - _loss(doj, reco.seco.d);
        } else if (doj < reco.third.d) {
          // Assign to second nearest instead:
          acc += _loss(reco.near.d, reco.seco.d) - _loss(reco.seco.d, doj);
        } else {
          acc += _loss(reco.near.d, reco.seco.d) - _loss(reco.seco.d, reco.third.d);
        }
      } else if (reco.seco.i === m) {
        if (doj < reco.near.d) {
          acc += _loss(reco.near.d, reco.seco.d) - _loss(doj, reco.near.d);
        } else if (doj < reco.third.d) {
          acc += _loss(reco.near.d, reco.seco.d) - _loss(reco.near.d, doj);
        } else {
          acc += _loss(reco.near.d, reco.seco.d) - _loss(reco.near.d, reco.third.d);
        }
      } else {
        if (doj < reco.near.d) {
          acc += _loss(reco.near.d, reco.seco.d) - _loss(doj, reco.near.d);
        } else if (doj < reco.seco.d) {
          acc += _loss(reco.near.d, reco.seco.d) - _loss(reco.near.d, doj);
        }
      }
    }
    if (acc > best[0]) {
      best = [acc, m];
    }
  }
  return best;
}

/** Find the best swap for object j (k=2 variant). Returns [change, b]. */
function find_best_swap_pammedsil_k2(mat, med, data, j) {
  const recj = data[j];
  let best = [0, USIZE_MAX];
  for (let m = 0; m < med.length; m++) {
    let acc = _loss(recj.near.d, recj.seco.d); // j becomes medoid
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
          acc += _loss(reco.near.d, reco.seco.d) - _loss(doj, reco.seco.d);
        } else {
          // Assign to second nearest instead:
          acc += _loss(reco.near.d, reco.seco.d) - _loss(reco.seco.d, doj);
        }
      } else if (reco.seco.i === m) {
        if (doj < reco.near.d) {
          acc += _loss(reco.near.d, reco.seco.d) - _loss(doj, reco.near.d);
        } else {
          acc += _loss(reco.near.d, reco.seco.d) - _loss(reco.near.d, doj);
        }
      } else {
        if (doj < reco.near.d) {
          acc += _loss(reco.near.d, reco.seco.d) - _loss(doj, reco.near.d);
        } else if (doj < reco.seco.d) {
          acc += _loss(reco.near.d, reco.seco.d) - _loss(reco.near.d, doj);
        }
      }
    }
    if (acc > best[0]) {
      best = [acc, m];
    }
  }
  return best;
}

/** Not exposed. Use pammedsil_build or pammedsil. Pushes into meds & data. Returns loss. */
function pammedsil_build_initialize(mat, meds, data, k) {
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
  for (let j = 0; j < n; j++) {
    data.push(new Reco(0, mat.get(j, best[1]), U32_MAX, 0, U32_MAX, 0));
  }
  // choose remaining medoids
  for (let l = 1; l < k; l++) {
    best = [0, k];
    for (let i = 1; i < data.length; i++) {
      let sum = -data[i].near.d;
      for (let jj = 0; jj < data.length; jj++) {
        const dj = data[jj];
        if (jj !== i) {
          const d = mat.get(jj, i);
          if (d < dj.near.d) {
            sum += d - dj.near.d;
          }
        }
      }
      if (i === 0 || sum < best[0]) {
        best = [sum, i];
      }
    }
    if (best[0] >= 0) { break; } // No more improvement, duplicates
    // Update assignments:
    loss = 0;
    for (let jj = 0; jj < data.length; jj++) {
      const recj = data[jj];
      if (jj === best[1]) {
        recj.third = recj.seco.clone();
        recj.seco = recj.near.clone();
        recj.near = new DistancePair(l, 0);
      } else {
        const dj = mat.get(jj, best[1]);
        if (dj < recj.near.d) {
          recj.third = recj.seco.clone();
          recj.seco = recj.near.clone();
          recj.near = new DistancePair(l, dj);
        } else if (recj.seco.i === U32_MAX || dj < recj.seco.d) {
          recj.third = recj.seco.clone();
          recj.seco = new DistancePair(l, dj);
        } else if (recj.third.i === U32_MAX || dj < recj.third.d) {
          recj.third = new DistancePair(l, dj);
        }
      }
      loss += _loss(recj.near.d, recj.seco.d);
    }
    meds.push(best[1]);
  }
  return loss;
}
