import WPCAMat from './WPCAMat.mjs'
import WClusterCore from './WClusterCore.mjs'


/**
 * 數據主成分分析(Principal Component Analysis, PCA)
 *
 * @param {Array} data 輸入數據陣列
 * @param {Object} [opt={}] 輸入設定物件，預設{}
 * @param {Boolean} [opt.scale=true] 輸入是否對數據正規化布林值，預設true
 * @param {Number} [opt.nCompNIPALS=2] 輸入指定降維的維度整數，不能超過數據的維度(各列有效元素數量)，預設2
 * @return {Promise} 回傳Promise，resolve回傳指定維數數值的陣列，reject回傳錯誤訊息
 * @example
 */
async function PCA(data, opt = {}) {
    return WPCAMat(data, opt)
}


/**
 * 針對數據陣列做分群
 *
 * @param {Array} data 輸入數據陣列，可輸入純數據陣列(mat)或物件陣列(ltdt)
 * @param {Object} [opt={}] 輸入設定物件，預設{}
 * @param {Number} [opt.kNumber=2] 輸入指定分群數整數，不能超過數據的長度，預設2
 * @param {Number} [opt.nCompNIPALS=2] 輸入指定降維的維度整數，不能超過數據的維度(各列有效元素數量)，預設2
 * @param {String} [opt.mode='k-medoids'] 輸入分群方法字串，可為'k-means'、'k-medoids'，k-means受初始隨機群中心影響較大，預設'k-medoids'
 * @param {Boolean} [opt.usePCA=true] 輸入分群前是否先對數據做PCA降維布林值，預設true；若使用自訂非歐距離(如Jaccard對二元向量)應設為false，以保留原始數據語意
 * @param {Function} [opt.funDist] 輸入自訂距離函數，函數接收兩數據陣列(t1,t2)並回傳兩者距離數值，僅於mode為'k-medoids'時生效，未提供時底層採用歐氏(euclidean)距離
 * @param {String} [opt.useMethod='fasterPAM'] 輸入k-medoids分群後端字串，僅於mode為'k-medoids'時生效，'simple'為npm套件'k-medoids'(樸素PAM)，'fasterPAM'為內建./src/k-medoids之矩陣式FasterPAM(大數據較快)，預設'fasterPAM'
 * @param {Number} [opt.seed] 輸入k-means隨機初始化種子整數，僅於mode為'k-means'時生效，給定則分群結果可重現，未提供時為隨機初始化
 * @return {Promise} 回傳Promise，resolve回傳分群後結果物件，keys代表分群有使用到的欄位，ginds代表分群後的指標陣列，gltdt代表分群後的物件陣列，gmat代表分群後的數據陣列(usePCA為true時為PCA降維後數據，可例如取最左2欄代表x,y繪製二維分佈圖；usePCA為false時為原始數據)，reject回傳錯誤訊息
 * @example
 */
async function cluster(data, opt = {}) {
    try {
        return await WClusterCore(data, opt)
    }
    catch (err) {
        return Promise.reject(err)
    }
}


/**
 * 數據主成份分析與分群
 *
 * @return {Object} 回傳物件，其內有PCA與cluster函式，PCA為主成份分析，cluster為分群分析
 * @example
 *
 * async function testPCA() {
 *
 *     let mat = [
 *         [40, 50, 60],
 *         [50, 70, 60],
 *         [80, 70, 90],
 *         [50, 60, 80]
 *     ]
 *     console.log('mat', mat)
 *     // => mat [ [ 40, 50, 60 ], [ 50, 70, 60 ], [ 80, 70, 90 ], [ 50, 60, 80 ] ]
 *
 *     let resMat = await WCluster.PCA(mat, { nCompNIPALS: 2 })
 *     console.log(resMat)
 *     // => [
 *     //   [ -1.704002697669786, 0.43087564048799354 ],
 *     //   [ -0.2509699164590232, -1.1519035967558147 ],
 *     //   [ 1.9913098008410954, 0.23244503334983269 ],
 *     //   [ -0.03633718671228592, 0.48858292291798827 ]
 *     // ]
 *
 *     let mat2 = [
 *         [1040, 50, 60],
 *         [1050, 70, 60],
 *         [1080, 70, 90],
 *         [1050, 60, 80]
 *     ]
 *     console.log('mat2', mat2)
 *     // => mat [ [ 1040, 50, 60 ], [ 1050, 70, 60 ], [ 1080, 70, 90 ], [ 1050, 60, 80 ] ]
 *
 *     let resMat2 = await WCluster.PCA(mat2, { nCompNIPALS: 2 })
 *     console.log(resMat2)
 *     // => [
 *     //   [ -1.704002697669786, 0.43087564048799354 ],
 *     //   [ -0.2509699164590232, -1.1519035967558147 ],
 *     //   [ 1.9913098008410954, 0.23244503334983269 ],
 *     //   [ -0.03633718671228592, 0.48858292291798827 ]
 *     // ]
 *
 *     let mat3 = [
 *         [11040, 50, 60],
 *         [13050, 70, 60],
 *         [15080, 70, 90],
 *         [17050, 60, 80]
 *     ]
 *     console.log('mat3', mat3)
 *     // => mat [ [ 11040, 50, 60 ], [ 13050, 70, 60 ], [ 15080, 70, 90 ], [ 17050, 60, 80 ] ]
 *
 *     let resMat3 = await WCluster.PCA(mat3, { nCompNIPALS: 2 })
 *     console.log(resMat3)
 *     // => [
 *     //   [ -1.8599655569892897, 0.4908764271508211 ],
 *     //   [ -0.3950941652793108, -1.0977355294143445 ],
 *     //   [ 1.3430199944041517, -0.17213692267477554 ],
 *     //   [ 0.912039727864449, 0.778996024938299 ]
 *     // ]
 *
 * }
 * testPCA()
 *     .catch((err) => {
 *         console.log(err)
 *     })
 *
 * async function testCluster() {
 *     let mode = 'k-medoids'
 *
 *     let mat = [
 *         [40, 50, 60],
 *         [50, 70, 60],
 *         [80, 70, 90],
 *         [50, 60, 80]
 *     ]
 *     console.log('mat', mat)
 *     // => mat [ [ 40, 50, 60 ], [ 50, 70, 60 ], [ 80, 70, 90 ], [ 50, 60, 80 ] ]
 *
 *     let resMat = await WCluster.cluster(mat, { mode, kNumber: 2, nCompNIPALS: 2 })
 *     console.log(JSON.stringify(resMat, null, 2))
 *     // => {
 *     //   "keys": null,
 *     //   "ginds": [
 *     //     [ 0, 1, 3 ],
 *     //     [ 2 ]
 *     //   ],
 *     //   "gmat": [
 *     //     [
 *     //       [ -1.704002697669786, 0.43087564048799354 ],
 *     //       [ -0.2509699164590232, -1.1519035967558147 ],
 *     //       [ -0.03633718671228592, 0.48858292291798827 ]
 *     //     ],
 *     //     [
 *     //       [ 1.9913098008410954, 0.23244503334983269 ]
 *     //     ]
 *     //   ],
 *     //   "gltdt": [
 *     //     [
 *     //       [ 40, 50, 60 ],
 *     //       [ 50, 70, 60 ],
 *     //       [ 50, 60, 80 ]
 *     //     ],
 *     //     [
 *     //       [ 80, 70, 90 ]
 *     //     ]
 *     //   ]
 *     // }
 *
 *     let mat2 = [
 *         [1040, 50, 60],
 *         [1050, 70, 60],
 *         [1080, 70, 90],
 *         [1050, 60, 80]
 *     ]
 *     console.log('mat2', mat2)
 *     // => mat [ [ 1040, 50, 60 ], [ 1050, 70, 60 ], [ 1080, 70, 90 ], [ 1050, 60, 80 ] ]
 *
 *     let resMat2 = await WCluster.cluster(mat2, { mode, kNumber: 2, nCompNIPALS: 2 })
 *     console.log(JSON.stringify(resMat2, null, 2))
 *     // => {
 *     //   "keys": null,
 *     //   "ginds": [
 *     //     [ 0, 1, 3 ],
 *     //     [ 2 ]
 *     //   ],
 *     //   "gmat": [
 *     //     [
 *     //       [ -1.704002697669786, 0.43087564048799354 ],
 *     //       [ -0.2509699164590232, -1.1519035967558147 ],
 *     //       [ -0.03633718671228592, 0.48858292291798827 ]
 *     //     ],
 *     //     [
 *     //       [ 1.9913098008410954, 0.23244503334983269 ]
 *     //     ]
 *     //   ],
 *     //   "gltdt": [
 *     //     [
 *     //       [ 1040, 50, 60 ],
 *     //       [ 1050, 70, 60 ],
 *     //       [ 1050, 60, 80 ]
 *     //     ],
 *     //     [
 *     //       [ 1080, 70, 90 ]
 *     //     ]
 *     //   ]
 *     // }
 *
 *     let mat3 = [
 *         [11040, 50, 60],
 *         [13050, 70, 60],
 *         [15080, 70, 90],
 *         [17050, 60, 80]
 *     ]
 *     console.log('mat3', mat3)
 *     // => mat [ [ 11040, 50, 60 ], [ 13050, 70, 60 ], [ 15080, 70, 90 ], [ 17050, 60, 80 ] ]
 *
 *     let resMat3 = await WCluster.cluster(mat3, { mode, kNumber: 2, nCompNIPALS: 2 })
 *     console.log(JSON.stringify(resMat3, null, 2))
 *     // => {
 *     //   "keys": null,
 *     //   "ginds": [
 *     //     [ 1, 2, 3 ],
 *     //     [ 0 ]
 *     //   ],
 *     //   "gmat": [
 *     //     [
 *     //       [ -0.3950941652793108, -1.0977355294143445 ],
 *     //       [ 1.3430199944041517, -0.17213692267477554 ],
 *     //       [ 0.912039727864449, 0.778996024938299 ]
 *     //     ],
 *     //     [
 *     //       [ -1.8599655569892897, 0.4908764271508211 ]
 *     //     ]
 *     //   ],
 *     //   "gltdt": [
 *     //     [
 *     //       [ 13050, 70, 60 ],
 *     //       [ 15080, 70, 90 ],
 *     //       [ 17050, 60, 80 ]
 *     //     ],
 *     //     [
 *     //       [ 11040, 50, 60 ]
 *     //     ]
 *     //   ]
 *     // }
 *
 *     let ltdt = [
 *         { name: 'Cameron', a: 40, b: 50, c: 60 },
 *         { name: 'Buckley', a: 50, b: 70, c: 60 },
 *         { name: 'Paul', a: 80, b: 70, c: 90 },
 *         { name: 'Fawcett', a: 50, b: 60, c: 80 },
 *     ]
 *     console.log('ltdt', ltdt)
 *     // => ltdt [
 *     //     { name: 'Cameron', a: 40, b: 50, c: 60 },
 *     //     { name: 'Buckley', a: 50, b: 70, c: 60 },
 *     //     { name: 'Paul', a: 80, b: 70, c: 90 },
 *     //     { name: 'Fawcett', a: 50, b: 60, c: 80 }
 *     // ]
 *
 *     let resLtdt = await WCluster.cluster(ltdt, { mode, kNumber: 2, nCompNIPALS: 2 })
 *     console.log(JSON.stringify(resLtdt, null, 2))
 *     // => {
 *     //   "keys": [ "a", "b", "c" ],
 *     //   "ginds": [
 *     //     [ 0, 1, 3 ],
 *     //     [ 2 ]
 *     //   ],
 *     //   "gmat": [
 *     //     [
 *     //       [ -1.704002697669786, 0.43087564048799354 ],
 *     //       [ -0.2509699164590232, -1.1519035967558147 ],
 *     //       [ -0.03633718671228592, 0.48858292291798827 ]
 *     //     ],
 *     //     [
 *     //       [ 1.9913098008410954, 0.23244503334983269 ]
 *     //     ]
 *     //   ],
 *     //   "gltdt": [
 *     //     [
 *     //       { "name": "Cameron", "a": 40, "b": 50, "c": 60 },
 *     //       { "name": "Buckley", "a": 50, "b": 70, "c": 60 },
 *     //       { "name": "Fawcett", "a": 50, "b": 60, "c": 80 }
 *     //     ],
 *     //     [
 *     //       { "name": "Paul", "a": 80, "b": 70, "c": 90 }
 *     //     ]
 *     //   ]
 *     // }
 *
 * }
 * testCluster()
 *     .catch((err) => {
 *         console.log(err)
 *     })
 *
 */
let WCluster = {
    PCA,
    cluster,
}


export default WCluster
