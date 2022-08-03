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
    //   "gmat": [
    //     [
    //       [ 31.31672176507748, 0.2183960452169238 ]
    //     ],
    //     [
    //       [ -22.27637140016484, -4.7649452046492735 ],
    //       [ -9.12778006150881, 12.303870466192656 ],
    //       [ 0.08742969659617117, -7.757321306760306 ]
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
    //       [ 31.31672176507748, 0.2183960452169238 ]
    //     ],
    //     [
    //       [ -22.27637140016484, -4.7649452046492735 ],
    //       [ -9.12778006150881, 12.303870466192656 ],
    //       [ 0.08742969659617117, -7.757321306760306 ]
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

//node --experimental-modules --es-module-specifier-resolution=node g-cluster.mjs
