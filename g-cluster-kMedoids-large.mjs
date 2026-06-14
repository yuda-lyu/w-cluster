import WCluster from './src/WCluster.mjs'


//針對「較大的二元向量數據」以 k-medoids(fasterPAM 後端=矩陣式FasterPAM) + 逐維 Jaccard 分群, 記錄耗時。
//  作為 g-cluster-kMedoids-large-suggest.mjs(同 fasterPAM 後端, 但距離改用 bitset) 的對照基準:
//  兩支差別只在距離函數(逐維 vs 位元打包), 後端相同, 故可直接看出 bitset 對建矩陣的加速。


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

//Jaccard距離(0/1陣列, 逐維)
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


async function testClusterLarge() {

    let G = 20 //群數
    let m = 200 //每群點數
    let D = 1000 //向量維度(bit數)
    let n = G * m

    let { data, truth } = genBinaryBlobs(G, m, D, Math.floor(D * 0.15), 3, 42)
    console.log(`資料: n=${n}, 維度D=${D}, 群數G=${G} (二元向量, Jaccard)`)

    //fasterPAM 後端(FasterPAM) + 逐維 Jaccard
    let t0 = performance.now()
    let r = await WCluster.cluster(data, { mode: 'k-medoids', kNumber: G, usePCA: false, funDist: jaccard, useMethod: 'fasterPAM' })
    let dt = performance.now() - t0

    console.log(`[fasterPAM 後端 + 逐維 Jaccard]`)
    console.log(`  耗時: ${dt.toFixed(0)} ms, 分群數: ${r.ginds.length}, 涵蓋: ${r.ginds.flat().length}/${n}, purity: ${purity(r.ginds, truth).toFixed(3)}`)
    // => 耗時為機器相關; 此為對照基準, 與 -suggest(同後端, bitset距離) 相比可見建矩陣加速, 分群結果應完全相同

}
testClusterLarge()
    .catch((err) => {
        console.log(err)
    })

//node g-cluster-kMedoids-large.mjs
