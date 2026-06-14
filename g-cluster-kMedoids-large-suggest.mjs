import WCluster from './src/WCluster.mjs'
import { jaccardBitset } from './src/jaccardBitset.mjs'


//與 g-cluster-kMedoids-large.mjs 同資料、同 fasterPAM 後端(矩陣式FasterPAM), 唯一差別:
//  距離函數改用 bitset+popcount 版(jaccardBitset helper) 取代逐維 Jaccard。
//  fasterPAM 後端下「建距離矩陣」為主成本, bitset 把 D 個位元打包成 ceil(D/32) 個 word、
//  以 popcount 一次算 32 維 → 建矩陣加速 ~一個數量級(高維 14–23x), 直接反映在總時間;
//  分群結果(ginds/purity)與逐維版完全相同。


//確定性PRNG(mulberry32), 使資料可重現
function mulberry32(a) {
    return function() {
        a |= 0
        a = a + 0x6D2B79F5 | 0
        let t = Math.imul(a ^ a >>> 15, 1 | a)
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
        return ((t ^ t >>> 14) >>> 0) / 4294967296
    }
}

//產生G個二元blob(交錯排列), 各blob一組base活躍位 + 小幅翻轉, 回傳{data, truth}
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


async function testClusterLargeSuggest() {

    let G = 20 //群數
    let m = 200 //每群點數
    let D = 1000 //向量維度(bit數)
    let n = G * m

    let { data: rows, truth } = genBinaryBlobs(G, m, D, Math.floor(D * 0.15), 3, 42)
    console.log(`資料: n=${n}, 維度D=${D}, 群數G=${G} (二元向量, Jaccard)`)

    //bitset 打包 + fasterPAM 後端(計時含打包與建矩陣, 才是公平的端到端比較)
    let t0 = performance.now()
    let { data, funDist } = jaccardBitset(rows)
    let r = await WCluster.cluster(data, { mode: 'k-medoids', kNumber: G, usePCA: false, funDist, useMethod: 'fasterPAM' })
    let dt = performance.now() - t0

    console.log(`[fasterPAM 後端 + bitset Jaccard(jaccardBitset)]`)
    console.log(`  耗時: ${dt.toFixed(0)} ms, 分群數: ${r.ginds.length}, 涵蓋: ${r.ginds.flat().length}/${n}, purity: ${purity(r.ginds, truth).toFixed(3)}`)
    // => 相對 g-cluster-kMedoids-large.mjs(同後端, 逐維Jaccard)明顯更快(維度越高差距越大), ginds/purity 完全相同

}
testClusterLargeSuggest()
    .catch((err) => {
        console.log(err)
    })

//node g-cluster-kMedoids-large-suggest.mjs
