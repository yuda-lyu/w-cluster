/**
 * e-means與Lloyd對照組所共用之小工具: 可重現之亂數、排列、隨機初始列、貪婪k-means++初始化、矩陣攤平檢測
 *
 * 非密碼學用途, 亂數僅供分群初始化、洗牌與捐贈群抽樣, 給定seed則結果可重現(同一JS引擎數值行為下)
 */


import isenum from 'wsemi/src/isenum.mjs'


const TWO32 = 4294967296
const FLOAT64_TINY = 2.2250738585072014e-308 //最小之正規64位元浮點數(對應np.finfo('float64').tiny)
const MAX_ABS_VALUE = 1e100 //分群資料元素之絕對值上限: 平方、內積與批次/收尾之和(列數*維度*1e200)皆不致溢位


/**
 * 將任意整數seed折成32位元無號整數
 *
 * @param {Number} seed 輸入整數(安全整數範圍)
 * @returns {Number} 回傳0~4294967295之整數
 */
function seedU32(seed) {
    let s = seed % TWO32
    if (s < 0) {
        s += TWO32
    }
    return s
}


/**
 * 依seed與序號衍生另一組seed(仿Faiss contrib/e_means base.py _epoch_seed: (seed*1000003+iteration) mod 2^32, 此處先折至32位元以保持乘積於安全整數內)
 *
 * @param {Number} seed 輸入整數
 * @param {Number} iteration 輸入序號整數
 * @returns {Number} 回傳0~4294967295之整數
 */
function epochSeed(seed, iteration) {
    return (seedU32(seed) * 1000003 + iteration) % TWO32
}


/**
 * 建立亂數產生器(mulberry32之32位元輸出)
 *
 * @param {Number} seed 輸入整數seed
 * @returns {Object} 回傳物件，u32()回傳0~2^32-1之整數，random()回傳[0,1)之53位元浮點數，randInt(m)回傳0~m-1之整數(m須為不大於2^32之正整數)
 */
function makeRng(seed) {
    let a = seedU32(seed) | 0
    function u32() {
        a = (a + 0x6D2B79F5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return (t ^ (t >>> 14)) >>> 0
    }
    function random() {
        let hi = u32() >>> 5 //27位元
        let lo = u32() >>> 6 //26位元
        return (hi * 67108864 + lo) / 9007199254740992
    }
    function randInt(m) {
        //以拒絕抽樣避免取模偏差
        let lim = TWO32 - (TWO32 % m)
        let v = u32()
        while (v >= lim) {
            v = u32()
        }
        return v % m
    }
    return { u32, random, randInt }
}


/**
 * 產生0..n-1之隨機排列(Fisher-Yates)
 *
 * @param {Number} n 輸入長度
 * @param {Object} rng 輸入makeRng回傳之物件
 * @returns {Int32Array} 回傳排列
 */
function permutation(n, rng) {
    let p = new Int32Array(n)
    for (let i = 0; i < n; i++) {
        p[i] = i
    }
    for (let i = n - 1; i > 0; i--) {
        let j = rng.randInt(i + 1)
        let t = p[i]
        p[i] = p[j]
        p[j] = t
    }
    return p
}


/**
 * 隨機初始中心所取之列索引: 不放回自n列取k列(n等於k時為0..n-1原序)
 *
 * e-means與Lloyd(random初始化)共用此函數, 同一seed得同一組初始中心
 *
 * @param {Number} n 輸入資料列數
 * @param {Number} k 輸入群數
 * @param {Number} seed 輸入整數seed
 * @returns {Int32Array} 回傳長度k之列索引
 */
function initRows(n, k, seed) {
    if (n === k) {
        let r = new Int32Array(n)
        for (let i = 0; i < n; i++) {
            r[i] = i
        }
        return r
    }
    return permutation(n, makeRng(seed)).slice(0, k)
}


/**
 * 取出指定列組成初始中心
 *
 * @param {Float64Array} X 輸入資料(n*d)
 * @param {Number} d 輸入維度
 * @param {Int32Array} rows 輸入列索引
 * @returns {Float64Array} 回傳中心(rows.length*d)
 */
function pickRows(X, d, rows) {
    let C = new Float64Array(rows.length * d)
    for (let j = 0; j < rows.length; j++) {
        let o = rows[j] * d
        for (let t = 0; t < d; t++) {
            C[j * d + t] = X[o + t]
        }
    }
    return C
}


/**
 * 貪婪k-means++初始化(scikit-learn之作法, 論文附錄G.2): 首個中心隨機取一列, 其後每個新中心自 2 + floor(ln k) 個依D^2抽取之候選中取使總平方距離最小者
 *
 * 單一擁有者: e-means(opt.init為'k-means++')與Lloyd對照組(opt.init為'kmeans++')共用此函數(同seed同結果)
 *
 * 距離計算次數: 首個中心n次, 其後每個中心 nTrials*n 次(點對候選中心之距離評估), 累加於stats.dist
 *
 * @param {Float64Array} X 輸入資料(n*d)
 * @param {Number} n 輸入列數
 * @param {Number} d 輸入維度
 * @param {Number} k 輸入群數
 * @param {Number} seed 輸入整數seed
 * @param {Object} stats 輸入計數器(須有數值欄位dist)
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
            //首個候選必入選(bestRow < 0): 平方距離和溢位為Infinity而使 s < bestPot 不成立時, 仍須有有效之列(否則X[-d]讀出undefined而寫入NaN中心)
            if (s < bestPot || bestRow < 0) {
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


const dv = new DataView(new ArrayBuffer(8))


/**
 * 回傳比x大之下一個64位元浮點數(IEEE754 nextafter朝+Infinity)
 *
 * @param {Number} x 輸入數值
 * @returns {Number} 回傳下一個較大之浮點數；NaN與+Infinity原樣回傳，0回傳最小次正規數
 */
function nextUp(x) {
    if (Number.isNaN(x) || x === Infinity) {
        return x
    }
    if (x === 0) {
        return Number.MIN_VALUE
    }
    dv.setFloat64(0, x, true)
    let lo = dv.getUint32(0, true)
    let hi = dv.getUint32(4, true)
    if (x > 0) {
        //增加尾數
        lo = (lo + 1) >>> 0
        if (lo === 0) {
            hi = (hi + 1) >>> 0
        }
    }
    else {
        //負數為減少量值
        if (lo === 0) {
            hi = (hi - 1) >>> 0
        }
        lo = (lo - 1) >>> 0
    }
    dv.setUint32(0, lo, true)
    dv.setUint32(4, hi, true)
    return dv.getFloat64(0, true)
}


/**
 * 回傳比x小之下一個64位元浮點數(nextafter朝-Infinity)
 *
 * @param {Number} x 輸入數值
 * @returns {Number} 回傳下一個較小之浮點數
 */
function nextDown(x) {
    return -nextUp(-x)
}


/**
 * 以分裂捐贈群復活未使用之群(Faiss Clustering之split_clusters作法, 亦為e-means論文附錄H之作法; e-means與Lloyd對照組共用)
 *
 * 捐贈群依其權重以不放回之比例抽樣(指數競賽: key = log(w) - log(-log(u)), 取key最大之前nsplit個), 目標群取未使用群中編號最小之nsplit個;
 * 每對之捐贈群與目標群之中心各以座標t之(1 - s_t*eps)與(1 + s_t*eps)倍擾動(s_t為t偶數取+1、奇數取-1)而成兩個子中心;
 * 兩子中心逐座標完全相同(如零向量)時, 將子中心第0維改為其下一個浮點數(nextafter)以使之相異
 *
 * @param {Float64Array} C 輸入輸出中心(k*d), 就地更新
 * @param {Number} d 輸入維度
 * @param {Number} k 輸入群數
 * @param {Float64Array} weight 輸入各群之抽樣權重(僅donor為1者須為正數)
 * @param {Uint8Array} unused 輸入各群是否為未使用(1為是)
 * @param {Uint8Array} donor 輸入各群是否可為捐贈群(1為是)
 * @param {Float64Array|null} usage 輸入輸出各群之質量(e-means之N_j), 非null時捐贈群與目標群皆設為捐贈群質量之一半
 * @param {Object} rng 輸入makeRng回傳之物件
 * @param {Number} eps 輸入擾動比例(e-means為1e-4)
 * @returns {Number} 回傳實際分裂之群數
 */
function splitClusters(C, d, k, weight, unused, donor, usage, rng, eps) {
    let nUnused = 0
    let nDonor = 0
    for (let j = 0; j < k; j++) {
        if (unused[j] === 1) {
            nUnused += 1
        }
        if (donor[j] === 1) {
            nDonor += 1
        }
    }
    let nsplit = Math.min(nUnused, nDonor)
    if (nsplit === 0) {
        return 0
    }

    //每次檢查對全部k群各抽一個均勻亂數(與參考實作相同, 使亂數流之耗用與捐贈群數量無關)
    let keys = new Float64Array(k)
    for (let j = 0; j < k; j++) {
        let u = rng.random()
        if (u < FLOAT64_TINY) {
            u = FLOAT64_TINY
        }
        keys[j] = donor[j] === 1 ? Math.log(weight[j]) - Math.log(-Math.log(u)) : -Infinity
    }
    let order = Array.from({ length: k }, (v, j) => j)
    order.sort((a, b) => keys[b] - keys[a] || a - b)
    let source = order.slice(0, nsplit)
    let target = []
    for (let j = 0; j < k && target.length < nsplit; j++) {
        if (unused[j] === 1) {
            target.push(j)
        }
    }

    for (let m = 0; m < nsplit; m++) {
        let s = source[m]
        let g = target[m]
        let os = s * d
        let og = g * d
        let collapsed = true
        for (let t = 0; t < d; t++) {
            let off = (t % 2 === 0 ? 1 : -1) * eps
            let c = C[os + t]
            let dn = c * (1 - off)
            let ch = c * (1 + off)
            C[os + t] = dn
            C[og + t] = ch
            if (dn !== ch) {
                collapsed = false
            }
        }
        if (collapsed) {
            let v = C[og]
            let nb = nextUp(v)
            if (!Number.isFinite(nb)) {
                nb = nextDown(v)
            }
            C[og] = nb
        }
        if (usage !== null) {
            let half = usage[s] / 2
            usage[s] = half
            usage[g] = half
        }
    }
    return nsplit
}


/**
 * 將數據陣列(陣列之陣列)檢測並攤平為列優先之Float64Array
 *
 * 檢測依輸入規格: 資料為必須參數, 非預期輸入即拋錯(同步throw, 於async入口轉為reject); 每個元素須為有效數字(數字或數字字串, 以wsemi isenum判定, 轉換後之值才使用),
 * 標記字串('-'、'NP'等)、null、布林、NaN、Infinity皆為無效; 另限定絕對值不大於1e100(使平方、內積與各群之和不致溢位);
 * 錯誤訊息只帶位置與期望之種類, 不帶輸入值(V19、V20); 各列之形狀先於配置記憶體檢測
 *
 * @param {Array} data 輸入數據陣列(各列為等長之陣列)
 * @returns {Object} 回傳{ X, n, d }，X為列優先之Float64Array(長度n*d)
 */
function flattenMat(data) {
    if (!Array.isArray(data) || data.length === 0) {
        throw new Error('invalid data: must be a non-empty array')
    }
    let n = data.length
    if (!Array.isArray(data[0]) || data[0].length === 0) {
        throw new Error('invalid data[0]: must be a non-empty array')
    }
    let d = data[0].length

    //先驗各列之形狀(不配置記憶體), 再配置, 使超大形狀得到可預期之訊息而非原生之配置錯誤
    for (let i = 0; i < n; i++) {
        let row = data[i]
        if (!Array.isArray(row)) {
            throw new Error(`invalid data[${i}]: must be an array`)
        }
        if (row.length !== d) {
            throw new Error(`invalid data[${i}]: must have the same length as data[0]`)
        }
    }
    let X
    try {
        X = new Float64Array(n * d)
    }
    catch (err) {
        throw new Error('invalid data: must be small enough to be processed in memory')
    }

    for (let i = 0; i < n; i++) {
        let row = data[i]
        let o = i * d
        for (let j = 0; j < d; j++) {
            let v = row[j]
            if (!isenum(v)) {
                throw new Error(`invalid data[${i}][${j}]: must be a valid number`)
            }
            let x = Number(v)
            if (x > MAX_ABS_VALUE || x < -MAX_ABS_VALUE) {
                throw new Error(`invalid data[${i}][${j}]: must be a valid number with absolute value at most 1e100`)
            }
            X[o + j] = x
        }
    }
    return { X, n, d }
}


/**
 * 將各維(欄)減去其平均值(就地), 使資料以原點為中心
 *
 * 最近中心之距離以 |c|^2 - 2x·c 比較(WClusterNearest), 當資料之偏移量遠大於其分散度時(例如座標約1e8而群間距約1),
 * 平方範數相減會抵銷掉全部有效位數而選錯最近中心; 平移不改變任何兩點間之距離, 故於分群前置中可避免此一精度損失
 *
 * @param {Float64Array} X 輸入輸出資料(n*d), 就地更新
 * @param {Number} n 輸入列數
 * @param {Number} d 輸入維度
 * @returns {Float64Array} 回傳各維所減去之平均值(長度d)
 */
function centerColumns(X, n, d) {
    let mu = new Float64Array(d)
    for (let i = 0; i < n; i++) {
        let o = i * d
        for (let t = 0; t < d; t++) {
            mu[t] += X[o + t]
        }
    }
    for (let t = 0; t < d; t++) {
        mu[t] /= n
    }
    for (let i = 0; i < n; i++) {
        let o = i * d
        for (let t = 0; t < d; t++) {
            X[o + t] -= mu[t]
        }
    }
    return mu
}


/**
 * 是否為一般物件(原型為Object.prototype或null; 陣列、Date、包裝物件、類別實例、函數皆否)
 *
 * @param {*} o 輸入任意值
 * @returns {Boolean} 回傳布林
 */
function isPlainObject(o) {
    if (typeof o !== 'object' || o === null) {
        return false
    }
    let p = Object.getPrototypeOf(o)
    return p === Object.prototype || p === null
}


export { seedU32, epochSeed, makeRng, permutation, initRows, pickRows, initKMeansPP, nextUp, nextDown, splitClusters, flattenMat, centerColumns, isPlainObject, MAX_ABS_VALUE }
