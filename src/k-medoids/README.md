# k-medoids — k-Medoids Clustering in JavaScript (ES Modules)

A faithful ES module port of [kno10/rust-kmedoids](https://github.com/kno10/rust-kmedoids) to JavaScript.

## Requirements

- Node.js >= 18
- ES modules (`import`/`export`); all files use the `.mjs` extension.

## Usage

```js
import { fasterpam, random_initialization, silhouette, LowerTriangle } from './index.mjs';

const diss = [[0,1,2,3],[1,0,4,5],[2,4,0,6],[3,5,6,0]];
const meds = random_initialization(4, 2);
const { loss, assi, nIter, nSwaps } = fasterpam(diss, meds, 100);
console.log('Loss:', loss);

const { sil } = silhouette(diss, assi, false);
```

The `meds` array is mutated in place by all clustering functions (the final medoid indices are written back).

## Input format

Pass a pairwise dissimilarity matrix as:

- A **2D array** `diss[i][j]` (full square matrix), or
- A **`LowerTriangle`** instance (serialized lower-triangular data, see `arrayadapter.mjs`).

All distance values are plain JS `number` (IEEE-754 double).

## Return values

Public clustering functions return plain objects:

| Function(s) | Return shape |
|---|---|
| `fasterpam`, `rand_fasterpam`, `fastpam1`, `pam_swap`, `fastmsc`, `fastermsc`, `pamsil_swap`, `pammedsil_swap`, `par_fasterpam` | `{ loss, assi, nIter, nSwaps }` |
| `alternating` | `{ loss, assi, nIter }` |
| `pam` | `{ loss, assi, meds, nIter, nSwaps }` |
| `pam_build` | `{ loss, assi, meds }` |
| `pamsil`, `pammedsil` | `{ loss, assi, meds, nIter, nSwaps }` |
| `dynmsc` | `{ loss, assi, nIter, nSwaps, meds, losses }` |
| `silhouette`, `medoid_silhouette` | `{ sil, samples }` (`samples` is `[]` when `samples=false`) |
| `par_silhouette` | a plain `number` |

## Implemented algorithms

- **FasterPAM** (Schubert and Rousseeuw, 2020, 2021) — `fasterpam`
- **FasterPAM with shuffling** — `rand_fasterpam`
- **Parallelized FasterPAM** (sequential equivalent in JS) — `par_fasterpam`
- **FastPAM1** (Schubert and Rousseeuw, 2019, 2021) — `fastpam1`
- **PAM** (Kaufman and Rousseeuw, 1987) with BUILD and SWAP — `pam`, `pam_build`, `pam_swap`
- **Alternating optimization** (k-means-style) — `alternating`
- **FasterMSC** (Lenssen and Schubert, 2022) — `fastermsc`
- **FastMSC** (Lenssen and Schubert, 2022) — `fastmsc`
- **DynMSC** (Lenssen and Schubert, 2023) — `dynmsc`
- **PAMSIL** (Van der Laan and Pollard, 2003) — `pamsil`, `pamsil_swap`
- **PAMMEDSIL** (Van der Laan and Pollard, 2003) — `pammedsil`, `pammedsil_swap`
- **Silhouette index** (Rousseeuw, 1987) — `silhouette`, `medoid_silhouette`, `par_silhouette`

Note: the k-means-like alternating algorithm tends to find much worse solutions than PAM-based methods.

The parallel variants (`par_fasterpam`, `par_silhouette`) are sequential equivalents in this JS port (JS is single-threaded). They produce identical results to the non-parallel variants.

## Random initialization

`random_initialization(n, k)` returns a length-`k` array of distinct random indices in `[0, n)`.
Because JS uses a different PRNG than the Rust crate, seeded results will differ numerically from the Rust version even on the same data.

## Notes on numerical fidelity

The port preserves left-to-right accumulation order of the Rust source so that IEEE-754 results match for deterministic inputs. Results may differ from the Rust crate only when random initialization differs (see above).

## License

GPL-3.0-or-later (same as upstream rust-kmedoids).

> This program is free software: you can redistribute it and/or modify
> it under the terms of the GNU General Public License as published by
> the Free Software Foundation, either version 3 of the License, or
> (at your option) any later version.
>
> This program is distributed in the hope that it will be useful,
> but WITHOUT ANY WARRANTY; without even the implied warranty of
> MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
> GNU General Public License for more details.
>
> You should have received a copy of the GNU General Public License
> along with this program. If not, see <https://www.gnu.org/licenses/>.

## References

> Erich Schubert and Lars Lenssen
> **Fast k-medoids Clustering in Rust and Python**
> Journal of Open Source Software 7(75), 4183
> <https://doi.org/10.21105/joss.04183>

> Erich Schubert, Peter J. Rousseeuw
> **Fast and Eager k-Medoids Clustering:
> O(k) Runtime Improvement of the PAM, CLARA, and CLARANS Algorithms**
> Information Systems (101), 2021, 101804
> <https://doi.org/10.1016/j.is.2021.101804>

> Erich Schubert, Peter J. Rousseeuw:
> **Faster k-Medoids Clustering: Improving the PAM, CLARA, and CLARANS Algorithms**
> In: 12th International Conference on Similarity Search and Applications (SISAP 2019), 171-187.
> <https://doi.org/10.1007/978-3-030-32047-8_16>
> Preprint: <https://arxiv.org/abs/1810.05691>

> Lars Lenssen, Erich Schubert:
> **Medoid silhouette clustering with automatic cluster number selection**
> Information Systems (120), 2024, 102290
> <https://doi.org/10.1016/j.is.2023.102290>
> Preprint: <https://arxiv.org/abs/2309.03751>

> Lars Lenssen, Erich Schubert:
> **Clustering by Direct Optimization of the Medoid Silhouette**
> In: 15th International Conference on Similarity Search and Applications (SISAP 2022)
> <https://doi.org/10.1007/978-3-031-17849-8_15>

If you use this code in scientific work, please cite the relevant papers above.
