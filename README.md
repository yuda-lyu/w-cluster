# w-cluster
A tool for data PCA(Principle Component Analysis) and cluster(K-Means, K-Medoids & e-means).

![language](https://img.shields.io/badge/language-JavaScript-orange.svg) 
[![npm version](http://img.shields.io/npm/v/w-cluster.svg?style=flat)](https://npmjs.org/package/w-cluster) 
[![license](https://img.shields.io/npm/l/w-cluster.svg?style=flat)](https://npmjs.org/package/w-cluster) 
[![npm download](https://img.shields.io/npm/dt/w-cluster.svg)](https://npmjs.org/package/w-cluster) 
[![npm download](https://img.shields.io/npm/dm/w-cluster.svg)](https://npmjs.org/package/w-cluster) 
[![jsdelivr download](https://img.shields.io/jsdelivr/npm/hm/w-cluster.svg)](https://www.jsdelivr.com/package/npm/w-cluster)

## Documentation
To view documentation or get support, visit [docs](https://yuda-lyu.github.io/w-cluster/global.html).

## Example
To view some examples for more understanding, visit examples:

> **PCA:** [ex-PCA.html](https://yuda-lyu.github.io/w-cluster/examples/ex-PCA.html) [[source code](https://github.com/yuda-lyu/w-cluster/blob/master/docs/examples/ex-PCA.html)]

> **cluster:** [ex-cluster.html](https://yuda-lyu.github.io/w-cluster/examples/ex-cluster.html) [[source code](https://github.com/yuda-lyu/w-cluster/blob/master/docs/examples/ex-cluster.html)]

> **cluster with web worker:** [ex-cluster-webworker.html](https://yuda-lyu.github.io/w-cluster/examples/ex-cluster-webworker.html) [[source code](https://github.com/yuda-lyu/w-cluster/blob/master/docs/examples/ex-cluster-webworker.html)] * WebWorkers(from blob) does not support IE11.

## Installation

### Using npm(ES6 module):
```alias
npm i w-cluster
```

#### Example for PCA(Principle Component Analysis):
> **Link:** [[dev source code](https://github.com/yuda-lyu/w-cluster/blob/master/g-PCA.mjs)]
```alias

async function testPCA() {

    let mat = [
        [40, 50, 60],
        [50, 70, 60],
        [80, 70, 90],
        [50, 60, 80]
    ]
    console.log('mat', mat)
    // => mat [ [ 40, 50, 60 ], [ 50, 70, 60 ], [ 80, 70, 90 ], [ 50, 60, 80 ] ]

    let resMat = await WCluster.PCA(mat, { nCompNIPALS: 2 })
    console.log(resMat)
    // => [
    //   [ -1.704002697669786, 0.43087564048799354 ],
    //   [ -0.2509699164590232, -1.1519035967558147 ],
    //   [ 1.9913098008410954, 0.23244503334983269 ],
    //   [ -0.03633718671228592, 0.48858292291798827 ]
    // ]

    let mat2 = [
        [1040, 50, 60],
        [1050, 70, 60],
        [1080, 70, 90],
        [1050, 60, 80]
    ]
    console.log('mat2', mat2)
    // => mat [ [ 1040, 50, 60 ], [ 1050, 70, 60 ], [ 1080, 70, 90 ], [ 1050, 60, 80 ] ]

    let resMat2 = await WCluster.PCA(mat2, { nCompNIPALS: 2 })
    console.log(resMat2)
    // => [
    //   [ -1.704002697669786, 0.43087564048799354 ],
    //   [ -0.2509699164590232, -1.1519035967558147 ],
    //   [ 1.9913098008410954, 0.23244503334983269 ],
    //   [ -0.03633718671228592, 0.48858292291798827 ]
    // ]

    let mat3 = [
        [11040, 50, 60],
        [13050, 70, 60],
        [15080, 70, 90],
        [17050, 60, 80]
    ]
    console.log('mat3', mat3)
    // => mat [ [ 11040, 50, 60 ], [ 13050, 70, 60 ], [ 15080, 70, 90 ], [ 17050, 60, 80 ] ]

    let resMat3 = await WCluster.PCA(mat3, { nCompNIPALS: 2 })
    console.log(resMat3)
    // => [
    //   [ -1.8599655569892897, 0.4908764271508211 ],
    //   [ -0.3950941652793108, -1.0977355294143445 ],
    //   [ 1.3430199944041517, -0.17213692267477554 ],
    //   [ 0.912039727864449, 0.778996024938299 ]
    // ]

}
testPCA()
    .catch((err) => {
        console.log(err)
    })

```

#### Example for cluster:
> **Link:** [[dev source code](https://github.com/yuda-lyu/w-cluster/blob/master/g-cluster.mjs)]
```alias

async function testCluster() {
    let mode = 'k-medoids'

    let mat = [
        [40, 50, 60],
        [50, 70, 60],
        [80, 70, 90],
        [50, 60, 80]
    ]
    console.log('mat', mat)
    // => mat [ [ 40, 50, 60 ], [ 50, 70, 60 ], [ 80, 70, 90 ], [ 50, 60, 80 ] ]

    let resMat = await WCluster.cluster(mat, { mode, kNumber: 2, nCompNIPALS: 2 })
    console.log(JSON.stringify(resMat, null, 2))
    // => {
    //   "keys": null,
    //   "ginds": [
    //     [ 0, 1, 3 ],
    //     [ 2 ]
    //   ],
    //   "gmat": [
    //     [
    //       [ -1.704002697669786, 0.43087564048799354 ],
    //       [ -0.2509699164590232, -1.1519035967558147 ],
    //       [ -0.03633718671228592, 0.48858292291798827 ]
    //     ],
    //     [
    //       [ 1.9913098008410954, 0.23244503334983269 ]
    //     ]
    //   ],
    //   "gltdt": [
    //     [
    //       [ 40, 50, 60 ],
    //       [ 50, 70, 60 ],
    //       [ 50, 60, 80 ]
    //     ],
    //     [
    //       [ 80, 70, 90 ]
    //     ]
    //   ]
    // }

    let mat2 = [
        [1040, 50, 60],
        [1050, 70, 60],
        [1080, 70, 90],
        [1050, 60, 80]
    ]
    console.log('mat2', mat2)
    // => mat [ [ 1040, 50, 60 ], [ 1050, 70, 60 ], [ 1080, 70, 90 ], [ 1050, 60, 80 ] ]

    let resMat2 = await WCluster.cluster(mat2, { mode, kNumber: 2, nCompNIPALS: 2 })
    console.log(JSON.stringify(resMat2, null, 2))
    // => {
    //   "keys": null,
    //   "ginds": [
    //     [ 0, 1, 3 ],
    //     [ 2 ]
    //   ],
    //   "gmat": [
    //     [
    //       [ -1.704002697669786, 0.43087564048799354 ],
    //       [ -0.2509699164590232, -1.1519035967558147 ],
    //       [ -0.03633718671228592, 0.48858292291798827 ]
    //     ],
    //     [
    //       [ 1.9913098008410954, 0.23244503334983269 ]
    //     ]
    //   ],
    //   "gltdt": [
    //     [
    //       [ 1040, 50, 60 ],
    //       [ 1050, 70, 60 ],
    //       [ 1050, 60, 80 ]
    //     ],
    //     [
    //       [ 1080, 70, 90 ]
    //     ]
    //   ]
    // }

    let mat3 = [
        [11040, 50, 60],
        [13050, 70, 60],
        [15080, 70, 90],
        [17050, 60, 80]
    ]
    console.log('mat3', mat3)
    // => mat [ [ 11040, 50, 60 ], [ 13050, 70, 60 ], [ 15080, 70, 90 ], [ 17050, 60, 80 ] ]

    let resMat3 = await WCluster.cluster(mat3, { mode, kNumber: 2, nCompNIPALS: 2 })
    console.log(JSON.stringify(resMat3, null, 2))
    // => {
    //   "keys": null,
    //   "ginds": [
    //     [ 1, 2, 3 ],
    //     [ 0 ]
    //   ],
    //   "gmat": [
    //     [
    //       [ -0.3950941652793108, -1.0977355294143445 ],
    //       [ 1.3430199944041517, -0.17213692267477554 ],
    //       [ 0.912039727864449, 0.778996024938299 ]
    //     ],
    //     [
    //       [ -1.8599655569892897, 0.4908764271508211 ]
    //     ]
    //   ],
    //   "gltdt": [
    //     [
    //       [ 13050, 70, 60 ],
    //       [ 15080, 70, 90 ],
    //       [ 17050, 60, 80 ]
    //     ],
    //     [
    //       [ 11040, 50, 60 ]
    //     ]
    //   ]
    // }

    let ltdt = [
        { name: 'Cameron', a: 40, b: 50, c: 60 },
        { name: 'Buckley', a: 50, b: 70, c: 60 },
        { name: 'Paul', a: 80, b: 70, c: 90 },
        { name: 'Fawcett', a: 50, b: 60, c: 80 },
    ]
    console.log('ltdt', ltdt)
    // => ltdt [
    //     { name: 'Cameron', a: 40, b: 50, c: 60 },
    //     { name: 'Buckley', a: 50, b: 70, c: 60 },
    //     { name: 'Paul', a: 80, b: 70, c: 90 },
    //     { name: 'Fawcett', a: 50, b: 60, c: 80 }
    // ]

    let resLtdt = await WCluster.cluster(ltdt, { mode, kNumber: 2, nCompNIPALS: 2 })
    console.log(JSON.stringify(resLtdt, null, 2))
    // => {
    //   "keys": [ "a", "b", "c" ],
    //   "ginds": [
    //     [ 0, 1, 3 ],
    //     [ 2 ]
    //   ],
    //   "gmat": [
    //     [
    //       [ -1.704002697669786, 0.43087564048799354 ],
    //       [ -0.2509699164590232, -1.1519035967558147 ],
    //       [ -0.03633718671228592, 0.48858292291798827 ]
    //     ],
    //     [
    //       [ 1.9913098008410954, 0.23244503334983269 ]
    //     ]
    //   ],
    //   "gltdt": [
    //     [
    //       { "name": "Cameron", "a": 40, "b": 50, "c": 60 },
    //       { "name": "Buckley", "a": 50, "b": 70, "c": 60 },
    //       { "name": "Fawcett", "a": 50, "b": 60, "c": 80 }
    //     ],
    //     [
    //       { "name": "Paul", "a": 80, "b": 70, "c": 90 }
    //     ]
    //   ]
    // }

}
testCluster()
    .catch((err) => {
        console.log(err)
    })

```

#### Example for cluster with e-means:
> **Link:** [[dev source code](https://github.com/yuda-lyu/w-cluster/blob/master/g-cluster-eMeans.mjs)]

`mode: 'e-means'` runs e-means (Bessa et al., *e-means: outperforming k-means (in one-tenth the epochs)*, [arXiv:2611.09501](https://arxiv.org/abs/2611.09501)), a mini-batch k-means with exponential-moving-average centroid updates, a cosine-annealed step, dead-cluster revival and a last-epoch-mean finalization. It is pure JavaScript, runs on the CPU in a single thread (no GPU, WebGPU, WebGL, WASM or native addon), and the batch size and the step are set by the paper's scaling laws, so the only option you usually need is `nEpochs`. The result has the same shape as the other modes.

```alias
let mat = [
    [40, 50, 60],
    [50, 70, 60],
    [80, 70, 90],
    [50, 60, 80]
]
let res = await WCluster.cluster(mat, { mode: 'e-means', kNumber: 2, nCompNIPALS: 2, seed: 0 })
console.log(res.ginds)
// => [ [ 1, 2, 3 ], [ 0 ] ]

//no PCA, 3 passes over the data
let res3 = await WCluster.cluster(mat, { mode: 'e-means', kNumber: 2, usePCA: false, seed: 0, nEpochs: 3 })
```

| option | default | meaning |
|---|---|---|
| `nEpochs` | 5 | passes over the data (may be fractional, e.g. 2.6; 0 < nEpochs <= 1000) |
| `seed` | random | integer seed, the result is reproducible when given |
| `batchSize`, `alpha0` | scaling laws | batch size and initial EMA step; leave unset to use the paper's laws |
| `batchLaw` | `'auto'` | `'auto'`, `'throughput'` or `'quality'`; `'auto'` uses `'quality'` (batches about 8 times smaller) when the dimension is at most 16 |
| `unusedThreshold` | 0.1 (0 when d <= 2) | revival threshold; 0 turns revival off |
| `init` | `'random'` | initial centroids: `'random'` (the paper's way, k rows drawn without replacement) or `'k-means++'` (greedy k-means++, see "Initialisation" below); any other value is treated as not given |

Notes: the elements of `data` must be valid numbers (numbers or numeric strings) with an absolute value of at most 1e100, otherwise the promise is rejected with a message such as `invalid data[1][2]: must be a valid number` (the position only, never the value); an option with an unexpected value is treated as not given and the default is used (for example a `kNumber` that is not an integer from 1 to the number of rows becomes 2). The data are centered column by column before clustering (distances are unchanged), so a large common offset does not cost precision. The default PCA pre-processing (`usePCA: true`) is the existing one and does its own input checks (for example it does not accept numeric strings); pass `usePCA: false` to cluster the raw values.

##### Initialisation: `init: 'random'` (default) or `init: 'k-means++'`

The paper starts from k rows drawn at random, and that stays the default. `init: 'k-means++'` starts from greedy k-means++ instead (the same function and the same seed as the Lloyd k-means baseline in the evaluation: each new centroid is the best of 2 + floor(ln k) candidates drawn with probability proportional to the squared distance); every other step (batch size, step law, EMA, revival, finalization) is unchanged, and the distance computations of the initialisation are counted in the cost below. A given `initRows`/`initCentroids` (internal options of `emeans`) take precedence over `init`.

```alias
let rows = []
for (let i = 0; i < 300; i++) {
    let g = i % 3
    rows.push([g * 10 + (i % 7) * 0.1, g * -5 + (i % 11) * 0.05, (i % 13) * 0.02 + g])
}
let resR = await WCluster.cluster(rows, { mode: 'e-means', kNumber: 3, seed: 1 })
console.log(resR.ginds.map((g) => g.length))
// => [ 200, 48, 52 ]    (one cluster got two centroids and two clusters share one)
let resK = await WCluster.cluster(rows, { mode: 'e-means', kNumber: 3, seed: 1, init: 'k-means++' })
console.log(resK.ginds.map((g) => g.length))
// => [ 100, 100, 100 ]
```

Measured on the same synthetic data as the evaluation below (single-threaded, T = 5 passes which is the default, 5-24 seeds; scripts `evalInit.mjs`, `evalInitSmall.mjs`, tables in `REPORT.md`; the evaluation was run before the option was added and the shipped option is checked against it by the unit tests):

* **When it helps**: data made of well separated groups, where random initialisation often puts two centroids into one group and leaves two groups with one (more passes do not repair it; revival only repairs dead clusters). Test error of e-means, random to k-means++: separated mixture (50,000 rows, d = 64, k = 256) 24.28 to 22.30 (-8.1%), Zipf-sized mixture 24.32 to 22.97 (-5.6%), separated mixture with 5,000 rows (d = 32, k = 64) 12.03 to 11.29 (-6.1%) and with 20,000 rows 11.83 to 11.23 (-5.0%); k-means++ was better in every seed of these four. On small data the share of runs that end in a local solution fell from 31% to 0% (300 rows, 3 well separated groups), from 40% to 0% (500 rows, 4 groups), from 56% to 6% (1,000 rows, 6 groups) and from 97% to 34% (2,000 rows, 10 overlapping groups; k-means in this package: 33%).
* **When it does not matter**: unstructured or strongly overlapping data (uniform cube, stretched Gaussian, overlapping mixture: -0.03% to +0.09%, inside the seed noise; the two-dimensional uniform square was 0.8% better), a separated mixture with a very large n/k (100,000 rows, k = 64: -0.1%) and a small k (k = 8: -1.4%, inside the seed noise); and with fewer passes than the default on small data (T = 2.6 on the 500-row set: 16% of the runs were still wrong).
* **What it costs**: the initialisation needs about 3.6 to 7 passes worth of distance computations (it grows with ln k) and is not as well optimised as the nearest-centroid core, so e-means with `init: 'k-means++'` took 2.5 to 4 times the CPU time of the default and 0.65 to 0.85 times that of Lloyd with 25 passes (0.34 to 0.48 times the distance computations), i.e. the speed-up over Lloyd 25 passes drops from the 4-20 times of the default to about 1.2-1.5 times. Against Lloyd + k-means++ (25 passes) it takes about half the CPU time (0.45 to 0.53) with an equal or lower test error in 10 of the 11 datasets (0.6% higher in the other).
* **So**: keep the default when speed is the point or the data have no group structure; use `init: 'k-means++'` for clustered data when the extra initialisation time is acceptable and a split or merged group would hurt (small and medium data, or k of tens or more on well separated groups).

##### How much faster is e-means than k-means? (evaluation summary)

Measured with single-threaded JavaScript on the CPU only, e-means and a Lloyd k-means baseline share the same nearest-centroid code, the same data and the same random initial centroids, so only the algorithm differs. The scripts, raw results and full tables are in [toolg/evalEmeans](https://github.com/yuda-lyu/w-cluster/tree/master/toolg/evalEmeans) (`REPORT.md`). Errors are mean squared distances on a held-out test set (11 synthetic datasets, 5-8 seeds each).

* **Epochs and distance computations (hardware independent)**: e-means reaches the test error of Lloyd at 25 epochs after about 1-3 epochs (median over seeds, paper: 1.4-2.6), i.e. 8-25 times fewer point-to-centroid distance computations.
* **CPU time with the same code**: an e-means epoch costs 1.03-1.2 times a Lloyd epoch when the per-epoch work is large (n*k*d of about 4e7 or more; up to 1.3-2.4 times for smaller ones such as d = 2, k = 8 or n = 5,000, where the per-batch bookkeeping is no longer negligible), so the CPU time to reach the same error is about 4-20 times shorter. The speed-up comes from the algorithm, not from the hardware.
* **Quality at 25 epochs**: e-means has a lower test error than Lloyd at 25 epochs in 10 of the 11 datasets (-0.1% to -6.8%) and a 0.13% higher one in the remaining one (small k); the gain is under 1% on unstructured data and 2-7% on well separated mixtures, where dead-cluster revival does most of the work.
* **Where it does not hold**: against Lloyd initialised with greedy k-means++, e-means with random initialisation has a higher final error on well separated mixtures (-8% to -14% for k-means++ against -3% to -7% for e-means, relative to Lloyd with random initialisation); k-means++ needs about 2 + ln k epochs worth of distance computations just for the initialisation (`init: 'k-means++'`, described above, starts e-means from it and then matches that error at the cost listed there). The gain is small for small k, small n and low-dimensional data; the datasets here (5,000-100,000 rows, k from 8 to 256) are far smaller than the paper's (1 million to 10 billion rows), and the GPU speed-ups reported in the paper combine the algorithm's roughly ten-fold reduction in epochs with GPU kernels, of which only the first part is measured here.

| dataset (n, d, k) | epochs to match Lloyd@25 | distance computations saved | wall-clock saved | e-means T=2.6 | e-means T=25 | Lloyd + k-means++ @25 |
|---|---|---|---|---|---|---|
| separated mixture (50,000, 64, 256) | <= 1 | >= 25x | >= 20x | -6.0% | -6.8% | -13.9% |
| overlapping mixture (50,000, 32, 128) | 2.6 | 9.6x | 9.8x | -0.1% | -0.5% | +0.1% |
| Zipf-sized mixture (50,000, 64, 256) | 1.4 | 17.9x | 17.7x | -1.5% | -2.0% | -8.2% |
| uniform cube (50,000, 16, 128) | 1.7 | 14.7x | 12.5x | -0.2% | -0.3% | -0.1% |
| stretched Gaussian (30,000, 128, 128) | 3 | 8.3x | 9.0x | 0.0% | -0.1% | +0.0% |
| uniform square (100,000, 2, 100) | 2 | 12.5x | 10.5x | -1.5% | -2.8% | -2.3% |
| separated mixture, small k (20,000, 16, 8) | 2 | 12.5x | 4.7x | -2.5% | +0.1% | -4.0% |

Test errors are relative to Lloyd (random initialisation, same initial centroids) at 25 epochs, negative is better. Re-run with `node --expose-gc toolg/evalEmeans/evalRun.mjs <config>` and `node toolg/evalEmeans/evalReport.mjs` (the initialisation comparison: `node --expose-gc toolg/evalEmeans/evalInit.mjs <config>` and `node toolg/evalEmeans/evalInitSmall.mjs`).

##### Third-party notice

`src/WEmeans.mjs` is a JavaScript port of the e-means implementation in Faiss (`contrib/e_means`), which is distributed under the MIT license:

```
Copyright (c) Meta Platforms, Inc. and affiliates.

This source code is licensed under the MIT license found in the
LICENSE file in the root directory of this source tree.

MIT License

Copyright (c) Facebook, Inc. and its affiliates.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### In a browser(UMD module):

Add script for w-cluster.
```alias

<!-- for basic -->
<script src="https://yuda-lyu.github.io/w-cluster/dist/w-cluster.umd.js"></script>

<!-- for web workers -->
<script src="https://yuda-lyu.github.io/w-cluster/dist/w-cluster.wk.umd.js"></script>

```
