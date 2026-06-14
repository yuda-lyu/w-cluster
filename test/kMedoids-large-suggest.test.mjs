import assert from 'assert'
import WCluster from '../src/WCluster.mjs'


//確定性PRNG(mulberry32), 使測試資料可重現, 不依賴Math.random
function mulberry32(a) {
    return function() {
        a |= 0
        a = a + 0x6D2B79F5 | 0
        let t = Math.imul(a ^ a >>> 15, 1 | a)
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
        return ((t ^ t >>> 14) >>> 0) / 4294967296
    }
}

//產生G個分離良好的數值blob(交錯排列, 使各blob點散佈於資料序中), 回傳{data, truth}
function genBlobs(G, m, D, sep, jit, seed) {
    let rnd = mulberry32(seed)
    let centers = []
    for (let g = 0; g < G; g++) {
        centers.push(Array.from({ length: D }, (_, d) => g * sep + d * 3))
    }
    let data = []
    let truth = []
    for (let i = 0; i < m; i++) {
        for (let g = 0; g < G; g++) {
            data.push(centers[g].map((c) => c + (rnd() * 2 - 1) * jit))
            truth.push(g)
        }
    }
    return { data, truth }
}

//產生G個二元blob(Jaccard場景), 各blob一組base活躍位 + 小幅翻轉
function genBinaryBlobs(G, m, D, active, flips, seed) {
    let rnd = mulberry32(seed)
    let bases = []
    for (let g = 0; g < G; g++) {
        let base = new Array(D).fill(0)
        let s = new Set()
        while (s.size < active) {
            s.add(Math.floor(rnd() * D))
        }
        s.forEach((i) => { base[i] = 1 })
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

//Jaccard距離(0/1陣列)
let jaccard = (a, b) => {
    let inter = 0
    let uni = 0
    for (let i = 0; i < a.length; i++) {
        let x = a[i]
        let y = b[i]
        if (x & y) inter++
        if (x | y) uni++
    }
    return uni === 0 ? 0 : 1 - inter / uni
}

//cluster purity: 各分群以多數ground-truth標籤計, 全對則為1
function purity(ginds, truth) {
    let correct = 0
    let n = truth.length
    for (let g of ginds) {
        let cnt = {}
        for (let i of g) {
            cnt[truth[i]] = (cnt[truth[i]] || 0) + 1
        }
        correct += Math.max(...Object.values(cnt))
    }
    return correct / n
}

//flat是否恰好涵蓋0..n-1各一次(不漏不重)
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


describe(`k-medoids large suggest`, function() {

    this.timeout(60000)

    it(`should perfectly recover 6 well-separated numeric blobs (n=120, usePCA:false, fasterPAM)`, async function() {
        let G = 6
        let m = 20
        let n = G * m
        let { data, truth } = genBlobs(G, m, 4, 100, 5, 42)
        let r = await WCluster.cluster(data, { mode: 'k-medoids', kNumber: G, usePCA: false, useMethod: 'fasterPAM' })
        assert.strict.strictEqual(coversAll(r.ginds, n), true)
        assert.strict.strictEqual(r.ginds.length, G)
        assert.strict.strictEqual(purity(r.ginds, truth), 1)
    })

    it(`should perfectly recover 6 binary blobs with Jaccard distance (n=120, D=120, usePCA:false, fasterPAM)`, async function() {
        let G = 6
        let m = 20
        let n = G * m
        let { data, truth } = genBinaryBlobs(G, m, 120, 18, 3, 42)
        let r = await WCluster.cluster(data, { mode: 'k-medoids', kNumber: G, usePCA: false, funDist: jaccard, useMethod: 'fasterPAM' })
        assert.strict.strictEqual(coversAll(r.ginds, n), true)
        assert.strict.strictEqual(r.ginds.length, G)
        assert.strict.strictEqual(purity(r.ginds, truth), 1)
    })

    it(`should be deterministic on larger data (same ginds on repeated runs, fasterPAM)`, async function() {
        let G = 6
        let m = 20
        let { data } = genBlobs(G, m, 4, 100, 5, 42)
        let r1 = await WCluster.cluster(data, { mode: 'k-medoids', kNumber: G, usePCA: false, useMethod: 'fasterPAM' })
        let r2 = await WCluster.cluster(data, { mode: 'k-medoids', kNumber: G, usePCA: false, useMethod: 'fasterPAM' })
        assert.strict.deepStrictEqual(r1.ginds, r2.ginds)
    })

})
