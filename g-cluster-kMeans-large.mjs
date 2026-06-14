import WCluster from './src/WCluster.mjs'


//針對「較大的數值數據」以 k-means 分群, 並記錄耗時
//k-means以算術平均更新中心, 適用數值(歐氏)資料; 給定seed使結果可重現


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

//產生G個分離良好的數值blob(交錯排列), 回傳{data, truth}
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

    let G = 8      //群數
    let m = 125    //每群點數
    let D = 8      //向量維度
    let n = G * m
    let seed = 0   //k-means隨機初始化種子, 使結果可重現

    let { data, truth } = genBlobs(G, m, D, 100, 5, 42)
    console.log(`資料: n=${n}, 維度D=${D}, 群數G=${G} (數值向量, 歐氏)`)

    let t0 = performance.now()
    let r = await WCluster.cluster(data, { mode: 'k-means', kNumber: G, usePCA: false, seed })
    let dt = performance.now() - t0

    console.log(`耗時: ${dt.toFixed(0)} ms (k-means, seed=${seed})`)
    console.log(`分群數: ${r.ginds.length}, 涵蓋點數: ${r.ginds.flat().length}/${n}`)
    console.log(`purity: ${purity(r.ginds, truth).toFixed(3)} (1.000表示完全還原ground-truth)`)
    // => 耗時為機器相關; k-means複雜度O(n·k·iter), 遠快於k-medoids, 故n可放大。
    //    結構大致為:
    //    資料: n=1000, 維度D=8, 群數G=8 (數值向量, 歐氏)
    //    耗時: 數十~數百 ms (k-means, seed=0)
    //    分群數: 8, 涵蓋點數: 1000/1000
    //    purity: 1.000

}
testClusterLarge()
    .catch((err) => {
        console.log(err)
    })

//node g-cluster-kMeans-large.mjs
