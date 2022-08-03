# w-cluster
A tool for data PCA(Principle Component Analysis) and cluster(K-Means & K-Medoids).

![language](https://img.shields.io/badge/language-JavaScript-orange.svg) 
[![npm version](http://img.shields.io/npm/v/w-cluster.svg?style=flat)](https://npmjs.org/package/w-cluster) 
[![license](https://img.shields.io/npm/l/w-cluster.svg?style=flat)](https://npmjs.org/package/w-cluster) 
[![gzip file size](http://img.badgesize.io/yuda-lyu/w-cluster/master/dist/w-cluster.umd.js.svg?compression=gzip)](https://github.com/yuda-lyu/w-cluster)
[![npm download](https://img.shields.io/npm/dt/w-cluster.svg)](https://npmjs.org/package/w-cluster) 
[![jsdelivr download](https://img.shields.io/jsdelivr/npm/hm/w-cluster.svg)](https://www.jsdelivr.com/package/npm/w-cluster)

## Documentation
To view documentation or get support, visit [docs](https://yuda-lyu.github.io/w-cluster/global.html).

## Example
To view some examples for more understanding, visit examples:

> **PCA:** [ex-PCA.html](https://yuda-lyu.github.io/w-cluster/examples/ex-PCA.html) [[source code](https://github.com/yuda-lyu/w-cluster/blob/master/docs/examples/ex-PCA.html)]

> **cluster for k-means:** [ex-cluster-k-means.html](https://yuda-lyu.github.io/w-cluster/examples/ex-cluster-k-means.html) [[source code](https://github.com/yuda-lyu/w-cluster/blob/master/docs/examples/ex-cluster-k-means.html)]

> **cluster for k-medoids:** [ex-cluster-k-medoids.html](https://yuda-lyu.github.io/w-cluster/examples/ex-cluster-k-medoids.html) [[source code](https://github.com/yuda-lyu/w-cluster/blob/master/docs/examples/ex-cluster-k-medoids.html)]

> **cluster for k-medoids with web worker:** [ex-cluster-webworker-k-medoids.html](https://yuda-lyu.github.io/w-cluster/examples/ex-cluster-webworker-k-medoids.html) [[source code](https://github.com/yuda-lyu/w-cluster/blob/master/docs/examples/ex-cluster-webworker-k-medoids.html)] * WebWorkers(from blob) does not support IE11.

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
    //     [ 36.76572825085965, 50.81184119955175, 61.992939427698765 ],
    //     [ 50.520478881706346, 69.86935352609807, 59.679283942385844 ],
    //     [ 77.39502404588043, 70.65388036857387, 91.60517102143689 ],
    //     [ 55.318768821553576, 58.66492490577632, 76.7226056084785 ]
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
    //     [ 2 ],
    //     [ 0, 1, 3 ]
    //   ],
    //   "gmat": [
    //     [
    //       [ 77.39502404588043, 70.65388036857387 ]
    //     ],
    //     [
    //       [ 36.76572825085965, 50.81184119955175 ],
    //       [ 50.520478881706346, 69.86935352609807 ],
    //       [ 55.318768821553576, 58.66492490577632 ]
    //     ]
    //   ],
    //   "gltdt": [
    //     [
    //       [ 80, 70, 90 ]
    //     ],
    //     [
    //       [ 40, 50, 60 ],
    //       [ 50, 70, 60 ],
    //       [ 50, 60, 80 ]
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
    //     [ 2 ],
    //     [ 0, 1, 3 ]
    //   ],
    //   "gmat": [
    //     [
    //       [ 77.39502404588043, 70.65388036857387 ]
    //     ],
    //     [
    //       [ 36.76572825085965, 50.81184119955175 ],
    //       [ 50.520478881706346, 69.86935352609807 ],
    //       [ 55.318768821553576, 58.66492490577632 ]
    //     ]
    //   ],
    //   "gltdt": [
    //     [
    //       { "name": "Paul", "a": 80, "b": 70, "c": 90 }
    //     ],
    //     [
    //       { "name": "Cameron", "a": 40, "b": 50, "c": 60 },
    //       { "name": "Buckley", "a": 50, "b": 70, "c": 60 },
    //       { "name": "Fawcett", "a": 50, "b": 60, "c": 80 }
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
<script src="https://cdn.jsdelivr.net/npm/w-cluster@1.0.10/dist/w-cluster.umd.js"></script>

<!-- for web workers -->
<script src="https://cdn.jsdelivr.net/npm/w-cluster@1.0.10/dist/w-cluster.wk.umd.js"></script>

```
