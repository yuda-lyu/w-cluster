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

//node --experimental-modules --es-module-specifier-resolution=node g-PCA-nodeworker.mjs
