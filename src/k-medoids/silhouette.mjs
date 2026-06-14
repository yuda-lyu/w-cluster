// Silhouette evaluation measures, ported from src/silhouette.rs
import { arrayAdapter } from './arrayadapter.mjs';

/**
 * Compute the Silhouette of a strict partitional clustering.
 *
 * The Silhouette, proposed by Peter Rousseeuw in 1987, is a popular internal
 * evaluation measure for clusterings.
 *
 * @param mat - a pairwise distance matrix
 * @param assi - the cluster assignment
 * @param samples - whether to keep the individual samples, or not
 * @returns { sil, samples } where sil is the average silhouette and samples are
 *          the individual silhouette values (empty [] if samples = false)
 */
export function silhouette(mat, assi, samples = false) {
  mat = arrayAdapter(mat);
  if (!mat.isSquare()) throw new Error('Dissimilarity matrix is not square');
  let sil = new Array(samples ? assi.length : 0).fill(0);
  let lsum = 0;
  let buf = []; // array of [count(u32), sum(L)] pairs
  for (let i = 0; i < assi.length; i++) {
    const ai = assi[i];
    buf.length = 0;
    for (let j = 0; j < assi.length; j++) {
      const aj = assi[j];
      while (aj >= buf.length) {
        buf.push([0, 0]);
      }
      if (i !== j) {
        buf[aj][0] += 1;
        buf[aj][1] += mat.get(i, j);
      }
    }
    if (buf.length === 1) {
      return { sil: 0, samples: sil };
    }
    let s;
    if (buf[ai][0] > 0) {
      const a = checked_div(buf[ai][1], buf[ai][0]);
      // Ugly hack to get the min():
      let started = false;
      let b = 0;
      for (let k = 0; k < buf.length; k++) {
        if (k === ai) continue;
        const p = buf[k];
        const y = checked_div(p[1], p[0]);
        if (!started) {
          b = y; // tmp.next().unwrap_or_else(L::zero)
          started = true;
        } else {
          b = y < b ? y : b; // tmp.fold(tmp2, |x, y| if y < x { y } else { x })
        }
      }
      // tmp2 = tmp.next().unwrap_or_else(L::zero): if no element, b stays 0
      s = checked_div(b - a, a > b ? a : b);
    } else {
      s = 0; // singleton
    }
    if (samples) {
      sil[i] = s;
    }
    lsum += s;
  }
  return { sil: lsum / assi.length, samples: sil };
}

/**
 * Compute the Medoid Silhouette of a clustering.
 *
 * The Medoid Silhouette is an approximation to the original Silhouette where the
 * distance to the cluster medoid is used instead of the average distance.
 *
 * @param mat - a pairwise distance matrix
 * @param meds - the medoid list
 * @param samples - whether to keep the individual samples, or not
 * @returns { sil, samples } where sil is the average medoid silhouette and
 *          samples are the individual values (empty [] if samples = false)
 */
export function medoid_silhouette(mat, meds, samples = false) {
  mat = arrayAdapter(mat);
  const n = mat.len(), k = meds.length;
  if (!mat.isSquare()) throw new Error('Dissimilarity matrix is not square');
  if (!(n <= U32_MAX_GUARD)) throw new Error('N is too large');
  let sil = new Array(samples ? n : 0).fill(1);
  if (k === 1) { return { sil: 1, samples: sil }; } // not really well-defined
  if (!(k >= 2 && k <= n)) throw new Error('invalid k, must be over 1 and at most N');
  let loss = 0;
  for (let i = 0; i < n; i++) {
    const d1 = mat.get(i, meds[0]), d2 = mat.get(i, meds[1]);
    let best = d1 < d2 ? [d1, d2] : [d2, d1];
    for (let s2 = 2; s2 < meds.length; s2++) {
      const m = meds[s2];
      const d = mat.get(i, m);
      if (d < best[0]) {
        best = [d, best[0]];
      } else if (d < best[1]) {
        best = [best[0], d];
      }
    }
    if (best[0] !== 0) {
      const s = best[0] / best[1];
      if (samples) { sil[i] = 1 - s; }
      loss += s;
    }
  }
  loss = 1 - loss / n;
  return { sil: loss, samples: sil };
}

// u32::MAX, used only for the "N is too large" assertion.
const U32_MAX_GUARD = 4294967295;

// helper function, returns 0 on division by 0
export function checked_div(x, y) {
  if (y > 0) {
    return x / y;
  } else {
    return 0;
  }
}
