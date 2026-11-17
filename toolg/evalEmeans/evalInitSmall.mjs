/**
 * e-means初始化比較評測(小資料、多seed): 隨機初始化對貪婪k-means++初始化之局部解比例
 *
 * 用法: node toolg/evalEmeans/evalInitSmall.mjs [--seeds N]
 * 結果寫入 toolg/evalEmeans/results/init-small.json; 以 toolg/evalEmeans/evalReport.mjs 彙整於REPORT.md
 *
 * 資料集(皆明顯分群, 可由群大小或與真值之對應判定是否落入局部解):
 *   small-300x3-k3 : 300列3欄、3群明顯分離之資料(第i列: [g*10+(i%7)*0.1, g*-5+(i%11)*0.05, (i%13)*0.02+g], g=i%3), 走WCluster.cluster預設之PCA前處理(2主成分);
 *                    落入局部解之判定為群大小不是100/100/100
 *   gauss-500x5-k4 : 4個高斯(群心間距遠大於群內分散), 500列5維, 不做PCA; 局部解 = 分群與真值不同
 *   gauss-1000x8-k6: 6個高斯(群心間距約群內分散之3~4倍), 1000列8維, 不做PCA; 局部解 = 訓練誤差高於全部手臂全部seed之最小值1%(相對)以上
 *   gauss-2000x4-k10: 10個高斯(群有重疊, 真值劃分非最佳解), 2000列4維, 不做PCA; 局部解之判定同上
 *
 * 手臂: ml-kmeans(WCluster.cluster mode='k-means')、e-means隨機初始化與k-means++初始化(各T=2.6、5、25)、Lloyd@25(隨機/k-means++);
 * e-means之隨機初始化手臂與WCluster.cluster(mode='e-means')之結果逐seed核對(須逐一相同), 以證明此處之流程與API一致
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import WCluster from '../../src/WCluster.mjs'
import WPCAMat from '../../src/WPCAMat.mjs'
import { emeans } from '../../src/WEmeans.mjs'
import { lloyd, initKMeansPP } from '../../src/WClusterLloyd.mjs'
import { newStats, centroidNorms, assignNearest } from '../../src/WClusterNearest.mjs'
import { makeRng, initRows, pickRows, flattenMat, centerColumns } from '../../src/WClusterUtil.mjs'
import { makeGauss } from './evalData.mjs'


//「非最佳解」之判定: 訓練誤差高於全部手臂全部seed之最小值達此相對比例(1%)以上(e-means收尾不是Lloyd不動點, 誤差與最佳解有極小差距屬正常, 不算局部解)
const NOT_BEST_REL = 0.01


function makeSmall300() {
    let rows = []
    let truth = []
    for (let i = 0; i < 300; i++) {
        let g = i % 3
        rows.push([g * 10 + (i % 7) * 0.1, g * -5 + (i % 11) * 0.05, (i % 13) * 0.02 + g])
        truth.push(g)
    }
    return { rows, truth, k: 3, usePCA: true, name: 'small-300x3-k3', sizes: [100, 100, 100] }
}


//G個高斯: 群心各維~N(0, spread^2), 群內各維~N(0, 1), 各群等機率(每筆之各欄值皆由亂數產生而相異)
function makeGaussData(name, n, d, G, spread, dataSeed) {
    let rng = makeRng(dataSeed)
    let gauss = makeGauss(rng)
    let centers = []
    for (let g = 0; g < G; g++) {
        let c = []
        for (let t = 0; t < d; t++) {
            c.push(spread * gauss())
        }
        centers.push(c)
    }
    let rows = []
    let truth = []
    for (let i = 0; i < n; i++) {
        let g = rng.randInt(G)
        let r = []
        for (let t = 0; t < d; t++) {
            r.push(centers[g][t] + gauss())
        }
        rows.push(r)
        truth.push(g)
    }
    return { rows, truth, k: G, usePCA: false, name }
}


function sizesOf(labels, k) {
    let s = new Array(k).fill(0)
    for (let i = 0; i < labels.length; i++) {
        s[labels[i]] += 1
    }
    return s.sort((a, b) => b - a)
}


//分群與真值是否為同一個劃分(每個預測群只含單一真值群, 且預測群數等於真值群數)
function isTruthPartition(labels, truth, G) {
    let map = new Map()
    for (let i = 0; i < labels.length; i++) {
        let l = labels[i]
        if (!map.has(l)) {
            map.set(l, truth[i])
        }
        else if (map.get(l) !== truth[i]) {
            return false
        }
    }
    return map.size === G
}


function mseOf(X, n, d, k, C) {
    let cn = centroidNorms(C, k, d, new Float64Array(k))
    let lab = new Int32Array(n)
    return assignNearest(X, d, null, n, C, k, cn, lab, null, null) / n
}


//由WCluster.cluster回傳之ginds(各群所屬列索引)還原各列之群編號
function labelsFromGinds(ginds, n) {
    let labels = new Int32Array(n)
    for (let g = 0; g < ginds.length; g++) {
        for (let i of ginds[g]) {
            labels[i] = g
        }
    }
    return labels
}


//兩組標籤是否為同一個劃分(群編號可不同, 一對一對應)
function samePartition(a, b, n) {
    let ab = new Map()
    let ba = new Map()
    for (let i = 0; i < n; i++) {
        if (!ab.has(a[i])) {
            ab.set(a[i], b[i])
        }
        if (!ba.has(b[i])) {
            ba.set(b[i], a[i])
        }
        if (ab.get(a[i]) !== b[i] || ba.get(b[i]) !== a[i]) {
            return false
        }
    }
    return true
}


//以各群平均為中心之誤差(每點平方距離平均): 供只有標籤之手臂(ml-kmeans)計算
function mseFromLabels(X, n, d, k, labels) {
    let sums = new Float64Array(k * d)
    let cnt = new Float64Array(k)
    for (let i = 0; i < n; i++) {
        let l = labels[i]
        cnt[l] += 1
        for (let t = 0; t < d; t++) {
            sums[l * d + t] += X[i * d + t]
        }
    }
    let s = 0
    for (let i = 0; i < n; i++) {
        let l = labels[i]
        for (let t = 0; t < d; t++) {
            let df = X[i * d + t] - sums[l * d + t] / cnt[l]
            s += df * df
        }
    }
    return s / n
}


//由中心對全部列指派, 回傳標籤
function labelsOf(X, n, d, k, C) {
    let cn = centroidNorms(C, k, d, new Float64Array(k))
    let lab = new Int32Array(n)
    assignNearest(X, d, null, n, C, k, cn, lab, null, null)
    return lab
}


async function main() {
    let si = process.argv.indexOf('--seeds')
    let nSeeds = si >= 0 ? Number(process.argv[si + 1]) : 100
    let datasets = [
        Object.assign(makeSmall300(), { nSeeds: Math.max(nSeeds, 200) }),
        Object.assign(makeGaussData('gauss-500x5-k4', 500, 5, 4, 8, 11), { nSeeds }),
        Object.assign(makeGaussData('gauss-1000x8-k6', 1000, 8, 6, 3, 12), { nSeeds }),
        Object.assign(makeGaussData('gauss-2000x4-k10', 2000, 4, 10, 4, 13), { nSeeds }),
    ]
    let out = []
    for (let ds of datasets) {
        let { rows, truth, k, usePCA } = ds
        let pcad = usePCA ? WPCAMat(rows, { nCompNIPALS: 2 }) : rows
        let { X, n, d } = flattenMat(pcad)
        centerColumns(X, n, d)
        let arms = {}
        function rec(arm, seed, labels, C, mse, dist, extra) {
            if (!arms[arm]) {
                arms[arm] = { runs: [] }
            }
            arms[arm].runs.push(Object.assign({ seed, mse, dist, truthOk: isTruthPartition(labels, truth, k), sizes: sizesOf(labels, k) }, extra || {}))
        }
        let apiMismatch = 0
        for (let s = 0; s < ds.nSeeds; s++) {
            let seed = s + 1
            //ml-kmeans(WCluster.cluster mode='k-means')
            {
                let r = await WCluster.cluster(rows, { mode: 'k-means', kNumber: k, usePCA, nCompNIPALS: 2, seed })
                let labels = labelsFromGinds(r.ginds, rows.length)
                rec('k-means(ml-kmeans)', seed, labels, null, mseFromLabels(X, n, d, k, labels), null)
            }
            //Lloyd@25
            {
                let st = newStats()
                let r = lloyd(X, n, d, k, { nIter: 25, seed, initCentroids: pickRows(X, d, initRows(n, k, seed)), stats: st })
                rec('lloyd-random@25', seed, labelsOf(X, n, d, k, r.centroids), r.centroids, mseOf(X, n, d, k, r.centroids), st.dist)
                let st2 = newStats()
                let r2 = lloyd(X, n, d, k, { nIter: 25, seed, init: 'kmeans++', stats: st2 })
                rec('lloyd-kpp@25', seed, labelsOf(X, n, d, k, r2.centroids), r2.centroids, mseOf(X, n, d, k, r2.centroids), st2.dist)
            }
            //e-means
            let stI = newStats()
            let C0 = initKMeansPP(X, n, d, k, seed, stI)
            for (let T of [2.6, 5, 25]) {
                let st = newStats()
                let r = emeans(X, n, d, k, { nEpochs: T, seed, stats: st })
                rec(`e-means-random@T${T}`, seed, r.labels, r.centroids, mseOf(X, n, d, k, r.centroids), st.dist)
                let st2 = newStats()
                let r2 = emeans(X, n, d, k, { nEpochs: T, seed, stats: st2, initCentroids: C0 })
                rec(`e-means-kpp@T${T}`, seed, r2.labels, r2.centroids, mseOf(X, n, d, k, r2.centroids), st2.dist + stI.dist)
                if (T === 5) {
                    //與WCluster.cluster(mode='e-means', 預設nEpochs=5, 隨機初始化與init='k-means++')逐seed核對: 各列之劃分須相同
                    let api = await WCluster.cluster(rows, { mode: 'e-means', kNumber: k, usePCA, nCompNIPALS: 2, seed })
                    if (!samePartition(labelsFromGinds(api.ginds, rows.length), r.labels, n)) {
                        apiMismatch += 1
                    }
                    let apiK = await WCluster.cluster(rows, { mode: 'e-means', kNumber: k, usePCA, nCompNIPALS: 2, seed, init: 'k-means++' })
                    if (!samePartition(labelsFromGinds(apiK.ginds, rows.length), r2.labels, n)) {
                        apiMismatch += 1
                    }
                }
            }
        }
        //全部手臂全部seed之最小訓練誤差(e-means與Lloyd手臂): 供判定「非最佳解」
        let best = Infinity
        for (let a of Object.values(arms)) {
            for (let r of a.runs) {
                if (Number.isFinite(r.mse) && r.mse < best) {
                    best = r.mse
                }
            }
        }
        for (let a of Object.values(arms)) {
            for (let r of a.runs) {
                r.notBest = Number.isFinite(r.mse) ? r.mse > best * (1 + NOT_BEST_REL) : null
            }
        }
        out.push({ name: ds.name, n, d, k, usePCA, nSeeds: ds.nSeeds, bestMse: best, apiMismatch, arms })
        console.log(`[${ds.name}] seeds=${ds.nSeeds} bestMse=${best.toFixed(6)} apiMismatch=${apiMismatch}`)
        for (let [name, a] of Object.entries(arms)) {
            let bad = a.runs.filter((r) => ds.sizes ? JSON.stringify(r.sizes) !== JSON.stringify(ds.sizes) : !r.truthOk).length
            let nb = a.runs.filter((r) => r.notBest === true).length
            console.log(`  ${name.padEnd(22)} 非真值/非100x3: ${bad}/${a.runs.length}  非最佳解: ${nb}/${a.runs.length}`)
        }
    }
    let outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'results')
    fs.mkdirSync(outDir, { recursive: true })
    let fp = path.join(outDir, 'init-small.json')
    fs.writeFileSync(fp, JSON.stringify({ datasets: out, sizes300: [100, 100, 100] }))
    console.log('written ' + path.resolve(fp))
}


main().catch((err) => {
    console.log(err)
    process.exitCode = 1
})
