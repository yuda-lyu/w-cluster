/**
 * e-means相對k-means之評測執行器(單執行緒、僅用CPU)
 *
 * 用法: node --expose-gc toolg/evalEmeans/evalRun.mjs <設定名> [--seeds N] [--dataSeedOffset N]
 * 結果寫入 toolg/evalEmeans/results/<設定名>.json; 以 toolg/evalEmeans/evalReport.mjs 彙整為報告
 *
 * 比較之手臂(皆使用同一份資料、同一組初始中心[隨機初始化]、同一個最近中心計算核心src/WClusterNearest.mjs, 只差演算法):
 *   lloyd-random : Lloyd k-means對照組A, 隨機初始化(與e-means同一組初始中心), 25次走訪, 逐次記錄軌跡
 *   lloyd-kpp    : Lloyd k-means對照組A, 貪婪k-means++初始化(初始化之距離計算與耗時計入), 25次走訪
 *   emeans       : e-means, 走訪次數T取自T_GRID, 批次大小與步長依論文縮放律(無任何調參)
 *   emeans-norev : e-means但不做群復活(unusedThreshold=0), 作消融
 *   ml-default   : 本庫現行k-means(ml-kmeans預設: 其k-means++初始化, 至多100次走訪, tolerance 1e-6), 對照組B
 *   ml-same-init : ml-kmeans以與e-means同一組初始中心, 至多25次走訪(tolerance 0, 中心完全不變即停, 故可少於25次), 對照組B
 *
 * 指標:
 *   誤差 = 每點平方距離之平均(MSE); 訓練集與另抽之測試集皆以「最終中心對全部點做精確最近中心指派」計(評估之指派不計入預算與耗時)
 *   距離計算次數 = 演算法本身之(點,中心)距離評估次數(不含評估), 與硬體無關; 走訪次數(epoch) = 距離計算次數/(n*k)
 *   CPU時間 = process.cpuUsage之user+system(單執行緒演算法, 含V8背景執行緒之少量開銷), 另記牆鐘時間
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import { kmeans } from 'ml-kmeans'
import { makeDataset } from './evalData.mjs'
import { emeans } from '../../src/WEmeans.mjs'
import { lloyd } from '../../src/WClusterLloyd.mjs'
import { newStats, centroidNorms, assignNearest } from '../../src/WClusterNearest.mjs'
import { initRows, pickRows } from '../../src/WClusterUtil.mjs'


const T_GRID = [1, 1.4, 2, 2.6, 3, 5, 10, 25]
const T_NOREV = [2.6, 5]
const LLOYD_ITERS = 25

//設定表: seeds為演算法seed(初始中心與洗牌), 資料固定於dataSeed
const CONFIGS = {
    'gmm-sep-d64': { kind: 'gmm-sep', n: 50000, d: 64, k: 256, dataSeed: 101, seeds: 5 },
    'gmm-overlap-d32': { kind: 'gmm-overlap', n: 50000, d: 32, k: 128, dataSeed: 102, seeds: 8 },
    'gmm-zipf-d64': { kind: 'gmm-zipf', n: 50000, d: 64, k: 256, dataSeed: 103, seeds: 5 },
    'uniform-d16': { kind: 'uniform', n: 50000, d: 16, k: 128, dataSeed: 104, seeds: 8 },
    'stretched-d128': { kind: 'stretched', n: 30000, d: 128, k: 128, dataSeed: 105, seeds: 5 },
    'gmm-sep-d8-highnk': { kind: 'gmm-sep', n: 100000, d: 8, k: 64, dataSeed: 106, seeds: 8 },
    'gmm-sep-d32-small': { kind: 'gmm-sep', n: 5000, d: 32, k: 64, dataSeed: 107, seeds: 8 },
    'uniform-d2': { kind: 'uniform', n: 100000, d: 2, k: 100, dataSeed: 108, seeds: 8 },
    'gmm-sep-d16-k8': { kind: 'gmm-sep', n: 20000, d: 16, k: 8, dataSeed: 111, seeds: 8 },
    'gmm-sep-d32-ml': { kind: 'gmm-sep', n: 20000, d: 32, k: 64, dataSeed: 109, seeds: 5, ml: true },
    'uniform-d16-ml': { kind: 'uniform', n: 20000, d: 16, k: 64, dataSeed: 110, seeds: 5, ml: true },
}


function cpuMs(c0) {
    let c = process.cpuUsage(c0)
    return (c.user + c.system) / 1000
}


function gc() {
    if (global.gc) {
        global.gc()
    }
}


//精確MSE: 對全部列做最近中心指派(不計入統計)
function mseOf(X, nn, d, k, C) {
    let cn = centroidNorms(C, k, d, new Float64Array(k))
    let lab = new Int32Array(nn)
    return assignNearest(X, d, null, nn, C, k, cn, lab, null, null) / nn
}


//以標籤對應之中心計之誤差(論文之codes誤差: 最後一個走訪各點被指派之群與收尾中心之距離)
function mseCodes(X, nn, d, C, labels) {
    let s = 0
    let m = 0
    for (let i = 0; i < nn; i++) {
        let l = labels[i]
        if (l < 0) {
            continue
        }
        let xo = i * d
        let co = l * d
        let dd = 0
        for (let t = 0; t < d; t++) {
            let df = X[xo + t] - C[co + t]
            dd += df * df
        }
        s += dd
        m += 1
    }
    return m > 0 ? s / m : NaN
}


function toRows(X, n, d) {
    let r = new Array(n)
    for (let i = 0; i < n; i++) {
        r[i] = Array.from(X.subarray(i * d, (i + 1) * d))
    }
    return r
}


function runLloydArm(ds, k, seed, init, initCentroids) {
    let { X, Xtest, n, d, nTest } = ds
    let stats = newStats()
    let snaps = []
    for (let t = 1; t <= LLOYD_ITERS; t++) {
        snaps.push(t)
    }
    gc()
    let opt = { nIter: LLOYD_ITERS, seed, snapshots: snaps, stats }
    if (init === 'kmeans++') {
        opt.init = 'kmeans++'
    }
    else {
        opt.initCentroids = initCentroids
    }
    let r = lloyd(X, n, d, k, opt)

    //軌跡(評估之指派在計時之外): t=0為初始中心, t=1..25為各次更新後之中心
    let C0 = init === 'kmeans++' ? null : initCentroids
    let traj = []
    let initDist = init === 'kmeans++' ? stats.dist - LLOYD_ITERS * n * k : 0
    for (let t = 0; t <= LLOYD_ITERS; t++) {
        let C = t === 0 ? C0 : r.snapshots.get(t)
        let trainMse
        if (t < LLOYD_ITERS) {
            trainMse = r.objs[t] / n //第t次指派所用中心即C_t
        }
        else {
            trainMse = mseOf(X, n, d, k, C)
        }
        let testMse = C === null ? null : mseOf(Xtest, nTest, d, k, C)
        traj.push({
            t,
            train: trainMse,
            test: testMse,
            dist: initDist + t * n * k,
            cpuMs: (t === 0 ? 0 : r.cpu[t - 1]) + r.initCpu,
            wallMs: (t === 0 ? 0 : r.wall[t - 1]) + r.initWall,
        })
    }
    return { traj, initCpuMs: r.initCpu, initWallMs: r.initWall, initDist, splits: r.nSplits }
}


function runEmeansArm(ds, k, seed, initIdx, T, extra) {
    let { X, Xtest, n, d, nTest } = ds
    gc()
    let stats = newStats()
    let w0 = performance.now()
    let c0 = process.cpuUsage()
    let r = emeans(X, n, d, k, Object.assign({ nEpochs: T, seed, initRows: initIdx, stats }, extra || {}))
    let wallMs = performance.now() - w0
    let cpu = cpuMs(c0)
    return {
        T,
        train: mseOf(X, n, d, k, r.centroids),
        test: mseOf(Xtest, nTest, d, k, r.centroids),
        trainCodes: mseCodes(X, n, d, r.centroids, r.labels),
        dist: stats.dist,
        epochs: stats.dist / (n * k),
        cpuMs: cpu,
        wallMs,
        batchSize: r.recipe.batchSize,
        alpha0: r.recipe.alpha0,
        batchLaw: r.recipe.batchLaw,
        splits: r.nSplits,
        steps: r.recipe.totalSteps,
    }
}


function runMlArm(ds, k, rows, opt, nSeedDist) {
    let { Xtest, n, d, nTest } = ds
    gc()
    let w0 = performance.now()
    let c0 = process.cpuUsage()
    let r = kmeans(rows, k, opt)
    let wallMs = performance.now() - w0
    let cpu = cpuMs(c0)
    let C = new Float64Array(k * d)
    for (let j = 0; j < k; j++) {
        for (let t = 0; t < d; t++) {
            C[j * d + t] = r.centroids[j][t]
        }
    }
    return {
        iterations: r.iterations,
        converged: r.converged,
        train: mseOf(ds.X, n, d, k, C),
        test: mseOf(Xtest, nTest, d, k, C),
        dist: r.iterations * n * k + nSeedDist, //指派之距離計算次數(每次走訪n*k) + 初始化之距離計算次數
        epochs: r.iterations, //走訪次數(不含初始化)
        cpuMs: cpu,
        wallMs,
    }
}


async function main() {
    let name = process.argv[2]
    let cfg = CONFIGS[name]
    if (!cfg) {
        console.log('usage: node --expose-gc toolg/evalEmeans/evalRun.mjs <config> [--seeds N]; configs: ' + Object.keys(CONFIGS).join(', '))
        process.exitCode = 2
        return
    }
    let si = process.argv.indexOf('--seeds')
    let nSeeds = si >= 0 ? Number(process.argv[si + 1]) : cfg.seeds
    try {
        os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL)
    }
    catch (e) {
        //已由quiet-run降優先或無權限時略過
    }
    //--dataSeedOffset N: 以另一組資料重複(資料seed加N*1000, 結果檔名加@dN), 用於估計資料抽樣之變異
    let di = process.argv.indexOf('--dataSeedOffset')
    let dOff = di >= 0 ? Number(process.argv[di + 1]) : 0
    let { kind, n, d, k } = cfg
    let dataSeed = cfg.dataSeed + dOff * 1000
    let outName = dOff === 0 ? name : `${name}@d${dOff}`
    let ds = makeDataset({ kind, n, d, k, dataSeed })
    console.log(`[${outName}] kind=${kind} n=${n} d=${d} k=${k} seeds=${nSeeds} start=${new Date().toISOString()}`)

    //暖機(JIT), 不計入結果
    lloyd(ds.X, n, d, k, { nIter: 2, seed: 999 })
    emeans(ds.X, n, d, k, { nEpochs: 1, seed: 999 })
    if (cfg.ml) {
        kmeans(toRows(ds.X.subarray(0, 2000 * d), 2000, d), Math.min(k, 8), { maxIterations: 2, seed: 1 })
    }

    let rowsAll = cfg.ml ? toRows(ds.X, n, d) : null
    let results = []
    for (let s = 0; s < nSeeds; s++) {
        let seed = s + 1
        let initIdx = initRows(n, k, seed)
        let initC = pickRows(ds.X, d, initIdx)
        let res = { seed, arms: {} }
        res.arms['lloyd-random'] = runLloydArm(ds, k, seed, 'random', initC)
        res.arms['lloyd-kpp'] = runLloydArm(ds, k, seed, 'kmeans++', null)
        res.arms['emeans'] = T_GRID.map((T) => runEmeansArm(ds, k, seed, initIdx, T))
        res.arms['emeans-norev'] = T_NOREV.map((T) => runEmeansArm(ds, k, seed, initIdx, T, { unusedThreshold: 0 }))
        if (cfg.ml) {
            //ml-kmeans預設之k-means++初始化(貪婪, localTrials=2+floor(ln k)): 首個中心n次, 其後每個中心localTrials*n次距離評估(node_modules/ml-kmeans/lib/initialization.js kmeanspp)
            let mlInitDist = n + (k - 1) * n * (2 + Math.floor(Math.log(k)))
            res.arms['ml-default'] = runMlArm(ds, k, rowsAll, { seed }, mlInitDist)
            let initRowsArr = []
            for (let j = 0; j < k; j++) {
                initRowsArr.push(Array.from(initC.subarray(j * d, (j + 1) * d)))
            }
            res.arms['ml-same-init'] = runMlArm(ds, k, rowsAll, { initialization: initRowsArr, maxIterations: LLOYD_ITERS, tolerance: 0 }, 0)
        }
        results.push(res)
        let l25 = res.arms['lloyd-random'].traj[LLOYD_ITERS]
        let e26 = res.arms['emeans'].find((a) => a.T === 2.6)
        console.log(`  seed=${seed} lloyd25 test=${l25.test.toFixed(5)} cpu=${l25.cpuMs.toFixed(0)}ms | e-means2.6 test=${e26.test.toFixed(5)} cpu=${e26.cpuMs.toFixed(0)}ms @${new Date().toISOString()}`)
    }

    let outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'results')
    fs.mkdirSync(outDir, { recursive: true })
    let fp = path.join(outDir, outName + '.json')
    fs.writeFileSync(fp, JSON.stringify({ name: outName, base: name, cfg: { kind, n, d, k, dataSeed, nTest: ds.nTest, nSeeds }, lloydIters: LLOYD_ITERS, tGrid: T_GRID, node: process.version, cpuModel: os.cpus()[0].model, results }))
    console.log('written ' + path.resolve(fp))
}


main().catch((err) => {
    console.log(err)
    process.exitCode = 1
})
