// Parallelism (rayon) collapsed to sequential equivalent for JS.
import { arrayAdapter } from './arrayadapter.mjs';
import { checked_div } from './silhouette.mjs';

/**
 * Compute the Silhouette of a strict partitional clustering (sequential JS port of parallel Rust impl).
 *
 * @param {object|Array} mat - pairwise distance matrix (will be wrapped by arrayAdapter)
 * @param {number[]} assi - cluster assignment for each point
 * @returns {number} the average silhouette value
 */
export function par_silhouette(mat, assi) {
  mat = arrayAdapter(mat);
  if (!mat.isSquare()) throw new Error('Dissimilarity matrix is not square');
  let lsum = 0;
  for (let i = 0; i < assi.length; i++) {
    const ai = assi[i];
    // buf[c] = [count, sum] for cluster c
    const buf = [];
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
    if (buf[ai][0] > 0) {
      const a = checked_div(buf[ai][1], buf[ai][0]);
      // find minimum average distance to any other cluster (b)
      // mirrors Rust: tmp.next().unwrap_or_else(L::zero) seeds the fold
      let tmp2 = 0;
      let foundFirst = false;
      let b = 0;
      for (let c = 0; c < buf.length; c++) {
        if (c === ai) continue;
        const avg = checked_div(buf[c][1], buf[c][0]);
        if (!foundFirst) {
          tmp2 = avg;
          foundFirst = true;
          b = tmp2;
        } else {
          b = avg < b ? avg : b;
        }
      }
      // if no other cluster exists, foundFirst is false → b = tmp2 = 0
      lsum += checked_div(b - a, a > b ? a : b);
    }
    // else: singleton, contributes 0 (lsum unchanged)
  }
  return lsum / assi.length;
}
