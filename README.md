# w-cluster
A tool for data PCA(Principle Component Analysis) and cluster(K-Means & K-Medoids).

![language](https://img.shields.io/badge/language-JavaScript-orange.svg) 
[![npm version](http://img.shields.io/npm/v/w-cluster.svg?style=flat)](https://npmjs.org/package/w-cluster) 
[![license](https://img.shields.io/npm/l/w-cluster.svg?style=flat)](https://npmjs.org/package/w-cluster) 
[![gzip file size](http://img.badgesize.io/yuda-lyu/w-cluster/master/dist/w-cluster.umd.js.svg?compression=gzip)](https://github.com/yuda-lyu/w-cluster)
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
> **Note:** w-cluster is mainly dependent on `ml-pca`, `ml-kmeans` and `k-medoids`.
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

### In a browser(UMD module):
> **Note:** w-cluster does not dependent on any package.

[Necessary] Add script for w-cluster.
```alias

<!-- for basic -->
<script src="https://cdn.jsdelivr.net/npm/w-cluster@1.0.20/dist/w-cluster.umd.js"></script>

<!-- for web workers -->
<script src="https://cdn.jsdelivr.net/npm/w-cluster@1.0.20/dist/w-cluster.wk.umd.js"></script>

```
