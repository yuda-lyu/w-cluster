/**
 * e-means初始化比較評測: 隨機初始化(論文原作法)對貪婪k-means++初始化(單執行緒、僅用CPU)
 *
 * 用法: node --expose-gc toolg/evalEmeans/evalInit.mjs <設定名> [--seeds N] [--dataSeedOffset N]
 * 結果寫入 toolg/evalEmeans/results/init-<設定名>.json; 以 toolg/evalEmeans/evalReport.mjs 彙整於REPORT.md
 *
 * 比較之手臂(皆使用同一份資料、同一個最近中心計算核心, 同一組seed; 設定表見 ./evalConfigs.mjs):
 *   lloyd-random   : Lloyd k-means, 隨機初始化(initRows), 25次走訪(含初始列選取之耗時)
 *   lloyd-kpp      : Lloyd k-means, 貪婪k-means++初始化(初始化之距離計算與耗時計入), 25次走訪
 *   emeans-random  : e-means(論文作法: 不放回隨機取k列為初始中心), 走訪次數T取自T_INIT
 *   emeans-kpp     : e-means, 初始中心改由貪婪k-means++選取(與lloyd-kpp同一個函數與同一seed), 其餘步驟(批次律、步長律、EMA、復活、收尾)不變;
 *                    距離計算次數與耗時 = 初始化 + e-means本體(初始化每個seed只算一次, 其耗時與距離次數加到各T之手臂)
 *
 * 指標同evalRun.mjs: 訓練/測試集之精確MSE(每點平方距離平均)、距離計算次數、CPU時間(process.cpuUsage之user+system)與牆鐘時間; 評估之指派不計入
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import { makeDataset } from './evalData.mjs'
import { CONFIGS } from './evalConfigs.mjs'
import { emeans } from '../../src/WEmeans.mjs'
import { lloyd, initKMeansPP } from '../../src/WClusterLloyd.mjs'
import { newStats, centroidNorms, assignNearest } from '../../src/WClusterNearest.mjs'
import { initRows, pickRows } from '../../src/WClusterUtil.mjs'


const T_INIT = [1.4, 2.6, 5, 10] //5為預設; 10供「同CPU預算下, 把初始化之成本改拿去多走訪是否同樣有效」之比較
const LLOYD_ITERS = 25

//單趟成本低之設定增加seed數(較多seed才估得出局部解之比例與平均差之不確定度)
const INIT_SEEDS = {
    'gmm-sep-d16-k8': 24,
    'gmm-sep-d32-small': 24,
    'gmm-sep-d8-highnk': 16,
    'uniform-d2': 12,
    'uniform-d16': 12,
    'gmm-overlap-d32': 12,
    'stretched-d128': 8,
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


function runLloyd(ds, k, seed, init) {
    let { X, Xtest, n, d, nTest } = ds
    gc()
    let stats = newStats()
    let opt = { nIter: LLOYD_ITERS, seed, stats }
    let selW = 0
    let selC = 0
    if (init === 'kmeans++') {
        opt.init = 'kmeans++'
    }
    else {
        //隨機初始列選取之耗時一併計入(與e-means隨機初始化同)
        let w0 = performance.now()
        let c0 = process.cpuUsage()
        opt.initCentroids = pickRows(X, d, initRows(n, k, seed))
        selW = performance.now() - w0
        selC = cpuMs(c0)
    }
    let r = lloyd(X, n, d, k, opt)
    let C = r.centroids
    return {
        train: mseOf(X, n, d, k, C),
        test: mseOf(Xtest, nTest, d, k, C),
        dist: stats.dist,
        cpuMs: selC + r.initCpu + r.cpu[LLOYD_ITERS - 1],
        wallMs: selW + r.initWall + r.wall[LLOYD_ITERS - 1],
        initDist: init === 'kmeans++' ? stats.dist - LLOYD_ITERS * n * k : 0,
        initCpuMs: selC + r.initCpu,
        splits: r.nSplits,
    }
}


//貪婪k-means++初始化(每個seed算一次, 計時與距離次數另記)
function runKppInit(ds, k, seed) {
    let { X, n, d } = ds
    gc()
    let stats = newStats()
    let w0 = performance.now()
    let c0 = process.cpuUsage()
    let C = initKMeansPP(X, n, d, k, seed, stats)
    let wallMs = performance.now() - w0
    return { C, dist: stats.dist, cpuMs: cpuMs(c0), wallMs }
}


function runEmeans(ds, k, seed, T, kpp) {
    let { X, Xtest, n, d, nTest } = ds
    gc()
    let stats = newStats()
    let opt = { nEpochs: T, seed, stats }
    if (kpp) {
        opt.initCentroids = kpp.C
    }
    let w0 = performance.now()
    let c0 = process.cpuUsage()
    let r = emeans(X, n, d, k, opt)
    let wallMs = performance.now() - w0
    let cpu = cpuMs(c0)
    return {
        T,
        train: mseOf(X, n, d, k, r.centroids),
        test: mseOf(Xtest, nTest, d, k, r.centroids),
        dist: stats.dist + (kpp ? kpp.dist : 0),
        epochs: (stats.dist + (kpp ? kpp.dist : 0)) / (n * k),
        cpuMs: cpu + (kpp ? kpp.cpuMs : 0),
        wallMs: wallMs + (kpp ? kpp.wallMs : 0),
        initDist: kpp ? kpp.dist : 0,
        initCpuMs: kpp ? kpp.cpuMs : 0,
        splits: r.nSplits,
        steps: r.recipe.totalSteps,
    }
}


async function main() {
    let name = process.argv[2]
    let cfg = CONFIGS[name]
    if (!cfg) {
        console.log('usage: node --expose-gc toolg/evalEmeans/evalInit.mjs <config> [--seeds N] [--dataSeedOffset N]; configs: ' + Object.keys(CONFIGS).join(', '))
        process.exitCode = 2
        return
    }
    let si = process.argv.indexOf('--seeds')
    let nSeeds = si >= 0 ? Number(process.argv[si + 1]) : (INIT_SEEDS[name] || cfg.seeds)
    try {
        os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL)
    }
    catch (e) {
        //已由quiet-run降優先或無權限時略過
    }
    let di = process.argv.indexOf('--dataSeedOffset')
    let dOff = di >= 0 ? Number(process.argv[di + 1]) : 0
    let { kind, n, d, k } = cfg
    let dataSeed = cfg.dataSeed + dOff * 1000
    let outName = dOff === 0 ? name : `${name}@d${dOff}`
    let ds = makeDataset({ kind, n, d, k, dataSeed })
    console.log(`[init-${outName}] kind=${kind} n=${n} d=${d} k=${k} seeds=${nSeeds} start=${new Date().toISOString()}`)

    //暖機(JIT), 不計入結果
    lloyd(ds.X, n, d, k, { nIter: 2, seed: 999 })
    emeans(ds.X, n, d, k, { nEpochs: 1, seed: 999 })
    initKMeansPP(ds.X.subarray(0, 2000 * d), 2000, d, Math.min(k, 16), 999, newStats())

    let results = []
    for (let s = 0; s < nSeeds; s++) {
        let seed = s + 1
        let res = { seed, arms: {} }
        res.arms['lloyd-random'] = runLloyd(ds, k, seed, 'random')
        res.arms['lloyd-kpp'] = runLloyd(ds, k, seed, 'kmeans++')
        res.arms['emeans-random'] = T_INIT.map((T) => runEmeans(ds, k, seed, T, null))
        let kpp = runKppInit(ds, k, seed)
        res.arms['emeans-kpp'] = T_INIT.map((T) => runEmeans(ds, k, seed, T, kpp))
        results.push(res)
        let a = res.arms['emeans-random'].find((x) => x.T === 2.6)
        let b = res.arms['emeans-kpp'].find((x) => x.T === 2.6)
        console.log(`  seed=${seed} test: lloyd-rand ${res.arms['lloyd-random'].test.toFixed(5)} lloyd-kpp ${res.arms['lloyd-kpp'].test.toFixed(5)} | e-means2.6 rand ${a.test.toFixed(5)} (${a.cpuMs.toFixed(0)}ms) kpp ${b.test.toFixed(5)} (${b.cpuMs.toFixed(0)}ms) @${new Date().toISOString()}`)
    }

    let outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'results')
    fs.mkdirSync(outDir, { recursive: true })
    let fp = path.join(outDir, 'init-' + outName + '.json')
    fs.writeFileSync(fp, JSON.stringify({ name: outName, base: name, cfg: { kind, n, d, k, dataSeed, nTest: ds.nTest, nSeeds }, lloydIters: LLOYD_ITERS, tInit: T_INIT, node: process.version, cpuModel: os.cpus()[0].model, results }))
    console.log('written ' + path.resolve(fp))
}


main().catch((err) => {
    console.log(err)
    process.exitCode = 1
})
