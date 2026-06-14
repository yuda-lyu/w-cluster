import get from 'lodash-es/get.js'
import each from 'lodash-es/each.js'
import map from 'lodash-es/map.js'
import values from 'lodash-es/values.js'
import isnum from 'wsemi/src/isnum.mjs'
import isfun from 'wsemi/src/isfun.mjs'
import cint from 'wsemi/src/cint.mjs'
import kmeds from 'k-medoids'
import { kmeans } from 'ml-kmeans'
import { fasterpam, first_k } from './k-medoids/index.mjs'


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


// @param {Array} data 輸入數據陣列
// @param {Object} [opt={}] 輸入設定物件，預設{}
// @param {Number} [opt.kNumber=2] 輸入指定分群數整數，不能超過數據的長度，預設2
// @param {String} [opt.mode='k-medoids'] 輸入分群方法字串，可為'k-means'、'k-medoids'，k-means受初始隨機群中心影響較大，預設'k-medoids'
// @param {Function} [opt.funDist] 輸入自訂距離函數，函數接收兩數據陣列(t1,t2)並回傳兩者距離數值，僅於mode為'k-medoids'時生效，未提供時底層採用歐氏(euclidean)距離
// @param {String} [opt.useMethod='fasterPAM'] 輸入k-medoids分群後端字串，僅於mode為'k-medoids'時生效，'simple'為npm套件'k-medoids'(樸素PAM)，'fasterPAM'為內建./src/k-medoids之矩陣式FasterPAM(大數據較快)，預設'fasterPAM'
// @param {Number} [opt.seed] 輸入k-means隨機初始化種子整數，僅於mode為'k-means'時生效，給定則分群結果可重現，未提供時為隨機初始化
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
    if (mode !== 'k-medoids' && mode !== 'k-means') {
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
    else {
        throw new Error(`invalid mode[${mode}]`)
    }

    return rs
}


export default WClusterMat
