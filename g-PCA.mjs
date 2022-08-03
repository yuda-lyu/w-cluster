import WCluster from './src/WCluster.mjs'


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
    //   [ -22.27637140016484, -4.7649452046492735 ],
    //   [ -9.12778006150881, 12.303870466192656 ],
    //   [ 31.31672176507748, 0.2183960452169238 ],
    //   [ 0.08742969659617117, -7.757321306760306 ]
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
    //   [ -22.27637140016484, -4.7649452046492735 ],
    //   [ -9.12778006150881, 12.303870466192656 ],
    //   [ 31.31672176507748, 0.2183960452169238 ],
    //   [ 0.08742969659617117, -7.757321306760306 ]
    // ]

}
testPCA()
    .catch((err) => {
        console.log(err)
    })

//node --experimental-modules --es-module-specifier-resolution=node g-PCA.mjs
