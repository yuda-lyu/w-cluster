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
 *
 * let mat = [
 *     [40, 50, 60],
 *     [50, 70, 60],
 *     [80, 70, 90],
 *     [50, 60, 80]
 * ]
 * let resMat = await WCluster.PCA(mat, { nCompNIPALS: 2 })
 * console.log(resMat)
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
 * @param {String} [opt.mode='k-medoids'] 輸入分群方法字串，可為'k-means'、'k-medoids'、'e-means'，k-means受初始隨機群中心影響較大，e-means為論文(Bessa et al., arXiv:2611.09501)之EMA小批次k-means(純JavaScript、僅用CPU、單執行緒，批次大小與步長依論文縮放律自動決定、無需調參，群數大且資料量大時以較少之走訪次數達到相近或較低之誤差，詳見README之評測)，預設'k-medoids'
 * @param {Boolean} [opt.usePCA=true] 輸入分群前是否先對數據做PCA降維布林值，預設true；若使用自訂非歐距離(如Jaccard對二元向量)應設為false，以保留原始數據語意
 * @param {Function} [opt.funDist] 輸入自訂距離函數，函數接收兩數據陣列(t1,t2)並回傳兩者距離數值，僅於mode為'k-medoids'時生效，未提供時底層採用歐氏(euclidean)距離
 * @param {String} [opt.useMethod='fasterPAM'] 輸入k-medoids分群後端字串，僅於mode為'k-medoids'時生效，'simple'為npm套件'k-medoids'(樸素PAM)，'fasterPAM'為內建./src/k-medoids之矩陣式FasterPAM(大數據較快)，預設'fasterPAM'
 * @param {Number} [opt.seed] 輸入隨機初始化種子整數，僅於mode為'k-means'或'e-means'時生效，給定則分群結果可重現，未提供時為隨機初始化；e-means給了非整數之值視為未提供
 * @param {Number} [opt.nEpochs=5] 輸入走訪次數(對全部數據之走訪次數，可為小數，如2.6)，僅於mode為'e-means'時生效，須為大於0且不超過1000之數值或數字字串，非預期之輸入視為未提供，預設5
 * @param {Number} [opt.batchSize] 輸入小批次大小正整數，僅於mode為'e-means'時生效，未提供(或非預期之輸入)時依論文縮放律決定
 * @param {Number} [opt.alpha0] 輸入初始EMA步長，須為大於0且不超過1之數值，僅於mode為'e-means'時生效，未提供(或非預期之輸入)時依論文縮放律決定
 * @param {String} [opt.batchLaw='auto'] 輸入批次大小之縮放律字串，可為'auto'、'throughput'、'quality'，僅於mode為'e-means'且未提供batchSize時生效，'auto'於維度不大於16時用'quality'(批次約小8倍、更新次數較多)，否則用'throughput'，預設'auto'
 * @param {Number} [opt.unusedThreshold] 輸入群復活門檻(質量低於平均質量之此比例之群視為未使用而以分裂其他群復活)，0為不復活，僅於mode為'e-means'時生效，未提供時維度不大於2為0、否則為0.1
 * @return {Promise} 回傳Promise，resolve回傳分群後結果物件，keys代表分群有使用到的欄位，ginds代表分群後的指標陣列，gltdt代表分群後的物件陣列，gmat代表分群後的數據陣列(usePCA為true時為PCA降維後數據，可例如取最左2欄代表x,y繪製二維分佈圖；usePCA為false時為原始數據)，reject回傳錯誤訊息；mode為'e-means'時，數據之元素須為有效數字(數字或數字字串，絕對值不大於1e100)，否則reject，訊息如invalid data[1][2]: must be a valid number(只帶位置不帶輸入值)，kNumber非1至數據長度之整數(數字或數字字串)時視為未提供，改用預設2，其他e-means選項非預期之輸入亦視為未提供；ginds依群編號排列且不含空群，nEpochs不小於1時各群之中心為該群成員之平均(論文演算法1收尾步驟)；usePCA為true時沿用既有之PCA前處理(其輸入檢測不屬e-means，例如數字字串須搭配usePCA為false)
 * @example
 *
 * let mat = [
 *     [40, 50, 60],
 *     [50, 70, 60],
 *     [80, 70, 90],
 *     [50, 60, 80]
 * ]
 * let res = await WCluster.cluster(mat, { mode: 'k-medoids', kNumber: 2, nCompNIPALS: 2 })
 * console.log(res.ginds)
 *
 * let resE = await WCluster.cluster(mat, { mode: 'e-means', kNumber: 2, nCompNIPALS: 2, seed: 0 })
 * console.log(resE.ginds)
 * // => [ [ 1, 2, 3 ], [ 0 ] ]
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
