// import WCluster from './src/WCluster.mjs'
import WCluster from './dist/w-cluster.wk.umd.js'


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

//node --experimental-modules --es-module-specifier-resolution=node g-PCA-nodeworker.mjs

