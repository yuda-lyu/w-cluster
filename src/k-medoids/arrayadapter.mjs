// Array adapters, ported from src/arrayadapter.rs
// All matrices expose: len() -> n, isSquare() -> bool, get(x, y) -> number

/** Wraps a dense 2D array (array of equal-length rows). */
export class DenseMatrix {
  constructor(rows) { this.rows = rows; }
  len() { return this.rows.length; }
  isSquare() {
    const n = this.rows.length;
    for (let i = 0; i < n; i++) { if (this.rows[i].length !== n) return false; }
    return true;
  }
  get(x, y) { return this.rows[x][y]; }
}

/** Lower triangular matrix in serial form (without diagonal). data length = n*(n-1)/2. */
export class LowerTriangle {
  constructor(n, data) { this.n = n; this.data = data; }
  len() { return this.n; }
  isSquare() { return this.data.length === ((this.n * (this.n - 1)) / 2); }
  get(x, y) {
    // products x*(x-1) are always even, so /2 is an exact integer (valid up to 2^53);
    // the original >>1 truncates to int32 and overflows the index for n >= ~46342
    if (x < y) return this.data[((y * (y - 1)) / 2) + x];
    if (x > y) return this.data[((x * (x - 1)) / 2) + y];
    return 0;
  }
}

/** Normalize user input into a matrix object. Idempotent. Accepts a 2D array, DenseMatrix, or LowerTriangle. */
export function arrayAdapter(input) {
  if (input && typeof input.get === 'function' && typeof input.len === 'function') return input;
  if (Array.isArray(input)) return new DenseMatrix(input);
  throw new Error('Unsupported matrix input: provide a 2D array, a DenseMatrix, or a LowerTriangle');
}
