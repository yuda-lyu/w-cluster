/**
 * Lloyd k-means(對照組A, 純JavaScript、僅用CPU、單執行緒)
 *
 * 與e-means(src/WEmeans.mjs)共用同一個最近中心計算核心(src/WClusterNearest.mjs)、同一個初始中心選取(WClusterUtil.initRows)與同一個空群復活函數(WClusterUtil.splitClusters),
 * 故兩者之差異只在演算法本身: Lloyd每次走訪對全部點指派後以平均值更新中心, e-means以小批次EMA更新
 *
 * 初始化: 'random'為不放回隨機取k列(與e-means相同), 'kmeans++'為貪婪k-means++(每個新中心自 2 + floor(ln k) 個依D^2抽取之候選中取使總平方距離最小者; scikit-learn之作法, 論文附錄G.2)
 *
 * 空群處理: Lloyd每次更新後, 個數為0之群以個數不少於2之群為捐贈群(權重為個數-1)分裂復活(Faiss Clustering之作法)
 */
import { newStats, centroidNorms, assignNearest, accumulateRows } from './WClusterNearest.mjs'
import { makeRng, initRows, pickRows, splitClusters } from './WClusterUtil.mjs'


const SPLIT_EPSILON = 1e-4


/**
 * 貪婪k-means++初始化
 *
 * 距離計算次數: 首個中心n次, 其後每個中心 nTrials*n 次(點對候選中心之距離評估), 累加於stats.dist
 *
 * @param {Float64Array} X 輸入資料(n*d)
 * @param {Number} n 輸入列數
 * @param {Number} d 輸入維度
 * @param {Number} k 輸入群數
 * @param {Number} seed 輸入整數seed
 * @param {Object} stats 輸入計數器
 * @returns {Float64Array} 回傳初始中心(k*d)
 */
function initKMeansPP(X, n, d, k, seed, stats) {
    let rng = makeRng(seed)
    let nTrials = 2 + Math.floor(Math.log(k))
    let C = new Float64Array(k * d)
    let closest = new Float64Array(n)
    let cand = new Float64Array(n)
    let bestCand = new Float64Array(n)
    let cum = new Float64Array(n)

    function distTo(row, out) {
        let ro = row * d
        let s = 0
        for (let i = 0; i < n; i++) {
            let xo = i * d
            let dd = 0
            for (let t = 0; t < d; t++) {
                let df = X[xo + t] - X[ro + t]
                dd += df * df
            }
            out[i] = dd
            s += dd
        }
        stats.dist += n
        return s
    }

    let first = rng.randInt(n)
    for (let t = 0; t < d; t++) {
        C[t] = X[first * d + t]
    }
    distTo(first, closest)

    for (let c = 1; c < k; c++) {
        //依closest(D^2)之累積和以逆CDF抽候選
        let acc = 0
        for (let i = 0; i < n; i++) {
            acc += closest[i]
            cum[i] = acc
        }
        let bestPot = Infinity
        let bestRow = -1
        for (let tr = 0; tr < nTrials; tr++) {
            let row
            if (acc <= 0) {
                row = rng.randInt(n) //所有點皆已與某中心重合, 隨機取
            }
            else {
                let target = rng.random() * acc
                let lo = 0
                let hi = n - 1
                while (lo < hi) {
                    let mid = (lo + hi) >>> 1
                    if (cum[mid] > target) {
                        hi = mid
                    }
                    else {
                        lo = mid + 1
                    }
                }
                row = lo
            }
            let ro = row * d
            let s = 0
            for (let i = 0; i < n; i++) {
                let xo = i * d
                let dd = 0
                for (let t = 0; t < d; t++) {
                    let df = X[xo + t] - X[ro + t]
                    dd += df * df
                }
                let m = dd < closest[i] ? dd : closest[i]
                cand[i] = m
                s += m
            }
            stats.dist += n
            if (s < bestPot) {
                bestPot = s
                bestRow = row
                bestCand.set(cand)
            }
        }
        for (let t = 0; t < d; t++) {
            C[c * d + t] = X[bestRow * d + t]
        }
        closest.set(bestCand)
    }
    return C
}


/**
 * Lloyd k-means(固定走訪次數, 每次為完整指派加平均更新)
 *
 * 軌跡: objs[i]為第i次指派時所用中心C_i(C_0為初始中心, C_i為i次更新後)之訓練集平方距離和(精確值), 故前nIter個中心之訓練誤差不需額外走訪;
 * 回傳之centroids為nIter次更新後之C_nIter, 其訓練誤差需另做一次指派
 *
 * @param {Float64Array} X 輸入資料(n*d)
 * @param {Number} n 輸入列數
 * @param {Number} d 輸入維度
 * @param {Number} k 輸入群數(1至n)
 * @param {Object} [opt={}] 輸入設定物件
 * @param {Number} [opt.nIter=25] 輸入走訪次數，預設25(Faiss之預設)
 * @param {String} [opt.init='random'] 輸入初始化字串，可為'random'或'kmeans++'，預設'random'
 * @param {Number} [opt.seed=0] 輸入整數seed
 * @param {Float64Array} [opt.initCentroids] 輸入初始中心(k*d)，給定則忽略init
 * @param {Array} [opt.snapshots] 輸入要保存中心之更新次數(例如[1,2,3,5,10,25])，保存於回傳之snapshots
 * @param {Object} [opt.stats] 輸入計數器
 * @returns {Object} 回傳物件，centroids為最終中心，objs為各次指派之訓練平方距離和，wall與cpu為各次更新完成時之累積毫秒(自初始化完成後起算)，initWall與initCpu為初始化毫秒，snapshots為Map(更新次數 -> 中心)，nSplits為復活之群總數，stats為計數器
 */
function lloyd(X, n, d, k, opt = {}) {
    let nIter = (Number.isInteger(opt.nIter) && opt.nIter > 0) ? opt.nIter : 25
    let seed = Number.isInteger(opt.seed) ? opt.seed : 0
    let stats = opt.stats ? opt.stats : newStats()
    let snaps = new Set(Array.isArray(opt.snapshots) ? opt.snapshots : [])

    let w0 = performance.now()
    let c0 = process.cpuUsage()
    let C
    if (opt.initCentroids instanceof Float64Array && opt.initCentroids.length === k * d) {
        C = opt.initCentroids.slice()
    }
    else if (opt.init === 'kmeans++') {
        C = initKMeansPP(X, n, d, k, seed, stats)
    }
    else {
        C = pickRows(X, d, initRows(n, k, seed))
    }
    let initWall = performance.now() - w0
    let cu = process.cpuUsage(c0)
    let initCpu = (cu.user + cu.system) / 1000

    let cn = new Float64Array(k)
    let label = new Int32Array(n)
    let sums = new Float64Array(k * d)
    let counts = new Float64Array(k)
    let objs = new Float64Array(nIter)
    let wall = new Float64Array(nIter)
    let cpu = new Float64Array(nIter)
    let snapshots = new Map()
    let unused = new Uint8Array(k)
    let donor = new Uint8Array(k)
    let weight = new Float64Array(k)
    let splitRng = makeRng(seed + 7919)
    let nSplits = 0

    let w1 = performance.now()
    let c1 = process.cpuUsage()
    for (let it = 0; it < nIter; it++) {
        centroidNorms(C, k, d, cn)
        objs[it] = assignNearest(X, d, null, n, C, k, cn, label, null, stats)
        sums.fill(0)
        counts.fill(0)
        accumulateRows(X, d, null, n, label, sums, counts)
        for (let j = 0; j < k; j++) {
            let nj = counts[j]
            if (nj > 0) {
                let o = j * d
                for (let t = 0; t < d; t++) {
                    C[o + t] = sums[o + t] / nj
                }
            }
        }

        //空群復活(Faiss作法): 個數為0之群為目標, 個數不少於2者為捐贈群
        let nEmpty = 0
        for (let j = 0; j < k; j++) {
            unused[j] = counts[j] === 0 ? 1 : 0
            donor[j] = counts[j] >= 2 ? 1 : 0
            weight[j] = counts[j] - 1
            nEmpty += unused[j]
        }
        if (nEmpty > 0) {
            nSplits += splitClusters(C, d, k, weight, unused, donor, null, splitRng, SPLIT_EPSILON)
        }

        wall[it] = performance.now() - w1
        let cc = process.cpuUsage(c1)
        cpu[it] = (cc.user + cc.system) / 1000
        if (snaps.has(it + 1)) {
            snapshots.set(it + 1, C.slice())
        }
    }

    return { centroids: C, objs, wall, cpu, initWall, initCpu, snapshots, nSplits, stats }
}


export { lloyd, initKMeansPP }
export default lloyd
