// Initialization helpers, ported from src/initialization.rs (RNG approximated for JS)

/** Use the first k objects (0..k-1) as initial medoids. */
export function first_k(k) {
  return Array.from({ length: k }, (_, i) => i);
}

/** Sample k DISTINCT indices from [0, n) using Floyd's algorithm. rng: () => float in [0,1). */
export function sample(rng, n, k) {
  if (k > n) throw new Error('`amount` of samples must be less than or equal to `length`');
  const chosen = new Set();
  const res = [];
  for (let j = n - k; j < n; j++) {
    const t = Math.floor(rng() * (j + 1)); // 0..j inclusive
    const v = chosen.has(t) ? j : t;
    chosen.add(v);
    res.push(v);
  }
  return res;
}

/** Random initialization: k distinct medoid indices in [0, n). */
export function random_initialization(n, k, rng = Math.random) {
  return sample(rng, n, k);
}

/** Fisher-Yates shuffle of [0, n). Used by rand_fasterpam / par_fasterpam. */
export function shuffle(rng, n) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}
