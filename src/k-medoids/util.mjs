// Utility types and helpers, ported from src/util.rs
export const U32_MAX = 4294967295;
export const USIZE_MAX = Number.MAX_SAFE_INTEGER;

/** Object id (i) and distance (d) pair. */
export class DistancePair {
  constructor(i, d) { this.i = i; this.d = d; }
  clone() { return new DistancePair(this.i, this.d); }
  static empty() { return new DistancePair(U32_MAX, 0); }
}

/** Per-point record: nearest + second nearest medoid. */
export class Rec {
  constructor(i1, d1, i2, d2) { this.near = new DistancePair(i1, d1); this.seco = new DistancePair(i2, d2); }
  clone() { return new Rec(this.near.i, this.near.d, this.seco.i, this.seco.d); }
  static empty() { return new Rec(U32_MAX, 0, U32_MAX, 0); }
}

/** Per-point record: nearest + second + third nearest medoid. */
export class Reco {
  constructor(i1, d1, i2, d2, i3, d3) {
    this.near = new DistancePair(i1, d1);
    this.seco = new DistancePair(i2, d2);
    this.third = new DistancePair(i3, d3);
  }
  clone() { return new Reco(this.near.i, this.near.d, this.seco.i, this.seco.d, this.third.i, this.third.d); }
  static empty() { return new Reco(U32_MAX, 0, U32_MAX, 0, U32_MAX, 0); }
}

/** Find the minimum (index and value) over an array of numbers. */
export function find_min(arr) {
  let bi = 0, bv = arr[0];
  for (let i = 1; i < arr.length; i++) { if (arr[i] < bv) { bi = i; bv = arr[i]; } }
  return [bi, bv];
}

/** Find the maximum (index and value) over an array of numbers. */
export function find_max(arr) {
  let bi = 0, bv = arr[0];
  for (let i = 1; i < arr.length; i++) { if (arr[i] > bv) { bi = i; bv = arr[i]; } }
  return [bi, bv];
}

/** Choose the best medoid within a partition. Mutates med[m]. Returns [changed, sumb]. */
export function choose_medoid_within_partition(mat, assi, med, m) {
  const first = med[m];
  let best = first;
  let sumb = 0;
  for (let i = 0; i < assi.length; i++) {
    if (first !== i && assi[i] === m) sumb += mat.get(first, i);
  }
  for (let j = 0; j < assi.length; j++) {
    if (j !== first && assi[j] === m) {
      let sumj = 0;
      for (let i = 0; i < assi.length; i++) {
        if (i !== j && assi[i] === m) sumj += mat.get(j, i);
      }
      if (sumj < sumb) { best = j; sumb = sumj; }
    }
  }
  med[m] = best;
  return [best !== first, sumb];
}
