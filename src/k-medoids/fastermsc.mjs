// Ported 1:1 from src/fastermsc.rs (FasterMSC algorithm).
import { arrayAdapter } from './arrayadapter.mjs';
import { Reco, DistancePair, U32_MAX, find_min, find_max, choose_medoid_within_partition } from './util.mjs';

// _loss(a, b): 0 if a or b is zero, else a / b.
export function _loss(a, b) {
  if (a === 0 || b === 0) { return 0; } else { return a / b; }
}

/**
 * Run the FasterMSC algorithm.
 * @param {object} mat - pairwise distance matrix (wrapped)
 * @param {number[]} med - the list of medoids (mutated in place)
 * @param {number} maxiter - maximum number of iterations
 * returns { loss, assi, nIter, nSwaps }
 */
export function fastermsc(mat, med, maxiter) {
  mat = arrayAdapter(mat);
  const n = mat.len(), k = med.length;
  if (k === 1) {
    const assi = new Array(n).fill(0);
    const [swapped, loss] = choose_medoid_within_partition(mat, assi, med, 0);
    return { loss, assi, nIter: 1, nSwaps: swapped ? 1 : 0 };
  }
  if (k === 2) { // special hadling, as there is no third
    return fastermsc_k2(mat, med, maxiter);
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
  const assi = data.map((x) => x.near.i);
  loss = 1 - loss / n;
  return { loss, assi, nIter: iter, nSwaps: n_swaps };
}

/** Perform the initial assignment to medoids. Returns [loss, data] (data = Reco[]). */
export function initial_assignment(mat, med) {
  const n = mat.len(), k = med.length;
  if (!mat.isSquare()) throw new Error('Dissimilarity matrix is not square');
  if (!(n <= U32_MAX)) throw new Error('N is too large');
  if (!(k > 0 && k < U32_MAX)) throw new Error('invalid N');
  if (!(k <= n)) throw new Error('k must be at most N');
  const data = new Array(mat.len());
  for (let _i = 0; _i < data.length; _i++) data[_i] = Reco.empty();
  const firstcenter = med[0];
  let loss = 0;
  for (let i = 0; i < data.length; i++) {
    // Rust: *cur = Reco::new(...) overwrites the slot in place.
    const cur = new Reco(0, mat.get(i, firstcenter), U32_MAX, 0, U32_MAX, 0);
    data[i] = cur;
    for (let m = 1; m < med.length; m++) {
      const me = med[m];
      const d = mat.get(i, me);
      if (d < cur.near.d || i === me) {
        cur.third = cur.seco.clone();
        cur.seco = cur.near.clone();
        cur.near = new DistancePair(m, d);
      } else if (cur.seco.i === U32_MAX || d < cur.seco.d) {
        cur.third = cur.seco.clone();
        cur.seco = new DistancePair(m, d);
      } else if (cur.third.i === U32_MAX || d < cur.third.d) {
        cur.third = new DistancePair(m, d);
      }
    }
    loss += _loss(cur.near.d, cur.seco.d);
  }
  return [loss, data];
}

/** Find the best swap for object j - FastMSC version. Returns [change, b]. */
export function find_best_swap(mat, removal_loss, data, j) {
  const ploss = removal_loss.slice();
  // Improvement from the journal version:
  let acc = 0;
  for (let o = 0; o < data.length; o++) {
    const reco = data[o];
    const doj = mat.get(o, j);
    if (doj < reco.near.d) {
      acc += _loss(reco.near.d, reco.seco.d) - _loss(doj, reco.near.d);
      // loss already includes (dt - ds) - (ds - dn), remove
      ploss[reco.near.i] += _loss(doj, reco.near.d) + _loss(reco.seco.d, reco.third.d) - _loss(reco.near.d + doj, reco.seco.d);
      ploss[reco.seco.i] += _loss(reco.near.d, reco.third.d) - _loss(reco.near.d, reco.seco.d);
    } else if (doj < reco.seco.d) {
      acc += _loss(reco.near.d, reco.seco.d) - _loss(reco.near.d, doj);
      ploss[reco.near.i] += _loss(reco.near.d, doj) + _loss(reco.seco.d, reco.third.d) - _loss(reco.near.d + doj, reco.seco.d);
      // loss already includes (dt - ds) - (ds - dn), adjust to 2*d(xo) - ds - dt
      // loss already includes (dt - ds), adjust to 2*d(xo) - ds - dt
      ploss[reco.seco.i] += _loss(reco.near.d, reco.third.d) - _loss(reco.near.d, reco.seco.d);
    } else if (doj < reco.third.d) {
      // loss already includes (dt - ds) - (ds - dn), adjust to d(xo)- dt
      ploss[reco.near.i] += _loss(reco.seco.d, reco.third.d) - _loss(reco.seco.d, doj);
      // loss already includes (dt - ds), adjust to d(xo)- dt
      ploss[reco.seco.i] += _loss(reco.near.d, reco.third.d) - _loss(reco.near.d, doj);
    }
  }
  const [b, bloss] = find_max(ploss);
  return [bloss + acc, b]; // add the shared accumulator
}

/** Update the loss when removing each medoid. Mutates loss in place. */
export function update_removal_loss(data, loss) {
  loss.fill(0); // stable since 1.50
  for (let r = 0; r < data.length; r++) {
    const rec = data[r];
    loss[rec.near.i] += _loss(rec.near.d, rec.seco.d) - _loss(rec.seco.d, rec.third.d);
    loss[rec.seco.i] += _loss(rec.near.d, rec.seco.d) - _loss(rec.near.d, rec.third.d);
    // as N might be unsigned
  }
}

/** Update the third nearest medoid information. Called after each swap. Returns fresh DistancePair. */
export function update_third_nearest(mat, med, n, s, b, o, doj) {
  let dist = new DistancePair(b, doj);
  for (let i = 0; i < med.length; i++) {
    const mi = med[i];
    if (i === n || i === b || i === s) {
      continue;
    }
    const d = mat.get(o, mi);
    if (d < dist.d) {
      dist = new DistancePair(i, d);
    }
  }
  return dist;
}

/** Perform a single swap. Returns RAW loss. */
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
        if (reco.seco.i !== b) {
          reco.third = reco.seco.clone();
        }
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
      } else if (reco.third.i === U32_MAX || doj < reco.third.d) {
        reco.near = reco.seco.clone();
        reco.seco = new DistancePair(b, doj);
      } else {
        reco.near = reco.seco.clone();
        reco.seco = reco.third.clone();
        reco.third = update_third_nearest(mat, med, reco.near.i, reco.seco.i, b, o, doj);
      }
    } else if (reco.seco.i === b) {
      // second nearest was replaced
      if (doj < reco.near.d) {
        reco.seco = reco.near.clone();
        reco.near = new DistancePair(b, doj);
      } else if (reco.third.i === U32_MAX || doj < reco.third.d) {
        reco.seco = new DistancePair(b, doj);
      } else {
        reco.seco = reco.third.clone();
        reco.third = update_third_nearest(mat, med, reco.near.i, reco.seco.i, b, o, doj);
      }
    } else {
      // nearest not removed
      if (doj < reco.near.d) {
        reco.third = reco.seco.clone();
        reco.seco = reco.near.clone();
        reco.near = new DistancePair(b, doj);
      } else if (doj < reco.seco.d) {
        reco.third = reco.seco.clone();
        reco.seco = new DistancePair(b, doj);
      } else if (reco.third.i === U32_MAX || doj < reco.third.d) {
        reco.third = new DistancePair(b, doj);
      } else if (reco.third.i === b) {
        reco.third = update_third_nearest(mat, med, reco.near.i, reco.seco.i, b, o, doj);
      }
    }
    acc += _loss(reco.near.d, reco.seco.d);
  }
  return acc;
}

/** Special case k=2 of the FasterMSC algorithm. Returns { loss, assi, nIter, nSwaps }. */
export function fastermsc_k2(mat, med, maxiter) {
  const n = mat.len(), k = med.length;
  if (!(k === 2)) throw new Error('Only valid for k=2');
  let [loss, assi, data] = initial_assignment_k2(mat, med);
  let lastswap = n, n_swaps = 0, iter = 0;
  while (iter < maxiter) {
    iter += 1;
    const swaps_before = n_swaps, lastloss = loss;
    for (let j = 0; j < n; j++) {
      if (j === lastswap) {
        break;
      }
      if (j === med[assi[j]]) {
        continue; // This already is a medoid
      }
      const [newloss, b] = find_best_swap_k2(mat, data, j); // assi not used, see below
      if (newloss >= loss) {
        continue; // No improvement
      }
      n_swaps += 1;
      lastswap = j;
      // perform the swap
      loss = do_swap_k2(mat, med, assi, data, b, j);
    }
    if (n_swaps === swaps_before || loss >= lastloss) {
      break; // converged
    }
  }
  loss = 1 - loss / n;
  return { loss, assi, nIter: iter, nSwaps: n_swaps };
}

/** Perform the initial assignment to medoids, for k=2 only. Returns [loss, assi, data] (data = [d0,d1] pairs). */
export function initial_assignment_k2(mat, med) {
  const n = mat.len(), k = med.length;
  if (!mat.isSquare()) throw new Error('Dissimilarity matrix is not square');
  if (!(n <= U32_MAX)) throw new Error('N is too large');
  if (!(k === 2)) throw new Error('k must be 2');
  const assi = new Array(mat.len()).fill(0);
  const data = new Array(mat.len());
  for (let _i = 0; _i < data.length; _i++) data[_i] = [0, 0];
  let loss = 0;
  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    d[0] = mat.get(i, med[0]);
    d[1] = mat.get(i, med[1]);
    if (d[0] < d[1]) {
      assi[i] = 0;
      loss += _loss(d[0], d[1]); // return
    } else {
      assi[i] = 1;
      loss += _loss(d[1], d[0]); // return
    }
  }
  return [loss, assi, data];
}

/** Find the best swap for object j - FastMSC version, k=2. Returns [loss, b]. */
export function find_best_swap_k2(mat, data, j) {
  const ploss = [0, 0];
  for (let o = 0; o < data.length; o++) {
    const d = data[o];
    const doj = mat.get(o, j);
    // We do not use the assignment here, because we stored d0/d1 by medoid position, not closeness
    ploss[0] += (doj < d[1]) ? _loss(doj, d[1]) : _loss(d[1], doj);
    ploss[1] += (doj < d[0]) ? _loss(doj, d[0]) : _loss(d[0], doj);
  }
  const [b, bloss] = find_min(ploss);
  return [bloss, b];
}

/** Perform a single swap, k=2. Returns RAW loss. */
export function do_swap_k2(mat, med, assi, data, b, j) {
  const n = mat.len();
  if (!(b < med.length)) throw new Error('invalid medoid number');
  if (!(j < n)) throw new Error('invalid object number');
  med[b] = j;
  // Its nicer to have the if outside, even though this looks duplicated
  if (b === 0) {
    let acc = 0;
    for (let o = 0; o < data.length; o++) {
      const d = data[o];
      if (o === j) {
        assi[o] = 0;
        d[0] = 0;
        acc += 0;
        continue;
      }
      const doj = mat.get(o, j);
      d[0] = doj;
      if (doj < d[1] || (doj === d[1] && assi[o] === 0)) {
        assi[o] = 0;
        acc += _loss(doj, d[1]); // return
      } else {
        assi[o] = 1;
        acc += _loss(d[1], doj); // return
      }
    }
    return acc;
  } else { // b == 1
    let acc = 0;
    for (let o = 0; o < data.length; o++) {
      const d = data[o];
      if (o === j) {
        assi[o] = 1;
        d[1] = 0;
        acc += 0;
        continue;
      }
      const doj = mat.get(o, j);
      d[1] = doj;
      if (doj < d[0] || (doj === d[0] && assi[o] === 1)) {
        assi[o] = 1;
        acc += _loss(doj, d[0]); // return
      } else {
        assi[o] = 0;
        acc += _loss(d[0], doj); // return
      }
    }
    return acc;
  }
}
