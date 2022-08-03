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
 * @return {Promise} 回傳Promise，resolve回傳分群後結果物件，keys代表分群有使用到的欄位，ginds代表分群後的指標陣列，gltdt代表分群後的物件陣列，gmat代表分群後且經過PCA處理的數據陣列，其內因是降維後的數據，可例如取最左2欄的數據代表x,y來繪製分群後二維分佈圖，reject回傳錯誤訊息
 * @example
 */
async function cluster(data, opt = {}) {
    try {
        return WClusterCore(data, opt)
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
 *     //     [ 36.76572825085965, 50.81184119955175, 61.992939427698765 ],
 *     //     [ 50.520478881706346, 69.86935352609807, 59.679283942385844 ],
 *     //     [ 77.39502404588043, 70.65388036857387, 91.60517102143689 ],
 *     //     [ 55.318768821553576, 58.66492490577632, 76.7226056084785 ]
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
 *     //     [ 2 ],
 *     //     [ 0, 1, 3 ]
 *     //   ],
 *     //   "gmat": [
 *     //     [
 *     //       [ 77.39502404588043, 70.65388036857387 ]
 *     //     ],
 *     //     [
 *     //       [ 36.76572825085965, 50.81184119955175 ],
 *     //       [ 50.520478881706346, 69.86935352609807 ],
 *     //       [ 55.318768821553576, 58.66492490577632 ]
 *     //     ]
 *     //   ],
 *     //   "gltdt": [
 *     //     [
 *     //       [ 80, 70, 90 ]
 *     //     ],
 *     //     [
 *     //       [ 40, 50, 60 ],
 *     //       [ 50, 70, 60 ],
 *     //       [ 50, 60, 80 ]
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
 *     //     [ 2 ],
 *     //     [ 0, 1, 3 ]
 *     //   ],
 *     //   "gmat": [
 *     //     [
 *     //       [ 77.39502404588043, 70.65388036857387 ]
 *     //     ],
 *     //     [
 *     //       [ 36.76572825085965, 50.81184119955175 ],
 *     //       [ 50.520478881706346, 69.86935352609807 ],
 *     //       [ 55.318768821553576, 58.66492490577632 ]
 *     //     ]
 *     //   ],
 *     //   "gltdt": [
 *     //     [
 *     //       { "name": "Paul", "a": 80, "b": 70, "c": 90 }
 *     //     ],
 *     //     [
 *     //       { "name": "Cameron", "a": 40, "b": 50, "c": 60 },
 *     //       { "name": "Buckley", "a": 50, "b": 70, "c": 60 },
 *     //       { "name": "Fawcett", "a": 50, "b": 60, "c": 80 }
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
