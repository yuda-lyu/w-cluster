import assert from 'assert'
import WCluster from '../src/WCluster.mjs'
import { jaccardBitset, packBits, jaccardBits } from '../src/jaccardBitset.mjs'


//確定性PRNG(mulberry32), 使測試資料可重現
function mulberry32(a) {
    return function() {
        a |= 0
        a = a + 0x6D2B79F5 | 0
        let t = Math.imul(a ^ a >>> 15, 1 | a)
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
        return ((t ^ t >>> 14) >>> 0) / 4294967296
    }
}

//逐維Jaccard(0/1陣列), 作為對照基準
function jacNaive(a, b) {
    let inter = 0
    let uni = 0
    for (let k = 0; k < a.length; k++) {
        let x = a[k]
        let y = b[k]
        if (x & y) inter++
        if (x | y) uni++
    }
    return uni === 0 ? 0 : 1 - inter / uni
}

//產生G個分離良好的二元blob(交錯排列), 回傳{data, truth}
function genBinaryBlobs(G, m, D, active, flips, seed) {
    let rnd = mulberry32(seed)
    let bases = []
    for (let g = 0; g < G; g++) {
        let base = new Array(D).fill(0)
        let s = new Set()
        while (s.size < active) {
            s.add(Math.floor(rnd() * D))
        }
        s.forEach((i) => {
            base[i] = 1
        })
        bases.push(base)
    }
    let data = []
    let truth = []
    for (let i = 0; i < m; i++) {
        for (let g = 0; g < G; g++) {
            let v = bases[g].slice()
            for (let f = 0; f < flips; f++) {
                let p = Math.floor(rnd() * D)
                v[p] = v[p] ? 0 : 1
            }
            data.push(v)
            truth.push(g)
        }
    }
    return { data, truth }
}

//cluster purity(各分群以多數ground-truth標籤計, 全對為1)
function purity(ginds, truth) {
    let correct = 0
    for (let g of ginds) {
        let cnt = {}
        for (let i of g) {
            cnt[truth[i]] = (cnt[truth[i]] || 0) + 1
        }
        correct += Math.max(...Object.values(cnt))
    }
    return correct / truth.length
}

//flat是否恰好涵蓋0..n-1各一次
function coversAll(ginds, n) {
    let flat = ginds.flat().sort((a, b) => a - b)
    if (flat.length !== n) {
        return false
    }
    for (let i = 0; i < n; i++) {
        if (flat[i] !== i) {
            return false
        }
    }
    return true
}


describe(`jaccardBitset`, function() {

    this.timeout(60000)

    it(`jaccardBits 對已知小案例正確`, function() {
        //a=[1,1,0,0], b=[1,0,1,0] → 交集1, 聯集3 → 1-1/3
        assert.strict.strictEqual(jaccardBits(packBits([1, 1, 0, 0]), packBits([1, 0, 1, 0])), 1 - 1 / 3)
        //相同列 → 0
        assert.strict.strictEqual(jaccardBits(packBits([1, 0, 1]), packBits([1, 0, 1])), 0)
        //兩列全0(聯集0) → 視為相同 0
        assert.strict.strictEqual(jaccardBits(packBits([0, 0, 0]), packBits([0, 0, 0])), 0)
        //完全不相交 → 1
        assert.strict.strictEqual(jaccardBits(packBits([1, 0]), packBits([0, 1])), 1)
    })

    it(`jaccardBits 與逐維Jaccard對隨機二元向量數值一致(含D非32倍數)`, function() {
        let rnd = mulberry32(123)
        let allEqual = true
        for (let D of [16, 33, 50, 64, 100, 200]) {
            let rows = Array.from({ length: 12 }, () => Array.from({ length: D }, () => (rnd() < 0.3 ? 1 : 0)))
            for (let i = 0; i < rows.length; i++) {
                for (let j = i + 1; j < rows.length; j++) {
                    let a = jaccardBits(packBits(rows[i]), packBits(rows[j]))
                    let b = jacNaive(rows[i], rows[j])
                    if (Math.abs(a - b) > 1e-12) {
                        allEqual = false
                    }
                }
            }
        }
        assert.strict.strictEqual(allEqual, true)
    })

    it(`經 WCluster.cluster: helper(fasterPAM) ginds 與逐維版完全相同`, async function() {
        let { data: rows } = genBinaryBlobs(6, 40, 300, 45, 6, 42)
        let rNaive = await WCluster.cluster(rows, { mode: 'k-medoids', kNumber: 6, usePCA: false, funDist: jacNaive, useMethod: 'fasterPAM' })
        let { data, funDist } = jaccardBitset(rows)
        let rBits = await WCluster.cluster(data, { mode: 'k-medoids', kNumber: 6, usePCA: false, funDist, useMethod: 'fasterPAM' })
        assert.strict.deepStrictEqual(rBits.ginds, rNaive.ginds)
    })

    it(`helper 在分離良好的二元blob上 purity=1 且涵蓋全部 index`, async function() {
        let G = 6
        let m = 40
        let n = G * m
        let { data: rows, truth } = genBinaryBlobs(G, m, 300, 45, 6, 42)
        let { data, funDist } = jaccardBitset(rows)
        let r = await WCluster.cluster(data, { mode: 'k-medoids', kNumber: G, usePCA: false, funDist, useMethod: 'fasterPAM' })
        assert.strict.strictEqual(coversAll(r.ginds, n), true)
        assert.strict.strictEqual(purity(r.ginds, truth), 1)
    })

})
