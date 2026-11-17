import WCluster from './src/WCluster.mjs'


//e-means為EMA小批次k-means(純JavaScript、僅用CPU), 預設隨機初始化(init可選'k-means++'), 給定seed使結果可重現
//批次大小與步長由論文縮放律自動決定, 只需指定走訪次數nEpochs(預設5)


async function testCluster() {
    let mode = 'e-means'
    let seed = 0

    let mat = [
        [40, 50, 60],
        [50, 70, 60],
        [80, 70, 90],
        [50, 60, 80]
    ]
    console.log('mat', mat)

    let resMat = await WCluster.cluster(mat, { mode, kNumber: 2, nCompNIPALS: 2, seed })
    console.log(JSON.stringify(resMat, null, 2))
    // => {
    //   "keys": null,
    //   "ginds": [
    //     [ 1, 2, 3 ],
    //     [ 0 ]
    //   ],
    //   "gmat": [
    //     [
    //       [ -0.2509699164590232, -1.1519035967558147 ],
    //       [ 1.9913098008410954, 0.23244503334983269 ],
    //       [ -0.03633718671228592, 0.48858292291798827 ]
    //     ],
    //     [
    //       [ -1.704002697669786, 0.43087564048799354 ]
    //     ]
    //   ],
    //   "gltdt": [
    //     [
    //       [ 50, 70, 60 ],
    //       [ 80, 70, 90 ],
    //       [ 50, 60, 80 ]
    //     ],
    //     [
    //       [ 40, 50, 60 ]
    //     ]
    //   ]
    // }

    //較大之合成數據: 3個群各200點(各維之值皆由確定性之算式產生而相異), 不降維(usePCA為false), 走訪3次
    let big = []
    for (let i = 0; i < 600; i++) {
        let g = i % 3
        let row = []
        for (let t = 0; t < 4; t++) {
            row.push(g * 10 + ((i * 7919 + t * 104729) % 1000) / 1000)
        }
        big.push(row)
    }
    let resBig = await WCluster.cluster(big, { mode, kNumber: 3, usePCA: false, seed, nEpochs: 3 })
    console.log(resBig.ginds.map((inds) => inds.length))
    // => [ 200, 200, 200 ]

    //初始中心: 預設為隨機初始化(論文作法), 群分離明顯之資料可能落入局部解(此例seed為1時一群含兩個中心, 另兩群共用一個中心);
    //init為'k-means++'時改用貪婪k-means++(代價為初始化需約2+ln k個走訪之距離計算, 見README)
    let rows = []
    for (let i = 0; i < 300; i++) {
        let g = i % 3
        rows.push([g * 10 + (i % 7) * 0.1, g * -5 + (i % 11) * 0.05, (i % 13) * 0.02 + g])
    }
    let resR = await WCluster.cluster(rows, { mode, kNumber: 3, seed: 1 })
    console.log(resR.ginds.map((inds) => inds.length))
    // => [ 200, 48, 52 ]
    let resK = await WCluster.cluster(rows, { mode, kNumber: 3, seed: 1, init: 'k-means++' })
    console.log(resK.ginds.map((inds) => inds.length))
    // => [ 100, 100, 100 ]

}
testCluster()
    .catch((err) => {
        console.log(err)
    })

//node g-cluster-eMeans.mjs
