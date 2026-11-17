/**
 * e-means評測之記憶體量測: 每個手臂各於獨立之子行程執行, 以process.resourceUsage().maxRSS(行程生命期之峰值常駐記憶體)與資料載入後之基準相比
 *
 * 用法: node --expose-gc toolg/evalEmeans/evalMemory.mjs [n d k]   (預設 n=50000 d=64 k=256, 資料為gmm-sep)
 * 結果印出markdown表, 並寫入 toolg/evalEmeans/results/memory.json
 *
 * 說明: maxRSS含V8堆積之回收延遲, 為估計值; 另列演算法自身配置之估算(以位元組計: Lloyd與e-means皆為k*d之倍數與n之倍數, 不含輸入資料)
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'
import { kmeans } from 'ml-kmeans'
import { makeDataset } from './evalData.mjs'
import { emeans } from '../../src/WEmeans.mjs'
import { lloyd } from '../../src/WClusterLloyd.mjs'
import { initRows, pickRows } from '../../src/WClusterUtil.mjs'


const here = fileURLToPath(import.meta.url)
const ARMS = ['baseline', 'lloyd-random', 'lloyd-kpp', 'emeans-T5', 'emeans-T25', 'ml-default', 'ml-same-init-25']


function child(arm, n, d, k) {
    try {
        os.setPriority(0, os.constants.priority.PRIORITY_BELOW_NORMAL)
    }
    catch (e) {
        //略過
    }
    let ds = makeDataset({ kind: 'gmm-sep', n, d, k, dataSeed: 101 })
    let rows = null
    if (arm.startsWith('ml-')) {
        rows = new Array(n)
        for (let i = 0; i < n; i++) {
            rows[i] = Array.from(ds.X.subarray(i * d, (i + 1) * d))
        }
    }
    global.gc()
    let base = process.memoryUsage().rss
    let basePeak = process.resourceUsage().maxRSS * 1024
    let w0 = performance.now()
    let c0 = process.cpuUsage()
    if (arm === 'lloyd-random') {
        lloyd(ds.X, n, d, k, { nIter: 25, seed: 1, initCentroids: pickRows(ds.X, d, initRows(n, k, 1)) })
    }
    else if (arm === 'lloyd-kpp') {
        lloyd(ds.X, n, d, k, { nIter: 25, seed: 1, init: 'kmeans++' })
    }
    else if (arm === 'emeans-T5') {
        emeans(ds.X, n, d, k, { nEpochs: 5, seed: 1 })
    }
    else if (arm === 'emeans-T25') {
        emeans(ds.X, n, d, k, { nEpochs: 25, seed: 1 })
    }
    else if (arm === 'ml-default') {
        kmeans(rows, k, { seed: 1 })
    }
    else if (arm === 'ml-same-init-25') {
        let init = []
        let idx = initRows(n, k, 1)
        for (let j = 0; j < k; j++) {
            init.push(rows[idx[j]].slice())
        }
        kmeans(rows, k, { initialization: init, maxIterations: 25, tolerance: 0 })
    }
    let cpu = process.cpuUsage(c0)
    console.log(JSON.stringify({ arm, baseRssMB: base / 1048576, basePeakMB: basePeak / 1048576, peakRssMB: process.resourceUsage().maxRSS / 1024, cpuMs: (cpu.user + cpu.system) / 1000, wallMs: performance.now() - w0 }))
}


function main() {
    let n = Number(process.argv[2] || 50000)
    let d = Number(process.argv[3] || 64)
    let k = Number(process.argv[4] || 256)
    if (process.argv[2] === '--child') {
        child(process.argv[3], Number(process.argv[4]), Number(process.argv[5]), Number(process.argv[6]))
        return
    }
    let out = []
    for (let arm of ARMS) {
        let r = spawnSync(process.execPath, ['--expose-gc', here, '--child', arm, String(n), String(d), String(k)], { encoding: 'utf8', windowsHide: true })
        let line = (r.stdout || '').trim().split('\n').pop()
        out.push(JSON.parse(line))
    }
    let dataMB = n * d * 8 / 1048576
    let lines = []
    lines.push(`n=${n}, d=${d}, k=${k}, 資料(Float64Array)${dataMB.toFixed(1)}MB; 每個手臂各於獨立行程執行`)
    lines.push('')
    lines.push('| 手臂 | 資料載入後RSS(MB) | 峰值RSS(MB) | 峰值-資料載入後RSS(MB) | CPU(ms) |')
    lines.push('|---|---|---|---|---|')
    for (let o of out) {
        lines.push(`| ${o.arm} | ${o.baseRssMB.toFixed(0)} | ${o.peakRssMB.toFixed(0)} | ${(o.peakRssMB - o.baseRssMB).toFixed(0)} | ${o.cpuMs.toFixed(0)} |`)
    }
    let kd = k * d * 8 / 1048576
    lines.push('')
    lines.push(`演算法自身配置之估算(不含輸入資料): Lloyd = 中心與和各${kd.toFixed(2)}MB + 標籤${(n * 4 / 1048576).toFixed(2)}MB; e-means = 中心、批次和、收尾和各${kd.toFixed(2)}MB + 標籤與洗牌各${(n * 4 / 1048576).toFixed(2)}MB + 批次標籤(批次大小*4位元組); 兩者同一量級.`)
    console.log(lines.join('\n'))
    let dir = path.join(path.dirname(here), 'results')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'memory.json'), JSON.stringify({ n, d, k, out, table: lines.join('\n') }))
}


main()
