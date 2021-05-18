
import WCluster from './src/WCluster.mjs'


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
    //   "gltdt": [
    //     [
    //       [ 80, 70, 90 ]
    //     ],
    //     [
    //       [ 40, 50, 60 ],
    //       [ 50, 70, 60 ],
    //       [ 50, 60, 80 ],
    //     ]
    //   ],
    //   "dmat": [
    //     [
    //       [77.39502404588043, 70.65388036857387, 91.60517102143689]
    //     ],
    //     [
    //       [ 36.76572825085965, 50.81184119955175, 61.992939427698765 ],
    //       [ 50.520478881706346, 69.86935352609807, 59.679283942385844],
    //       [ 55.318768821553576, 58.66492490577632, 76.7226056084785 ]
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
    //   "gltdt": [
    //     [
    //       {
    //         "name": "Paul", "a": 80, "b": 70, "c": 90
    //       }
    //     ],
    //     [
    //       {
    //         "name": "Cameron", "a": 40, "b": 50, "c": 60
    //       },
    //       {
    //         "name": "Buckley", "a": 50, "b": 70, "c": 60
    //       },
    //       {
    //         "name": "Fawcett", "a": 50, "b": 60, "c": 80
    //       }
    //     ]
    //   ],
    //   "dmat": [
    //     [
    //       [77.39502404588043, 70.65388036857387, 91.60517102143689]
    //     ],
    //     [
    //       [ 36.76572825085965, 50.81184119955175, 61.992939427698765 ],
    //       [ 50.520478881706346, 69.86935352609807, 59.679283942385844],
    //       [ 55.318768821553576, 58.66492490577632, 76.7226056084785 ]
    //     ]
    //   ]
    // }

}
testCluster()
    .catch((err) => {
        console.log(err)
    })

//node --experimental-modules --es-module-specifier-resolution=node g-cluster.mjs

