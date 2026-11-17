/* eslint-disable no-new-wrappers */
import assert from 'assert'
import { inspect } from 'util'
import WCluster from '../src/WCluster.mjs'
import { emeans, applyEma, resolveRecipe, roundPowerOfTwo, stepLaw, scheduledAlpha, epochRows, CONST } from '../src/WEmeans.mjs'
import { lloyd, initKMeansPP } from '../src/WClusterLloyd.mjs'
import { newStats, centroidNorms, assignNearest, accumulateRows } from '../src/WClusterNearest.mjs'
import { makeRng, permutation, initRows, pickRows, nextUp, nextDown, splitClusters, flattenMat, epochSeed, centerColumns, MAX_ABS_VALUE } from '../src/WClusterUtil.mjs'
import { kmeans } from 'ml-kmeans'


//規格來源: Bessa et al., "e-means: outperforming k-means (in one-tenth the epochs)", arXiv:2611.09501(下稱論文)與
//Faiss contrib/e_means之base.py、e_means.py(下稱參考實作); 輸入檢測依跨套件規格(K3、V19、V20)
//測試資料由亂數產生, 各列各欄之值逐筆相異(刻意之邊界案除外: 全部列相同、中心重複以測平手與零向量)

function makeGaussFn(seed) {
    let rng = makeRng(seed)
    let spare = null
    return function() {
        if (spare !== null) {
            let v = spare
            spare = null
            return v
        }
        let u = 0
        while (u === 0) {
            u = rng.random()
        }
        let w = rng.random()
        let r = Math.sqrt(-2 * Math.log(u))
        spare = r * Math.sin(2 * Math.PI * w)
        return r * Math.cos(2 * Math.PI * w)
    }
}


//高斯混合: G個中心(各維取自N(0, sMu^2)), 每群nPer點(N(中心, sW^2)); 回傳Float64Array與陣列之陣列
function makeBlobs(G, nPer, d, sMu, sW, seed, seedPoints = seed + 1000) {
    //中心與點各用獨立之亂數流: 同seed得同一組中心, 異seedPoints得另抽之點
    let gc = makeGaussFn(seed)
    let g = makeGaussFn(seedPoints)
    let centers = []
    for (let j = 0; j < G; j++) {
        let c = []
        for (let t = 0; t < d; t++) {
            c.push(sMu * gc())
        }
        centers.push(c)
    }
    let n = G * nPer
    let X = new Float64Array(n * d)
    let rows = []
    for (let i = 0; i < n; i++) {
        let c = centers[i % G]
        let row = []
        for (let t = 0; t < d; t++) {
            let v = c[t] + sW * g()
            X[i * d + t] = v
            row.push(v)
        }
        rows.push(row)
    }
    return { X, rows, n, d }
}


function mseOf(X, n, d, k, C) {
    let cn = centroidNorms(C, k, d, new Float64Array(k))
    let lab = new Int32Array(n)
    return assignNearest(X, d, null, n, C, k, cn, lab, null, null) / n
}


function mean(a) {
    return a.reduce((x, y) => x + y, 0) / a.length
}


describe('e-means: 縮放律與排程(論文式5~7、參考實作base.py)', function() {

    it('常數依論文與參考實作: epsilon=0.1(式5)、每5次更新檢查復活、N_j初值1e-10(演算法1第3列)、delta=1e-4(附錄H式8)、tau=0.1(3.1節)', function() {
        assert.strictEqual(CONST.ALPHA_MIN_FACTOR, 0.1)
        assert.strictEqual(CONST.CHECK_UNUSED_EVERY, 5)
        assert.strictEqual(CONST.INIT_USAGE, 1e-10)
        assert.strictEqual(CONST.SPLIT_EPSILON, 1e-4)
        assert.strictEqual(CONST.UNUSED_THRESHOLD, 0.1)
        assert.strictEqual(CONST.NO_REVIVAL_MAX_D, 2) //base.py:38
        assert.strictEqual(CONST.AUTO_QUALITY_MAX_D, 16) //base.py:46
        assert.strictEqual(CONST.ALPHA0_MIN, 1e-4) //base.py:86
        assert.strictEqual(CONST.DEFAULT_EPOCHS, 5) //e_means.py:165
        //表2: 步長律(c,k,B,n,T)=(0.824,-0.46,0.90,-0.45,-0.11), 批次律(c,k,n,T)=(0.035,0.13,0.88,0.81)與其1/8(0.0044)
        assert.deepStrictEqual(CONST.ALPHA_LAW.map((v) => Math.round(v * 100) / 100), [0.82, -0.46, 0.9, -0.45, -0.11])
        assert.deepStrictEqual(CONST.BATCH_LAWS.throughput.map((v) => Math.round(v * 1000) / 1000), [0.035, 0.135, 0.876, 0.813])
        assert.deepStrictEqual(CONST.BATCH_LAWS.quality.map((v) => Math.round(v * 10000) / 10000), [0.0044, 0.1347, 0.8765, 0.8133])
        assert.ok(Math.abs(CONST.BATCH_LAWS.quality[0] * 8 - CONST.BATCH_LAWS.throughput[0]) < 1e-6) //quality為throughput之1/8係數
    })

    it('roundPowerOfTwo 取比例意義下最近之2的冪(base.py:67-73)', function() {
        let cases = [[0.3, 1], [1, 1], [1.4, 1], [1.5, 2], [5.6, 4], [5.7, 8], [1000, 1024], [32768, 32768], [39651.9, 32768]]
        for (let [v, e] of cases) {
            assert.strictEqual(roundPowerOfTwo(v), e, `v=${v}`)
        }
    })

    it('scheduledAlpha 自alpha0餘弦降至0.1*alpha0(論文式5, epsilon=0.1)', function() {
        assert.strictEqual(scheduledAlpha(0.5, 0, 100), 0.5)
        assert.ok(Math.abs(scheduledAlpha(0.5, 100, 100) - 0.05) < 1e-15)
        assert.ok(Math.abs(scheduledAlpha(0.5, 50, 100) - 0.5 * 0.55) < 1e-15)
        assert.ok(Math.abs(scheduledAlpha(0.5, 25, 100) - 0.5 * (0.1 + 0.9 * 0.5 * (1 + Math.cos(Math.PI / 4)))) < 1e-15)
        //總步數為0時不除以0
        assert.strictEqual(scheduledAlpha(0.5, 0, 0), 0.5)
        //步數超過總步數時夾在終點
        assert.ok(Math.abs(scheduledAlpha(0.5, 500, 100) - 0.05) < 1e-15)
    })

    it('epochRows 為整數次走訪、四捨五入(ties-to-even)之小數走訪、最後一次完整走訪(base.py:156-166)', function() {
        assert.deepStrictEqual(epochRows(1000, 3), [1000, 1000, 1000])
        assert.deepStrictEqual(epochRows(1000, 1), [1000])
        assert.deepStrictEqual(epochRows(1000, 1.4), [400, 1000])
        assert.deepStrictEqual(epochRows(1000, 2.6), [1000, 600, 1000])
        assert.deepStrictEqual(epochRows(1000, 0.5), [500])
        assert.deepStrictEqual(epochRows(10, 1.25), [2, 10]) //2.5捨入至偶數2
        assert.deepStrictEqual(epochRows(10, 1.35), [4, 10]) //3.5捨入至偶數4
    })

    it('stepLaw 依式6與表2係數, 結果夾於[1e-4,1](獨立算式: 0.8244*k^-0.4617*B^0.9003*n^-0.4498*T^-0.1057)', function() {
        let a = stepLaw(1e6, 1024, 3, 4096)
        assert.ok(Math.abs(a - 0.10696912360542654) < 1e-12)
        assert.strictEqual(stepLaw(1e6, 1024, 3, 1e12), 1) //上夾
        assert.strictEqual(stepLaw(1e9, 1e6, 25, 1), 1e-4) //下夾
    })

    it('resolveRecipe 依批次律與步長律決定B與alpha0(throughput: d>16, quality: d<=16, 式7)', function() {
        let r = resolveRecipe(1e6, 128, 1024, { nEpochs: 3 })
        assert.strictEqual(r.batchLaw, 'throughput')
        assert.strictEqual(r.batchSize, 32768) //獨立算式: 0.035134*1024^0.134749*1e6^0.876473*3^0.813344=39651.9 -> 32768
        assert.ok(Math.abs(r.alpha0 - 0.6955211692520258) < 1e-12)
        assert.deepStrictEqual(r.epochRows, [1e6, 1e6, 1e6])
        assert.strictEqual(r.totalSteps, 3 * Math.ceil(1e6 / 32768))
        let q = resolveRecipe(1e6, 16, 1024, { nEpochs: 3 })
        assert.strictEqual(q.batchLaw, 'quality')
        assert.strictEqual(q.batchSize, 4096) //獨立算式: quality = throughput之1/8係數 -> 4956.5 -> 4096
        let q2 = resolveRecipe(1e6, 17, 1024, { nEpochs: 3 })
        assert.strictEqual(q2.batchLaw, 'throughput')
        //小資料: quality律之B夾於floor(n/2)以內
        let s = resolveRecipe(2000, 8, 16, { nEpochs: 2.6 })
        assert.strictEqual(s.batchSize, 8)
        assert.ok(Math.abs(s.alpha0 - 0.044114537201538025) < 1e-12)
        let tiny = resolveRecipe(4, 3, 2, {})
        assert.ok(tiny.batchSize >= 1 && tiny.batchSize <= 2)
    })

    it('resolveRecipe 之batchLaw指定與batchSize/alpha0指定(base.py:139-153)', function() {
        let a = resolveRecipe(1e6, 8, 1024, { nEpochs: 3, batchLaw: 'throughput' })
        assert.strictEqual(a.batchLaw, 'throughput')
        assert.strictEqual(a.batchLawReason, 'requested')
        assert.strictEqual(a.batchSize, 32768)
        let b = resolveRecipe(1000, 8, 16, { nEpochs: 3, batchSize: 5000 })
        assert.strictEqual(b.batchSize, 1000) //夾至n
        assert.strictEqual(b.batchLaw, null)
        let c = resolveRecipe(1000, 8, 16, { nEpochs: 3, batchSize: 100, alpha0: 0.25 })
        assert.strictEqual(c.batchSize, 100)
        assert.strictEqual(c.alpha0, 0.25)
        assert.strictEqual(c.totalSteps, 30)
    })

    it('resolveRecipe 之復活門檻: 維度<=2預設0(不復活), 其他預設0.1, 可指定(base.py:38,102-109)', function() {
        assert.strictEqual(resolveRecipe(1000, 2, 8, {}).unusedThreshold, 0)
        assert.strictEqual(resolveRecipe(1000, 3, 8, {}).unusedThreshold, 0.1)
        assert.strictEqual(resolveRecipe(1000, 2, 8, { unusedThreshold: 0.3 }).unusedThreshold, 0.3)
        assert.strictEqual(resolveRecipe(1000, 3, 8, { unusedThreshold: 0 }).unusedThreshold, 0)
    })

    it('K3: opt鍵給了非預期之輸入(型別不符、超出範圍)視為未給, 改用預設, 不報錯', function() {
        let base = resolveRecipe(1000, 8, 16, {})
        let bad = [
            { nEpochs: 'abc' }, { nEpochs: -1 }, { nEpochs: 0 }, { nEpochs: NaN }, { nEpochs: Infinity }, { nEpochs: 5000 }, { nEpochs: true }, { nEpochs: [3] }, { nEpochs: '0x10' },
            { batchSize: 0 }, { batchSize: 1.5 }, { batchSize: 'x' }, { batchSize: -3 }, { batchSize: 10n },
            { alpha0: 2 }, { alpha0: -1 }, { alpha0: 0 }, { alpha0: 'x' }, { alpha0: NaN },
            { batchLaw: 'foo' }, { batchLaw: 3 }, { batchLaw: {} },
            { unusedThreshold: -1 }, { unusedThreshold: 'x' }, { unusedThreshold: NaN },
            { seed: 1.5 }, { seed: 'x' }, { seed: NaN }, { seed: true },
            null, undefined, 'x', 5, [], { nEpochs: null, batchSize: null, alpha0: null, batchLaw: null, unusedThreshold: null },
            //opt本身非一般物件(原型非Object.prototype/null)者整份視為未給(規格V4), 即使帶有看似有效之鍵
            Object.assign(new Date(), { nEpochs: 2, batchSize: 7 }),
            Object.assign(new Number(1), { nEpochs: 2 }),
            Object.create({ nEpochs: 2 }),
            new (class Opt {
                constructor() {
                    this.nEpochs = 2
                    this.alpha0 = 0.3
                }
            })(),
        ]
        for (let o of bad) {
            let r = resolveRecipe(1000, 8, 16, o)
            assert.deepStrictEqual(r, base, `opt=${inspect(o)}`)
        }
    })

    it('K4: opt給數字字串時以轉換後之值使用', function() {
        let a = resolveRecipe(1000, 8, 16, { nEpochs: '3', batchSize: ' 64 ', alpha0: '0.25', unusedThreshold: '0.2', seed: '7' })
        let b = resolveRecipe(1000, 8, 16, { nEpochs: 3, batchSize: 64, alpha0: 0.25, unusedThreshold: 0.2, seed: 7 })
        assert.deepStrictEqual(a, b)
        assert.strictEqual(a.nEpochs, 3)
        assert.strictEqual(a.batchSize, 64)
        assert.strictEqual(a.seed, 7)
    })

})


describe('e-means: EMA更新(論文式2~4, 參考實作e_means.py:456-505)', function() {

    it('applyEma 對被指派之群: 質量N<-(1-a)N+a*n, 中心朝批次平均移動 a*n/N 之比例; 未被指派之群中心不動而質量衰減', function() {
        //k=3, d=2; 群0被指派3點(和[3,6]), 群1被指派0點, 群2被指派2點(和[10,-4])
        let C = Float64Array.from([1, 2, 7, 8, -1, 0.5])
        let usage = Float64Array.from([2, 4, 1])
        let sums = Float64Array.from([3, 6, 0, 0, 10, -4])
        let counts = Float64Array.from([3, 0, 2])
        applyEma(C, usage, sums, counts, 3, 2, 0.25)
        //群0: N=0.75*2+0.25*3=2.25, weight=0.75/2.25=1/3, 批次平均[1,2], 中心[1,2]+(1/3)*([1,2]-[1,2])=[1,2]
        assert.ok(Math.abs(usage[0] - 2.25) < 1e-15)
        assert.ok(Math.abs(C[0] - 1) < 1e-15 && Math.abs(C[1] - 2) < 1e-15)
        //群1: 質量衰減0.75*4=3, 中心不動
        assert.ok(Math.abs(usage[1] - 3) < 1e-15)
        assert.deepStrictEqual([C[2], C[3]], [7, 8])
        //群2: N=0.75*1+0.25*2=1.25, weight=0.5/1.25=0.4, 批次平均[5,-2], 中心[-1,0.5]+0.4*([5,-2]-[-1,0.5])=[1.4,-0.5]
        assert.ok(Math.abs(usage[2] - 1.25) < 1e-15)
        assert.ok(Math.abs(C[4] - 1.4) < 1e-14 && Math.abs(C[5] - (-0.5)) < 1e-14)
    })

    it('applyEma 之群0中心於批次平均不同於舊中心時依weight內插', function() {
        let C = Float64Array.from([0, 0])
        let usage = Float64Array.from([1])
        applyEma(C, usage, Float64Array.from([8, 4]), Float64Array.from([2]), 1, 2, 0.5)
        //N=0.5*1+0.5*2=1.5, weight=1/1.5, 批次平均[4,2] -> [4,2]*(2/3)
        assert.ok(Math.abs(C[0] - 8 / 3) < 1e-14 && Math.abs(C[1] - 4 / 3) < 1e-14)
        assert.ok(Math.abs(usage[0] - 1.5) < 1e-15)
    })

    it('applyEma 初始質量極小時(1e-10)首批次之中心即為批次平均(演算法1第3列之初始化載重極小)', function() {
        let C = Float64Array.from([9, 9])
        let usage = Float64Array.from([1e-10])
        applyEma(C, usage, Float64Array.from([6, 3]), Float64Array.from([3]), 1, 2, 0.01)
        assert.ok(Math.abs(C[0] - 2) < 1e-6 && Math.abs(C[1] - 1) < 1e-6)
    })

    it('applyEma 之alpha為1時不衰減舊質量, 被指派之群質量改為a*n(e_means.py:489-496)', function() {
        let C = Float64Array.from([5, 5])
        let usage = Float64Array.from([3, 7])
        applyEma(C, usage, Float64Array.from([4, 2, 0, 0]), Float64Array.from([2, 0]), 2, 2, 1)
        assert.deepStrictEqual([C[0], C[1]], [2, 1])
        assert.strictEqual(usage[0], 2)
        assert.strictEqual(usage[1], 7)
    })

})


describe('e-means: 共用最近中心核心', function() {

    let ds = makeBlobs(7, 40, 5, 3, 1, 21) //n=280, d=5
    let k = 7

    it('assignNearest 之標籤為精確最近中心, 距離為精確平方距離(含k非4之倍數之尾段)', function() {
        let { X, n, d } = ds
        for (let kk of [1, 2, 3, 4, 5, 6, 7]) {
            let C = pickRows(X, d, initRows(n, kk, 5))
            let cn = centroidNorms(C, kk, d, new Float64Array(kk))
            let lab = new Int32Array(n)
            let dist = new Float64Array(n)
            let tot = assignNearest(X, d, null, n, C, kk, cn, lab, dist, null)
            let sum = 0
            for (let i = 0; i < n; i++) {
                let best = Infinity
                for (let j = 0; j < kk; j++) {
                    let s = 0
                    for (let t = 0; t < d; t++) {
                        let df = X[i * d + t] - C[j * d + t]
                        s += df * df
                    }
                    if (s < best) {
                        best = s
                    }
                }
                assert.ok(Math.abs(dist[i] - best) <= 1e-9 * (1 + best), `i=${i} k=${kk}`)
                let o = lab[i] * d
                let s2 = 0
                for (let t = 0; t < d; t++) {
                    let df = X[i * d + t] - C[o + t]
                    s2 += df * df
                }
                assert.ok(Math.abs(s2 - best) <= 1e-9 * (1 + best))
                sum += best
            }
            assert.ok(Math.abs(tot - sum) <= 1e-9 * sum)
        }
    })

    it('assignNearest 以rows索引指派時, 結果依處理順序對應(非原順序), 距離計算次數為 nRows*k', function() {
        let { X, n, d } = ds
        let C = pickRows(X, d, initRows(n, k, 3))
        let cn = centroidNorms(C, k, d, new Float64Array(k))
        let rows = Int32Array.from([270, 3, 99, 100, 5])
        let lab = new Int32Array(5)
        let all = new Int32Array(n)
        let stats = newStats()
        assignNearest(X, d, rows, 5, C, k, cn, lab, null, stats)
        assignNearest(X, d, null, n, C, k, cn, all, null, null)
        for (let i = 0; i < 5; i++) {
            assert.strictEqual(lab[i], all[rows[i]])
        }
        assert.strictEqual(stats.dist, 5 * k)
        assert.strictEqual(stats.assignRows, 5)
    })

    it('assignNearest 同距離時取群編號較小者(4個一組之各位置之間, 及組與尾段之間)', function() {
        let P = [1, 1]
        let Q = [5, 5]
        let R = [9, -3]
        let S = [-4, 7]
        let run = (cs, xs) => {
            let k = cs.length
            let C = Float64Array.from(cs.flat())
            let X = Float64Array.from(xs.flat())
            let cn = centroidNorms(C, k, 2, new Float64Array(k))
            let lab = new Int32Array(xs.length)
            assignNearest(X, 2, null, xs.length, C, k, cn, lab, null, null)
            return Array.from(lab)
        }
        assert.deepStrictEqual(run([P, P, Q, Q], [P, Q]), [0, 2]) //位置0與1、2與3同
        assert.deepStrictEqual(run([Q, P, P, Q], [P, Q]), [1, 0]) //位置1與2、0與3同
        assert.deepStrictEqual(run([P, Q, R, S, S, P], [S, P]), [3, 0]) //4個一組之內與尾段同
    })

    it('accumulateRows 依標籤累加各群之和與個數(以rows索引)', function() {
        let X = Float64Array.from([1, 10, 2, 20, 3, 30, 4, 40])
        let sums = new Float64Array(4)
        let counts = new Float64Array(2)
        accumulateRows(X, 2, Int32Array.from([3, 0, 2]), 3, Int32Array.from([1, 0, 1]), sums, counts)
        assert.deepStrictEqual(Array.from(sums), [1, 10, 4 + 3, 40 + 30])
        assert.deepStrictEqual(Array.from(counts), [1, 2])
    })

})


describe('e-means: 工具函數', function() {

    it('makeRng 同seed同序列, 異seed異序列, random在[0,1), randInt在範圍內且各值皆出現', function() {
        let a = makeRng(42)
        let b = makeRng(42)
        let c = makeRng(43)
        let sa = []
        let sb = []
        let sc = []
        for (let i = 0; i < 20; i++) {
            sa.push(a.u32())
            sb.push(b.u32())
            sc.push(c.u32())
        }
        assert.deepStrictEqual(sa, sb)
        assert.notDeepStrictEqual(sa, sc)
        let r = makeRng(7)
        let seen = new Set()
        for (let i = 0; i < 2000; i++) {
            let v = r.random()
            assert.ok(v >= 0 && v < 1)
            let w = r.randInt(6)
            assert.ok(Number.isInteger(w) && w >= 0 && w < 6)
            seen.add(w)
        }
        assert.strictEqual(seen.size, 6)
    })

    it('permutation 為0..n-1之排列, 同seed可重現, 異seed不同', function() {
        let p = permutation(50, makeRng(1))
        assert.deepStrictEqual(Array.from(p).sort((x, y) => x - y), Array.from({ length: 50 }, (v, i) => i))
        assert.deepStrictEqual(Array.from(permutation(50, makeRng(1))), Array.from(p))
        assert.notDeepStrictEqual(Array.from(permutation(50, makeRng(2))), Array.from(p))
    })

    it('initRows 取k個相異列(不放回); n等於k時為原序; 同seed可重現', function() {
        let r = initRows(100, 10, 3)
        assert.strictEqual(r.length, 10)
        assert.strictEqual(new Set(r).size, 10)
        assert.ok(r.every((v) => v >= 0 && v < 100))
        assert.deepStrictEqual(Array.from(initRows(100, 10, 3)), Array.from(r))
        assert.deepStrictEqual(Array.from(initRows(5, 5, 3)), [0, 1, 2, 3, 4])
    })

    it('epochSeed 為(seed*1000003+iteration) mod 2^32(base.py:169-171)並於負數seed仍在範圍內', function() {
        assert.strictEqual(epochSeed(1, 0), 1000003)
        assert.strictEqual(epochSeed(1, 5), 1000008)
        assert.strictEqual(epochSeed(4294967296 + 2, 1), (2 * 1000003 + 1) % 4294967296)
        let v = epochSeed(-5, 3)
        assert.ok(v >= 0 && v < 4294967296)
    })

    it('nextUp/nextDown 為IEEE754相鄰浮點數(nextafter)', function() {
        assert.strictEqual(nextUp(1), 1 + 2.220446049250313e-16)
        assert.strictEqual(nextDown(1), 1 - 1.1102230246251565e-16)
        assert.strictEqual(nextUp(0), Number.MIN_VALUE)
        assert.strictEqual(nextUp(-1), -(1 - 1.1102230246251565e-16))
        assert.strictEqual(nextUp(-Number.MIN_VALUE), -0)
        assert.strictEqual(nextUp(Number.MAX_VALUE), Infinity)
        assert.strictEqual(nextDown(Number.MAX_VALUE), Number.MAX_VALUE - 1.9958403095347198e+292)
        assert.strictEqual(nextUp(Infinity), Infinity)
        assert.ok(Number.isNaN(nextUp(NaN)))
        assert.strictEqual(nextUp(4294967295), 4294967295 + 2 ** -21) //[2^31,2^32)之間距為2^-21
    })

    it('splitClusters 將捐贈群之中心分裂為(1-s*eps)與(1+s*eps)倍, 質量各半; 分裂數為min(未使用數, 捐贈數)', function() {
        //k=4, d=3; 群2、3未使用, 群0為唯一捐贈群
        let C = Float64Array.from([2, 4, 6, 100, 100, 100, 0, 0, 0, 0, 0, 0])
        let usage = Float64Array.from([8, 0, 0, 0])
        let unused = Uint8Array.from([0, 0, 1, 1])
        let donor = Uint8Array.from([1, 0, 0, 0])
        let n = splitClusters(C, 3, 4, Float64Array.from([8, 0, 0, 0]), unused, donor, usage, makeRng(1), 1e-2)
        assert.strictEqual(n, 1)
        //捐贈群0: 座標偶數位(0,2)乘(1-eps), 奇數位乘(1+eps); 目標群2相反
        assert.ok(Math.abs(C[0] - 2 * 0.99) < 1e-14 && Math.abs(C[1] - 4 * 1.01) < 1e-14 && Math.abs(C[2] - 6 * 0.99) < 1e-14)
        assert.ok(Math.abs(C[6] - 2 * 1.01) < 1e-14 && Math.abs(C[7] - 4 * 0.99) < 1e-14 && Math.abs(C[8] - 6 * 1.01) < 1e-14)
        assert.strictEqual(usage[0], 4)
        assert.strictEqual(usage[2], 4)
        //群1、3未被選為目標或捐贈: 不動
        assert.deepStrictEqual(Array.from(C.slice(3, 6)), [100, 100, 100])
        assert.deepStrictEqual(Array.from(C.slice(9, 12)), [0, 0, 0])
        assert.strictEqual(usage[3], 0)
    })

    it('splitClusters 於捐贈群中心逐座標相同(零向量)時以nextafter使兩子中心相異; 無捐贈群或無未使用群時回傳0', function() {
        let C = new Float64Array(6) //k=2, d=3, 全為0
        let usage = Float64Array.from([2, 0])
        let n = splitClusters(C, 3, 2, Float64Array.from([2, 0]), Uint8Array.from([0, 1]), Uint8Array.from([1, 0]), usage, makeRng(1), 1e-4)
        assert.strictEqual(n, 1)
        assert.strictEqual(C[3], Number.MIN_VALUE)
        assert.strictEqual(C[0], 0)
        assert.strictEqual(splitClusters(C, 3, 2, new Float64Array(2), Uint8Array.from([0, 0]), Uint8Array.from([1, 1]), null, makeRng(1), 1e-4), 0)
        assert.strictEqual(splitClusters(C, 3, 2, new Float64Array(2), Uint8Array.from([1, 1]), Uint8Array.from([0, 0]), null, makeRng(1), 1e-4), 0)
    })

    it('splitClusters 捐贈群之入選機率與權重成正比(權重1與3之兩個捐贈群, 入選比約1:3)', function() {
        let wins = [0, 0]
        let trials = 4000
        for (let s = 0; s < trials; s++) {
            let C = Float64Array.from([1, 2, 3, 4, 0, 0])
            let usage = Float64Array.from([1, 3, 0])
            splitClusters(C, 2, 3, Float64Array.from([1, 3, 0]), Uint8Array.from([0, 0, 1]), Uint8Array.from([1, 1, 0]), usage, makeRng(1000 + s), 1e-4)
            wins[usage[0] === 0.5 ? 0 : 1] += 1
        }
        let p = wins[1] / trials
        //理論值0.75, 容許抽樣誤差(標準誤約0.007); 等機率為0.5、權重取平方根為0.634, 皆被排除
        assert.ok(p > 0.72 && p < 0.78, `p=${p}`)
    })

    it('splitClusters 依權重不放回抽捐贈群(同seed可重現, 權重極大者必入選)', function() {
        let k = 6
        let d = 2
        let C = new Float64Array(k * d)
        for (let i = 0; i < C.length; i++) {
            C[i] = 1 + i
        }
        let unused = Uint8Array.from([0, 0, 0, 0, 1, 1])
        let donor = Uint8Array.from([1, 1, 1, 1, 0, 0])
        let w = Float64Array.from([1, 1e12, 1, 1, 0, 0])
        let usage = Float64Array.from([1, 1e12, 1, 1, 0, 0])
        let C1 = C.slice()
        let n1 = splitClusters(C1, d, k, w, unused, donor, usage, makeRng(5), 1e-3)
        assert.strictEqual(n1, 2)
        assert.strictEqual(usage[1], 5e11) //權重極大之群1必為捐贈群
        let u2 = Float64Array.from([1, 1e12, 1, 1, 0, 0])
        let C2 = C.slice()
        splitClusters(C2, d, k, w, unused, donor, u2, makeRng(5), 1e-3)
        assert.deepStrictEqual(Array.from(C1), Array.from(C2))
        assert.deepStrictEqual(Array.from(usage), Array.from(u2))
    })

})


describe('e-means: 演算法本體', function() {

    let ds = makeBlobs(12, 100, 8, 2, 1, 33) //n=1200, d=8, 12個群心
    let k = 12

    it('回傳形狀: centroids為k*d、labels為n、距離計算次數為各走訪列數之和乘k、各群之標籤在範圍內', function() {
        let { X, n, d } = ds
        let r = emeans(X, n, d, k, { nEpochs: 2.6, seed: 4 })
        assert.strictEqual(r.centroids.length, k * d)
        assert.strictEqual(r.labels.length, n)
        assert.ok(r.centroids.every((v) => Number.isFinite(v)))
        assert.ok(r.labels.every((l) => l >= 0 && l < k))
        assert.deepStrictEqual(r.recipe.epochRows, [1200, 720, 1200])
        assert.strictEqual(r.stats.dist, (1200 + 720 + 1200) * k)
        assert.strictEqual(r.epochObjective.length, 3)
        assert.ok(r.epochObjective.every((v) => v > 0))
    })

    it('收尾: 有被指派之群之中心等於其標籤成員之平均(演算法1第12列, last-epoch-mean)', function() {
        let { X, n, d } = ds
        let r = emeans(X, n, d, k, { nEpochs: 3, seed: 9 })
        let sums = new Float64Array(k * d)
        let counts = new Float64Array(k)
        accumulateRows(X, d, null, n, r.labels, sums, counts)
        let nonEmpty = 0
        for (let j = 0; j < k; j++) {
            if (counts[j] > 0) {
                nonEmpty += 1
                for (let t = 0; t < d; t++) {
                    assert.ok(Math.abs(r.centroids[j * d + t] - sums[j * d + t] / counts[j]) < 1e-9, `j=${j} t=${t}`)
                }
            }
        }
        assert.ok(nonEmpty > 0)
    })

    it('seed給定時結果可重現(centroids與labels逐位相同); 不同seed結果不同', function() {
        let { X, n, d } = ds
        let a = emeans(X, n, d, k, { nEpochs: 2, seed: 5 })
        let b = emeans(X, n, d, k, { nEpochs: 2, seed: 5 })
        let c = emeans(X, n, d, k, { nEpochs: 2, seed: 6 })
        assert.deepStrictEqual(Array.from(a.centroids), Array.from(b.centroids))
        assert.deepStrictEqual(Array.from(a.labels), Array.from(b.labels))
        assert.notDeepStrictEqual(Array.from(a.centroids), Array.from(c.centroids))
    })

    it('指定initRows時以該些列為初始中心(與seed無關之初始化), 與同seed預設初始化不同; initCentroids優先於initRows', function() {
        let { X, n, d } = ds
        let idx = Int32Array.from([100, 1, 250, 3, 4, 500, 6, 7, 999, 9, 10, 11])
        let a = emeans(X, n, d, k, { nEpochs: 1, seed: 5, initRows: idx })
        let b = emeans(X, n, d, k, { nEpochs: 1, seed: 5 })
        let c = emeans(X, n, d, k, { nEpochs: 1, seed: 5, initRows: idx })
        assert.deepStrictEqual(Array.from(a.centroids), Array.from(c.centroids))
        assert.notDeepStrictEqual(Array.from(a.centroids), Array.from(b.centroids))
        //所用之初始中心即指定列之內容
        assert.deepStrictEqual(Array.from(a.init), Array.from(pickRows(X, d, idx)))
        assert.deepStrictEqual(Array.from(b.init), Array.from(pickRows(X, d, initRows(n, k, 5))))
        //initCentroids優先於initRows
        let own = new Float64Array(k * d).fill(0.5)
        let e = emeans(X, n, d, k, { nEpochs: 1, seed: 5, initRows: idx, initCentroids: own })
        assert.deepStrictEqual(Array.from(e.init), Array.from(own))
    })

    it('走訪次數小於1時僅部分列被走訪, 其餘標籤為-1; 走訪列數為四捨五入之n*T', function() {
        let { X, n, d } = ds
        let r = emeans(X, n, d, k, { nEpochs: 0.5, seed: 2 })
        let seen = 0
        for (let i = 0; i < n; i++) {
            if (r.labels[i] >= 0) {
                seen += 1
            }
        }
        assert.strictEqual(seen, 600)
        assert.strictEqual(r.stats.dist, 600 * k)
    })

    it('k=1: 收尾中心為全體平均', function() {
        let { X, n, d } = ds
        let r = emeans(X, n, d, 1, { nEpochs: 2, seed: 1 })
        let m = new Float64Array(d)
        for (let i = 0; i < n; i++) {
            for (let t = 0; t < d; t++) {
                m[t] += X[i * d + t] / n
            }
        }
        for (let t = 0; t < d; t++) {
            assert.ok(Math.abs(r.centroids[t] - m[t]) < 1e-9)
        }
    })

    it('邊界: n=1,k=1; n=k; d=1; 全部列相同; 結果皆為有限數且標籤有效', function() {
        let r1 = emeans(Float64Array.from([3, 4]), 1, 2, 1, { nEpochs: 3, seed: 1 })
        assert.deepStrictEqual(Array.from(r1.centroids), [3, 4])
        assert.deepStrictEqual(Array.from(r1.labels), [0])

        let X = Float64Array.from([1.5, 7.25, 3.125, 9.5, -2.75])
        let r2 = emeans(X, 5, 1, 5, { nEpochs: 2, seed: 1 })
        assert.ok(r2.centroids.every((v) => Number.isFinite(v)))
        assert.ok(r2.labels.every((l) => l >= 0 && l < 5))

        let same = new Float64Array(60).fill(2.5) //20列x3維皆相同
        let r3 = emeans(same, 20, 3, 4, { nEpochs: 3, seed: 1 })
        assert.ok(r3.centroids.every((v) => Number.isFinite(v)))
        assert.ok(r3.labels.every((l) => l >= 0 && l < 4))
    })

    it('輸入錯誤: X非Float64Array或長度不符、k不在1..n皆拋錯', function() {
        assert.throws(() => emeans([1, 2, 3], 3, 1, 1), /invalid X/)
        assert.throws(() => emeans(new Float64Array(5), 3, 2, 1), /invalid X/)
        assert.throws(() => emeans(new Float64Array(6), 3, 2, 0), /invalid k/)
        assert.throws(() => emeans(new Float64Array(6), 3, 2, 4), /invalid k/)
        assert.throws(() => emeans(new Float64Array(6), 3, 2, 1.5), /invalid k/)
    })

    it('空群復活(論文3.1節/附錄H): 遠離資料之初始中心於關閉復活時永遠死亡, 預設復活時被分裂復活而各群皆有成員', function() {
        //3個遠離之群(列i屬群i%3); 4個初始中心: 前3個各在一群內, 第4個遠在資料之外(必無點被指派)
        let b = makeBlobs(3, 200, 4, 10, 0.5, 77)
        let { X, n, d } = b
        let init = new Float64Array(4 * d)
        init.set(pickRows(X, d, Int32Array.from([0, 1, 2])), 0)
        init.fill(1000, 3 * d, 4 * d)
        let alive = (r) => new Set(Array.from(r.labels)).size
        for (let seed = 1; seed <= 5; seed++) {
            let off = emeans(X, n, d, 4, { nEpochs: 3, seed, initCentroids: init, unusedThreshold: 0 })
            assert.strictEqual(off.nSplits, 0)
            assert.strictEqual(alive(off), 3, `seed=${seed}`)
            assert.ok(off.centroids[3 * d] > 999, `seed=${seed}`) //死亡之群中心停在原處
            let on = emeans(X, n, d, 4, { nEpochs: 3, seed, initCentroids: init })
            assert.ok(on.nSplits >= 1, `seed=${seed}`)
            assert.strictEqual(alive(on), 4, `seed=${seed}`)
            assert.ok(Math.abs(on.centroids[3 * d]) < 100, `seed=${seed}`) //復活之群已移回資料範圍內
        }
    })

    it('群復活每5次更新檢查一次(論文演算法1第10列): 第4次更新後尚無分裂, 第5次更新後分裂', function() {
        let b = makeBlobs(3, 200, 4, 10, 0.5, 77)
        let { X, n, d } = b
        let init = new Float64Array(4 * d)
        init.set(pickRows(X, d, Int32Array.from([0, 1, 2])), 0)
        init.fill(1000, 3 * d, 4 * d)
        let run = (rows, seed) => emeans(X, n, d, 4, { nEpochs: rows / n, seed, initCentroids: init, batchSize: 10, alpha0: 0.5 })
        for (let seed = 1; seed <= 3; seed++) {
            let r4 = run(40, seed) //4次更新
            let r5 = run(50, seed) //5次更新
            assert.strictEqual(r4.recipe.totalSteps, 4)
            assert.strictEqual(r5.recipe.totalSteps, 5)
            assert.strictEqual(r4.nSplits, 0)
            assert.strictEqual(r5.nSplits, 1)
        }
    })

    it('誤差隨走訪次數下降: 另抽測試集之誤差均值(10個seed), T=2與T=3低於T=1(論文圖3: 誤差隨epoch數下降, 1~3個走訪即大幅降低)', function() {
        let train = makeBlobs(12, 120, 8, 1.5, 1, 61, 62)
        let test = makeBlobs(12, 60, 8, 1.5, 1, 61, 63) //同一組群心、另抽之點
        let { X, n, d } = train
        let errs = {}
        for (let T of [1, 2, 3]) {
            let es = []
            for (let seed = 1; seed <= 10; seed++) {
                let r = emeans(X, n, d, 12, { nEpochs: T, seed })
                es.push(mseOf(test.X, test.n, d, 12, r.centroids))
            }
            errs[T] = mean(es)
        }
        assert.ok(errs[2] < errs[1] * 0.99, JSON.stringify(errs))
        assert.ok(errs[3] < errs[1] * 0.99, JSON.stringify(errs))
    })

})


describe('Lloyd對照組A(與e-means共用核心、初始化與復活函數)', function() {

    let ds = makeBlobs(10, 150, 6, 2.5, 1, 91) //n=1500, d=6
    let k = 10

    it('lloyd 之訓練誤差軌跡不增(精確更新, 無空群時單調), 走訪次數與距離計算次數為 nIter 與 nIter*n*k', function() {
        let { X, n, d } = ds
        let r = lloyd(X, n, d, k, { nIter: 12, seed: 3 })
        assert.strictEqual(r.objs.length, 12)
        for (let i = 1; i < 12; i++) {
            assert.ok(r.objs[i] <= r.objs[i - 1] * (1 + 1e-12), `i=${i}`)
        }
        assert.strictEqual(r.stats.dist, 12 * n * k)
        assert.ok(r.cpu[11] >= r.cpu[0] && r.wall[11] >= r.wall[0])
    })

    it('lloyd 與同初始中心之ml-kmeans(現行套件後端)收斂結果一致(中心逐值相同)', function() {
        let { X, rows, n, d } = ds
        let idx = initRows(n, k, 17)
        let C0 = pickRows(X, d, idx)
        let r = lloyd(X, n, d, k, { nIter: 200, seed: 17, initCentroids: C0 })
        let init = []
        for (let j = 0; j < k; j++) {
            init.push(rows[idx[j]].slice())
        }
        let m = kmeans(rows, k, { initialization: init, maxIterations: 200, tolerance: 0 })
        assert.ok(m.converged)
        for (let j = 0; j < k; j++) {
            for (let t = 0; t < d; t++) {
                assert.ok(Math.abs(r.centroids[j * d + t] - m.centroids[j][t]) < 1e-9, `j=${j} t=${t}`)
            }
        }
    })

    it('lloyd 之snapshots保存指定更新次數之中心, 第t次指派之軌跡objs[t]為snapshots[t]之精確訓練誤差和', function() {
        let { X, n, d } = ds
        let r = lloyd(X, n, d, k, { nIter: 6, seed: 2, snapshots: [1, 3] })
        assert.deepStrictEqual(Array.from(r.snapshots.keys()), [1, 3])
        let s = n * mseOf(X, n, d, k, r.snapshots.get(3))
        assert.ok(Math.abs(s - r.objs[3]) <= 1e-9 * s)
    })

    it('lloyd 以initCentroids起算時, 第0次指派所用中心即該初始中心(與e-means以同initRows起算之初始中心一致, 只差演算法)', function() {
        let { X, n, d } = ds
        let idx = initRows(n, k, 8)
        let C0 = pickRows(X, d, idx)
        let l = lloyd(X, n, d, k, { nIter: 1, seed: 8, initCentroids: C0 })
        //objs[0]為C0之精確誤差和
        assert.ok(Math.abs(l.objs[0] - n * mseOf(X, n, d, k, C0)) <= 1e-9 * l.objs[0])
    })

    it('lloyd 之空群以分裂捐贈群復活(Faiss作法): 遠離資料之初始中心不致永遠死亡', function() {
        let b = makeBlobs(3, 200, 4, 10, 0.5, 77)
        let { X, n, d } = b
        let init = new Float64Array(4 * d)
        init.set(pickRows(X, d, Int32Array.from([0, 1, 2])), 0)
        init.fill(1000, 3 * d, 4 * d)
        let r = lloyd(X, n, d, 4, { nIter: 10, seed: 1, initCentroids: init })
        assert.ok(r.nSplits >= 1)
        assert.ok(Math.abs(r.centroids[3 * d]) < 100)
    })

    it('initKMeansPP 回傳取自資料之k個中心, 距離計算次數為 n + (k-1)*n*(2+floor(ln k))', function() {
        let { X, n, d } = ds
        let stats = newStats()
        let C = initKMeansPP(X, n, d, k, 5, stats)
        assert.strictEqual(C.length, k * d)
        let rowsSet = new Set()
        for (let j = 0; j < k; j++) {
            let found = -1
            for (let i = 0; i < n && found < 0; i++) {
                let same = true
                for (let t = 0; t < d; t++) {
                    if (X[i * d + t] !== C[j * d + t]) {
                        same = false
                        break
                    }
                }
                if (same) {
                    found = i
                }
            }
            assert.ok(found >= 0, `center ${j} is not a data row`)
            rowsSet.add(found)
        }
        assert.strictEqual(rowsSet.size, k)
        assert.strictEqual(stats.dist, n + (k - 1) * n * (2 + Math.floor(Math.log(k))))
    })

    it('品質下限: e-means(5個走訪)之訓練誤差不高於Lloyd 25次走訪之1.05倍(5個seed均值, 同資料同初始中心)', function() {
        let { X, n, d } = ds
        let es = []
        let ls = []
        for (let seed = 1; seed <= 5; seed++) {
            let idx = initRows(n, k, seed)
            let C0 = pickRows(X, d, idx)
            let l = lloyd(X, n, d, k, { nIter: 25, seed, initCentroids: C0 })
            ls.push(mseOf(X, n, d, k, l.centroids))
            let e = emeans(X, n, d, k, { nEpochs: 5, seed, initRows: idx })
            es.push(mseOf(X, n, d, k, e.centroids))
        }
        assert.ok(mean(es) <= mean(ls) * 1.05, `emeans=${mean(es)} lloyd=${mean(ls)}`)
    })

    it('品質下限(無群結構之高斯資料): e-means(5個走訪)不高於Lloyd 25次走訪之1.05倍', function() {
        let g = makeGaussFn(5)
        let n = 2000
        let d = 6
        let X = new Float64Array(n * d)
        for (let i = 0; i < X.length; i++) {
            X[i] = g()
        }
        let es = []
        let ls = []
        for (let seed = 1; seed <= 5; seed++) {
            let idx = initRows(n, 16, seed)
            let C0 = pickRows(X, d, idx)
            let l = lloyd(X, n, d, 16, { nIter: 25, seed, initCentroids: C0 })
            ls.push(mseOf(X, n, d, 16, l.centroids))
            let e = emeans(X, n, d, 16, { nEpochs: 5, seed, initRows: idx })
            es.push(mseOf(X, n, d, 16, e.centroids))
        }
        assert.ok(mean(es) <= mean(ls) * 1.05, `emeans=${mean(es)} lloyd=${mean(ls)}`)
    })

})


describe('WCluster.cluster mode=e-means(API)', function() {

    let b = makeBlobs(4, 25, 3, 8, 0.5, 5) //n=100, d=3
    let opt = { mode: 'e-means', kNumber: 4, usePCA: false, seed: 11 }

    it('回傳形狀同k-means: { keys, ginds, gmat, gltdt }, ginds為互斥且涵蓋全部列之非空群, 群內index遞增', async function() {
        let r = await WCluster.cluster(b.rows, opt)
        assert.deepStrictEqual(Object.keys(r), ['keys', 'ginds', 'gmat', 'gltdt'])
        assert.strictEqual(r.keys, null)
        let flat = r.ginds.flat().sort((x, y) => x - y)
        assert.deepStrictEqual(flat, Array.from({ length: 100 }, (v, i) => i))
        assert.ok(r.ginds.length >= 1 && r.ginds.length <= 4)
        for (let g of r.ginds) {
            assert.ok(g.length > 0)
            for (let i = 1; i < g.length; i++) {
                assert.ok(g[i] > g[i - 1])
            }
        }
        //gmat、gltdt與ginds逐項對應(usePCA為false時gmat即原始數據)
        assert.deepStrictEqual(r.gmat, r.ginds.map((g) => g.map((i) => b.rows[i])))
        assert.deepStrictEqual(r.gltdt, r.ginds.map((g) => g.map((i) => b.rows[i])))
    })

    it('4個遠離之群(每群100點, 5個走訪): 10個seed中至少7個得到完全分開之分群(隨機初始化可能落入局部極小, 與Lloyd同)', async function() {
        let big = makeBlobs(4, 100, 3, 8, 0.5, 5)
        let perfect = 0
        for (let seed = 1; seed <= 10; seed++) {
            let r = await WCluster.cluster(big.rows, { mode: 'e-means', kNumber: 4, usePCA: false, seed, nEpochs: 5 })
            let ok = r.ginds.length === 4 && r.ginds.every((g) => g.length === 100 && new Set(g.map((i) => i % 4)).size === 1)
            if (ok) {
                perfect += 1
            }
        }
        assert.ok(perfect >= 7, `perfect=${perfect}/10`)
    })

    it('seed給定時結果可重現; usePCA預設(true)時亦可重現且gmat為PCA降維後數據', async function() {
        let r1 = await WCluster.cluster(b.rows, opt)
        let r2 = await WCluster.cluster(b.rows, opt)
        assert.deepStrictEqual(r1, r2)
        let p1 = await WCluster.cluster(b.rows, { mode: 'e-means', kNumber: 4, nCompNIPALS: 2, seed: 11 })
        let p2 = await WCluster.cluster(b.rows, { mode: 'e-means', kNumber: 4, nCompNIPALS: 2, seed: 11 })
        assert.deepStrictEqual(p1, p2)
        assert.strictEqual(p1.gmat[0][0].length, 2)
    })

    it('未給seed時不報錯且涵蓋全部列', async function() {
        let r = await WCluster.cluster(b.rows, { mode: 'e-means', kNumber: 4, usePCA: false })
        assert.deepStrictEqual(r.ginds.flat().sort((x, y) => x - y), Array.from({ length: 100 }, (v, i) => i))
    })

    it('物件陣列(ltdt)輸入: keys為有效數值欄位, gltdt為原物件', async function() {
        let ltdt = b.rows.map((row, i) => ({ name: 'n' + i, a: row[0], b: row[1], c: row[2] }))
        let r = await WCluster.cluster(ltdt, { ...opt })
        assert.deepStrictEqual(r.keys, ['a', 'b', 'c'])
        assert.strictEqual(r.gltdt[0][0].name.startsWith('n'), true)
        assert.strictEqual(r.ginds.flat().length, 100)
    })

    it('nEpochs小於1時全部列仍有所屬群, 且未走訪之列被指派給最終中心中最近者', async function() {
        let r = await WCluster.cluster(b.rows, { ...opt, nEpochs: 0.3 })
        assert.deepStrictEqual(r.ginds.flat().sort((x, y) => x - y), Array.from({ length: 100 }, (v, i) => i))

        //以同參數直接呼叫emeans取得最終中心與被走訪之列(API對資料先置中, 平移不改變距離, 故以置中後之資料比對)
        let { X, n, d } = flattenMat(b.rows)
        centerColumns(X, n, d)
        let e = emeans(X, n, d, 4, { nEpochs: 0.3, seed: 11 })
        let visited = 0
        for (let i = 0; i < n; i++) {
            if (e.labels[i] >= 0) {
                visited += 1
            }
        }
        assert.strictEqual(visited, 30)
        //群編號 -> API輸出之群(依群編號排序之非空群): 以被走訪之成員之標籤對應
        let idOfGroup = r.ginds.map((g) => {
            let ids = new Set(g.filter((i) => e.labels[i] >= 0).map((i) => e.labels[i]))
            assert.strictEqual(ids.size, 1)
            return Array.from(ids)[0]
        })
        let cn = centroidNorms(e.centroids, 4, d, new Float64Array(4))
        let checked = 0
        r.ginds.forEach((g, gi) => {
            for (let i of g) {
                if (e.labels[i] < 0) {
                    let lab = new Int32Array(1)
                    assignNearest(X, d, Int32Array.from([i]), 1, e.centroids, 4, cn, lab, null, null)
                    assert.strictEqual(idOfGroup[gi], lab[0], `row ${i}`)
                    checked += 1
                }
            }
        })
        assert.strictEqual(checked, 70)
    })

    it('K3: kNumber非1..n之整數(含3.7、十六進位字串、數字包裝物件、BigInt)視為未給, 結果與kNumber為預設2完全相同; 資料僅1列時為1', async function() {
        let base = await WCluster.cluster(b.rows, { ...opt, kNumber: 2 })
        for (let bad of [0, -1, 1000, 'x', null, true, 3.7, '0x3', new Number(3), 3n, NaN, Infinity, '', ' ', [3], { a: 3 }]) {
            let r = await WCluster.cluster(b.rows, { ...opt, kNumber: bad })
            assert.deepStrictEqual(r, base, `kNumber=${inspect(bad)}`)
        }
        let one = await WCluster.cluster([[1, 2, 3]], { mode: 'e-means', usePCA: false, seed: 1 })
        assert.deepStrictEqual(one.ginds, [[0]])
    })

    it('K4: kNumber給有效整數或數字字串(含前後空白)時以轉換後之值使用', async function() {
        let r3 = await WCluster.cluster(b.rows, { ...opt, kNumber: 3 })
        for (let v of ['3', ' 3 ', '3.0']) {
            let r = await WCluster.cluster(b.rows, { ...opt, kNumber: v })
            assert.deepStrictEqual(r, r3, `kNumber=${inspect(v)}`)
        }
        assert.ok(r3.ginds.length <= 3)
        let r4 = await WCluster.cluster(b.rows, { ...opt, kNumber: 4 })
        assert.notDeepStrictEqual(r4, r3)
    })

    it('K3/V4: opt本身非一般物件(Date、包裝物件、類別實例、繼承自非Object.prototype之物件)時e-means專屬選項視為未給', async function() {
        let base = await WCluster.cluster(b.rows, { mode: 'e-means', kNumber: 4, usePCA: false, seed: 11 })
        class Opt {
            constructor() {
                this.mode = 'e-means'
                this.kNumber = 4
                this.usePCA = false
                this.seed = 11
                this.nEpochs = 1
                this.batchSize = 1
            }
        }
        let withProto = Object.create({ nEpochs: 1, batchSize: 1 })
        Object.assign(withProto, { mode: 'e-means', kNumber: 4, usePCA: false, seed: 11 })
        for (let o of [new Opt(), withProto, Object.assign(new Date(), { mode: 'e-means', kNumber: 4, usePCA: false, seed: 11, nEpochs: 1, batchSize: 1 })]) {
            let r = await WCluster.cluster(b.rows, o)
            assert.deepStrictEqual(r, base)
        }
        //對照: 一般物件給了同樣之鍵則生效(結果不同於預設)
        let plain = await WCluster.cluster(b.rows, { mode: 'e-means', kNumber: 4, usePCA: false, seed: 11, nEpochs: 1, batchSize: 1 })
        assert.notDeepStrictEqual(plain, base)
    })

    it('既有mode不讀取e-means專屬之opt鍵(含拋錯之getter), 行為不變', async function() {
        let mat = [[40, 50, 60], [50, 70, 60], [80, 70, 90], [50, 60, 80]]
        for (let mode of ['k-means', 'k-medoids']) {
            let o = { mode, kNumber: 2, usePCA: false, seed: 0 }
            for (let key of ['nEpochs', 'batchSize', 'alpha0', 'batchLaw', 'unusedThreshold']) {
                Object.defineProperty(o, key, {
                    enumerable: true,
                    get() {
                        throw new Error('getter read')
                    }
                })
            }
            let r = await WCluster.cluster(mat, o)
            assert.strictEqual(r.ginds.flat().length, 4, mode)
        }
    })

    it('資料偏移量遠大於分散度時結果不變(置中): 平移1e8之資料與原資料得到相同分群', async function() {
        //[0,1]兩點平移1e8後, 若直接以|c|^2-2x·c比較最近中心會因有效位數被抵銷而分不出
        let r0 = await WCluster.cluster([[0], [1]], { mode: 'e-means', kNumber: 2, usePCA: false, seed: 1 })
        let r1 = await WCluster.cluster([[100000000], [100000001]], { mode: 'e-means', kNumber: 2, usePCA: false, seed: 1 })
        assert.deepStrictEqual(r0.ginds, [[0], [1]])
        assert.deepStrictEqual(r1.ginds, [[0], [1]])

        //多維多群: 平移每維各異之大偏移
        let off = [1e8, -3e7, 5e6]
        let shifted = b.rows.map((row) => row.map((v, t) => v + off[t]))
        let a = await WCluster.cluster(b.rows, { mode: 'e-means', kNumber: 4, usePCA: false, seed: 11, nEpochs: 5 })
        let s = await WCluster.cluster(shifted, { mode: 'e-means', kNumber: 4, usePCA: false, seed: 11, nEpochs: 5 })
        assert.deepStrictEqual(s.ginds, a.ginds)
    })

    it('centerColumns 將各維減去平均值並回傳該平均值(就地)', function() {
        let X = Float64Array.from([1, 10, 3, 20, 5, 60])
        let mu = centerColumns(X, 3, 2)
        assert.deepStrictEqual(Array.from(mu), [3, 30])
        assert.deepStrictEqual(Array.from(X), [-2, -20, 0, -10, 2, 30])
    })

    it('K3: e-means之opt鍵非預期之輸入視為未給, 結果與不給該鍵相同', async function() {
        let base = await WCluster.cluster(b.rows, opt)
        for (let o of [{ nEpochs: 'abc' }, { nEpochs: -2 }, { batchSize: 0 }, { alpha0: 5 }, { batchLaw: 'zzz' }, { unusedThreshold: 'x' }]) {
            let r = await WCluster.cluster(b.rows, { ...opt, ...o })
            assert.deepStrictEqual(r, base, JSON.stringify(o))
        }
    })

    it('K4: 數字字串之數據轉換後使用, 結果與數值相同', async function() {
        let strRows = b.rows.map((row) => row.map((v) => ' ' + String(v) + ' '))
        let r1 = await WCluster.cluster(b.rows, opt)
        let r2 = await WCluster.cluster(strRows, opt)
        assert.deepStrictEqual(r2.ginds, r1.ginds)
    })

    it('V19/V20: 數據元素非有效數字時拒收, 訊息帶位置與期望種類且不帶輸入值', async function() {
        let cases = [
            { v: 'SECRET-123', msg: 'invalid data[1][2]: must be a valid number' },
            { v: null, msg: 'invalid data[1][2]: must be a valid number' },
            { v: undefined, msg: 'invalid data[1][2]: must be a valid number' },
            { v: true, msg: 'invalid data[1][2]: must be a valid number' },
            { v: NaN, msg: 'invalid data[1][2]: must be a valid number' },
            { v: Infinity, msg: 'invalid data[1][2]: must be a valid number' },
            { v: '-', msg: 'invalid data[1][2]: must be a valid number' },
            { v: 'NP', msg: 'invalid data[1][2]: must be a valid number' },
            { v: '', msg: 'invalid data[1][2]: must be a valid number' },
            { v: '0x10', msg: 'invalid data[1][2]: must be a valid number' },
            { v: {}, msg: 'invalid data[1][2]: must be a valid number' },
        ]
        for (let c of cases) {
            let rows = [[1.5, 2.5, 3.5], [4.5, 5.5, c.v], [6.5, 7.5, 8.5]]
            let err = null
            await WCluster.cluster(rows, { ...opt, kNumber: 2 }).catch((e) => {
                err = e
            })
            assert.ok(err instanceof Error, String(c.v))
            assert.strictEqual(err.message, c.msg, String(c.v))
            assert.ok(!err.message.includes('SECRET'))
        }
    })

    it('V19/V20: 列非陣列、列長度不等時拒收, 訊息帶列索引', async function() {
        let err = null
        //列長不等: 資料本身通過WClusterCore之同型別檢查(皆為陣列), 在e-means之攤平階段拒收
        await WCluster.cluster([[1, 2], [3, 4], [5]], { ...opt, kNumber: 2 }).catch((e) => {
            err = e
        })
        assert.strictEqual(err.message, 'invalid data[2]: must have the same length as data[0]')
        assert.throws(() => flattenMat([[1, 2], 'abc']), { message: 'invalid data[1]: must be an array' })
        assert.throws(() => flattenMat([]), { message: 'invalid data: must be a non-empty array' })
        assert.throws(() => flattenMat([[]]), { message: 'invalid data[0]: must be a non-empty array' })
        assert.throws(() => flattenMat('abc'), { message: 'invalid data: must be a non-empty array' })
    })

    it('既有之資料檢測訊息不變: 非有效陣列回傳"data is not eff. array"', async function() {
        for (let bad of [123, '123', true, null, undefined, [], {}]) {
            let err = null
            await WCluster.cluster(bad, opt).catch((e) => {
                err = e
            })
            assert.strictEqual(err.toString(), 'Error: data is not eff. array')
        }
    })

    it('flattenMat 限定元素絕對值不大於1e100(使平方與各群之和不溢位), 超過者拒收且不帶輸入值', function() {
        assert.strictEqual(MAX_ABS_VALUE, 1e100)
        let { X } = flattenMat([[1e100, -1e100], [0, 1]])
        assert.deepStrictEqual(Array.from(X), [1e100, -1e100, 0, 1])
        for (let v of [1.0000001e100, -1.0000001e100, 1e308, '1e200', -1.7976931348623157e308]) {
            assert.throws(() => flattenMat([[1, 2], [3, v]]), { message: 'invalid data[1][1]: must be a valid number with absolute value at most 1e100' })
        }
        //接近上限之資料可分群而不溢位
        let big = [[1e100, 0], [-1e100, 0], [1e100, 1e100], [-1e100, 1e100]]
        let { X: Y, n, d } = flattenMat(big)
        centerColumns(Y, n, d)
        assert.ok(Y.every((v) => Number.isFinite(v)))
        let r = emeans(Y, n, d, 2, { nEpochs: 2, seed: 1 })
        assert.ok(r.centroids.every((v) => Number.isFinite(v)))
    })

    it('flattenMat 先驗各列之形狀再配置記憶體: 超大之稀疏列得到固定訊息而非原生配置錯誤', function() {
        let huge = () => new Array(4294967295)
        assert.throws(() => flattenMat([huge(), huge()]), { message: 'invalid data: must be small enough to be processed in memory' })
        //列長不等時於配置前即拒收(不因data[0]之長度而配置)
        assert.throws(() => flattenMat([huge(), [1]]), { message: 'invalid data[1]: must have the same length as data[0]' })
    })

    it('flattenMat 回傳列優先之Float64Array並以轉換後之值填入(數字字串轉數值)', function() {
        let { X, n, d } = flattenMat([[1, '2.5'], [' 3 ', 4e-3]])
        assert.strictEqual(n, 2)
        assert.strictEqual(d, 2)
        assert.ok(X instanceof Float64Array)
        assert.deepStrictEqual(Array.from(X), [1, 2.5, 3, 0.004])
    })

})
