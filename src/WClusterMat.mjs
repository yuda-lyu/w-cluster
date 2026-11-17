import get from 'lodash-es/get.js'
import each from 'lodash-es/each.js'
import map from 'lodash-es/map.js'
import values from 'lodash-es/values.js'
import isnum from 'wsemi/src/isnum.mjs'
import isfun from 'wsemi/src/isfun.mjs'
import cint from 'wsemi/src/cint.mjs'
import iseint from 'wsemi/src/iseint.mjs'
import kmeds from 'k-medoids'
import { kmeans } from 'ml-kmeans'
import { fasterpam, first_k } from './k-medoids/index.mjs'
import { emeans } from './WEmeans.mjs'
import { newStats, centroidNorms, assignNearest } from './WClusterNearest.mjs'
import { flattenMat, centerColumns } from './WClusterUtil.mjs'


function euclidean(a, b) {
    //歐氏距離
    let s = 0
    for (let i = 0; i < a.length; i++) {
        let d = a[i] - b[i]
        s += d * d
    }
    return Math.sqrt(s)
}


function kMedoidsFasterPAM(data, kNumber, funDist) {
    //fasterPAM後端, 先以funDist(或預設歐氏)建一次 n×n 距離矩陣(每對只算一次), 再跑fasterpam, 把結果轉回各群原始index

    let n = data.length
    let dist = isfun(funDist) ? funDist : euclidean

    //建 n×n 對稱距離矩陣
    let D = Array.from({ length: n }, () => new Float64Array(n))
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            let d = dist(data[i], data[j])
            D[i][j] = d
            D[j][i] = d
        }
    }

    //fasterpam: med為初始medoid(取前kNumber個, 就地更新), 回傳assi=各點所屬medoid slot
    let med = first_k(kNumber)
    let r = fasterpam(D, med, 100)

    //依slot把點分群 → 各群原始index
    let gs = {}
    each(r.assi, (slot, i) => {
        if (!gs[slot]) {
            gs[slot] = []
        }
        gs[slot].push(i)
    })

    return values(gs)
}


function kMedoidsSimple(data, kNumber, funDist) {

    //kp, 以「元素參照」對應原始index
    //  getClusteredData回傳原元素參照, 故可用參照反查; 同時天然避免「值相同列」碰撞
    let kp = new Map()
    each(data, (v, k) => {
        kp.set(v, k)
    })

    //getInstance
    let intance = kmeds.Clusterer.getInstance(data, kNumber, funDist)

    //cluster
    let rs = intance.getClusteredData()
    rs = map(rs, (gs) => {
        return map(gs, (v) => {
            let ind = kp.get(v)
            return ind
        })
    })

    return rs
}


async function kMedoids(data, kNumber, opt = {}) {

    //funDist
    let funDist = get(opt, 'funDist', null)

    //useMethod, 選擇k-medoids後端: 'simple'=npm套件'k-medoids'(樸素PAM); 其他(預設'fasterPAM')=./src/k-medoids矩陣式FasterPAM
    let useMethod = get(opt, 'useMethod', 'fasterPAM')
    if (useMethod === 'simple') {
        return kMedoidsSimple(data, kNumber, funDist)
    }
    else {
        return kMedoidsFasterPAM(data, kNumber, funDist)
    }

}


async function kMeans(data, kNumber, opt = {}) {

    //seed
    let seed = get(opt, 'seed', null)

    //kmeans
    let optKMeans = {}
    if (seed !== null) {
        optKMeans = { seed }
    }
    let r = kmeans(data, kNumber, optKMeans)
    //k:        [ 0, 1, 2, 3 ]
    //clusters: [ 0, 0, 1, 0 ]

    //gs
    let gs = {}
    each(r.clusters, (v, k) => {
        if (!gs[v]) {
            gs[v] = []
        }
        gs[v].push(k)
    })

    //values
    let rs = values(gs)

    return rs
}


async function kEmeans(data, kNumber, opt = {}) {
    //e-means後端: 純JavaScript、僅用CPU、單執行緒之EMA小批次k-means(src/WEmeans.mjs), 回傳形狀同kMeans

    //資料檢測與攤平(元素須為有效數字, 否則拋錯; 訊息不帶輸入值)
    let { X, n, d } = flattenMat(data)

    //置中: 距離以 |c|^2 - 2x·c 比較, 偏移量遠大於分散度時會抵銷有效位數(平移不改變點間距離, 故不影響分群定義)
    centerColumns(X, n, d)

    //kNumber須為1至n之整數(數字或數字字串, 轉換後之值才使用), 非預期之輸入視為未給, 改用預設2(僅1列時為1);
    //優先取WClusterCore轉傳之原始輸入kNumberRaw(Core對所有mode先做isnum/cint轉換, 會把3.7、'0x3'當成可用之數字)
    let kRaw = get(opt, 'kNumberRaw', undefined)
    if (kRaw === undefined) {
        kRaw = kNumber
    }
    let k = (kRaw !== null && kRaw !== undefined && iseint(kRaw, { min: 1, max: n })) ? Number(kRaw) : Math.min(2, n)

    //seed須為整數, 非預期之輸入視為未給(隨機初始化)
    let seed = get(opt, 'seed', null)
    seed = (seed !== null && seed !== undefined && iseint(seed)) ? Number(seed) : null

    let optE = { seed }
    each(['nEpochs', 'batchSize', 'alpha0', 'batchLaw', 'unusedThreshold', 'init'], (key) => {
        optE[key] = get(opt, key, null)
    })
    let stats = newStats()
    optE.stats = stats
    let r = emeans(X, n, d, k, optE)

    //全部列皆須有所屬群: nEpochs<1時僅部分列被走訪, 其餘列依最終中心做最近中心指派
    let labels = r.labels
    let miss = []
    for (let i = 0; i < n; i++) {
        if (labels[i] < 0) {
            miss.push(i)
        }
    }
    if (miss.length > 0) {
        let rows = Int32Array.from(miss)
        let cn = centroidNorms(r.centroids, k, d, new Float64Array(k))
        let lab = new Int32Array(rows.length)
        assignNearest(X, d, rows, rows.length, r.centroids, k, cn, lab, null, stats)
        for (let i = 0; i < rows.length; i++) {
            labels[rows[i]] = lab[i]
        }
    }

    //gs, 各群之原始index由小到大, 群依群編號由小到大排列, 空群不輸出(與kMeans一致)
    let gs = {}
    for (let i = 0; i < n; i++) {
        let l = labels[i]
        if (!gs[l]) {
            gs[l] = []
        }
        gs[l].push(i)
    }
    return values(gs)
}


// @param {Array} data 輸入數據陣列
// @param {Object} [opt={}] 輸入設定物件，預設{}
// @param {Number} [opt.kNumber=2] 輸入指定分群數整數，不能超過數據的長度，預設2
// @param {String} [opt.mode='k-medoids'] 輸入分群方法字串，可為'k-means'、'k-medoids'、'e-means'，k-means受初始隨機群中心影響較大，預設'k-medoids'
// @param {Number} [opt.nEpochs=5] 輸入e-means之走訪次數(可為小數)，僅於mode為'e-means'時生效，預設5
// @param {Number} [opt.batchSize] 輸入e-means之批次大小，僅於mode為'e-means'時生效，未給時依論文縮放律決定
// @param {Number} [opt.alpha0] 輸入e-means之初始EMA步長，僅於mode為'e-means'時生效，未給時依論文縮放律決定
// @param {String} [opt.batchLaw='auto'] 輸入e-means之批次律字串，可為'auto'、'throughput'、'quality'，僅於mode為'e-means'時生效，預設'auto'
// @param {Number} [opt.unusedThreshold] 輸入e-means之群復活門檻，0為不復活，僅於mode為'e-means'時生效，未給時維度不大於2為0、否則為0.1
// @param {Function} [opt.funDist] 輸入自訂距離函數，函數接收兩數據陣列(t1,t2)並回傳兩者距離數值，僅於mode為'k-medoids'時生效，未提供時底層採用歐氏(euclidean)距離
// @param {String} [opt.useMethod='fasterPAM'] 輸入k-medoids分群後端字串，僅於mode為'k-medoids'時生效，'simple'為npm套件'k-medoids'(樸素PAM)，'fasterPAM'為內建./src/k-medoids之矩陣式FasterPAM(大數據較快)，預設'fasterPAM'
// @param {String} [opt.init='random'] 輸入e-means之初始化方式字串，可為'random'(論文作法，不放回隨機取k列)或'k-means++'(貪婪k-means++，群大時多花約2+ln k個走訪之距離計算，分離型混合資料較不易落入局部解)，其餘值視為未給，僅於mode為'e-means'時生效，預設'random'
// @param {Number} [opt.seed] 輸入k-means隨機初始化種子整數，僅於mode為'k-means'或'e-means'時生效，給定則分群結果可重現，未提供時為隨機初始化
// @return {Array} 回傳分群後各群所屬items的指標陣列
async function WClusterMat(data, opt = {}) {

    //kNumber
    let kNumber = get(opt, 'kNumber')
    if (!isnum(kNumber)) {
        kNumber = 2
    }
    else {
        kNumber = cint(kNumber)
    }

    //mode
    let mode = get(opt, 'mode')
    if (mode !== 'k-medoids' && mode !== 'k-means' && mode !== 'e-means') {
        mode = 'k-medoids'
    }

    //seed
    let seed = get(opt, 'seed', null)

    //funDist
    let funDist = get(opt, 'funDist', null)

    //useMethod
    let useMethod = get(opt, 'useMethod', 'fasterPAM')

    let rs
    if (mode === 'k-medoids') {
        rs = await kMedoids(data, kNumber, { funDist, useMethod })
    }
    else if (mode === 'k-means') {
        rs = await kMeans(data, kNumber, { seed })
    }
    else if (mode === 'e-means') {
        rs = await kEmeans(data, kNumber, opt)
    }
    else {
        throw new Error(`invalid mode[${mode}]`)
    }

    return rs
}


export default WClusterMat
