/* eslint-disable quotes */
// e-means之變異證明(配套工具, 非測試檔): 於 test/_tmp/mut-eMeans/<id>/ 複製 src 與測試檔, 套用單點變異後以mocha執行, 預期失敗(變異被殺)
// 用法(於套件根目錄): node test/tools/mutate-eMeans.mjs [變異id前綴]; 結果印出並寫入 test/_tmp/mut-eMeans/result.tsv
// 變異點為源碼之逐字片段, 源碼改動致片段不再唯一時該項顯示SKIP, 須同步更新本表
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'

const root = path.resolve('.')
const outRoot = path.join(root, 'test', '_tmp', 'mut-eMeans')
const testFiles = ['unit-eMeans.test.mjs']

const M = [
    ['M01-revival-disabled', 'WEmeans.mjs', '&& tau > 0) {', '&& tau > 1e9) {'],
    ['M02-cosine-removed', 'WEmeans.mjs', 'return alpha0 * (ALPHA_MIN_FACTOR + (1 - ALPHA_MIN_FACTOR) * cosine)', 'return alpha0'],
    ['M03-finalize-removed', 'WEmeans.mjs', 'C[o + t] = passSums[o + t] / passCounts[j]', 'C[o + t] = C[o + t]'],
    ['M04-ema-weight', 'WEmeans.mjs', 'let weight = alpha * nj / mass', 'let weight = alpha'],
    ['M05-ema-no-decay', 'WEmeans.mjs', 'usage[j] *= decay', 'usage[j] *= 1'],
    ['M06-batchlaw-exponent', 'WEmeans.mjs', 'quality: [0.00439175, 0.134749, 0.876473, 0.813344]', 'quality: [0.00439175, 0.134749, 0.87, 0.813344]'],
    ['M07-steplaw-coef', 'WEmeans.mjs', 'const ALPHA_LAW = [0.8244, -0.4617, 0.9003, -0.4498, -0.1057]', 'const ALPHA_LAW = [0.8244, -0.46, 0.9003, -0.4498, -0.1057]'],
    ['M08-epochrows-remainder', 'WEmeans.mjs', 'if (remainder > 0) {', 'if (remainder > 1e18) {'],
    ['M09-no-revival-max-d', 'WEmeans.mjs', 'const NO_REVIVAL_MAX_D = 2', 'const NO_REVIVAL_MAX_D = 1'],
    ['M10-auto-quality-max-d', 'WEmeans.mjs', 'const AUTO_QUALITY_MAX_D = 16', 'const AUTO_QUALITY_MAX_D = 8'],
    ['M11-nearest-tie', 'WClusterNearest.mjs', 'if (v1 < bestv) {', 'if (v1 <= bestv) {'],
    ['M11b-nearest-tie-v2', 'WClusterNearest.mjs', 'if (v2 < bestv) {', 'if (v2 <= bestv) {'],
    ['M11c-nearest-tie-v3', 'WClusterNearest.mjs', 'if (v3 < bestv) {', 'if (v3 <= bestv) {'],
    ['M11d-nearest-tie-tail', 'WClusterNearest.mjs', 'if (v < bestv) {', 'if (v <= bestv) {'],
    ['M12-accumulate-dim', 'WClusterNearest.mjs', 'sums[so + t] += X[xo + t]', 'sums[so + t] += X[xo]'],
    ['M13-dist-count', 'WClusterNearest.mjs', 'stats.dist += nRows * k', 'stats.dist += nRows'],
    ['M14-split-sign', 'WClusterUtil.mjs', 'let off = (t % 2 === 0 ? 1 : -1) * eps', 'let off = eps'],
    ['M15-split-half', 'WClusterUtil.mjs', 'let half = usage[s] / 2', 'let half = usage[s]'],
    ['M16-split-collapsed', 'WClusterUtil.mjs', 'if (collapsed) {', 'if (false) {'],
    ['M17-flatten-validate', 'WClusterUtil.mjs', 'if (!isenum(v)) {', 'if (false) {'],
    ['M18-flatten-convert', 'WClusterUtil.mjs', 'let x = Number(v)', "let x = typeof v === 'string' ? 0 : v"],
    ['M19-mode-whitelist', 'WClusterMat.mjs', "mode !== 'k-means' && mode !== 'e-means') {", "mode !== 'k-means') {"],
    ['M20-kNumber-default', 'WClusterMat.mjs', 'iseint(kRaw, { min: 1, max: n })', 'isFinite(kRaw)'],
    ['M21-lloyd-mean', 'WClusterLloyd.mjs', 'C[o + t] = sums[o + t] / nj', 'C[o + t] = sums[o + t] / (nj + 1)'],
    ['M22-epoch-shuffle-seed', 'WEmeans.mjs', 'permutation(n, makeRng(epochSeed(seed, e)))', 'permutation(n, makeRng(Math.floor(Math.random() * 4294967296)))'],
    ['M23-last-labels', 'WEmeans.mjs', 'labels[rowsView[i]] = bLabel[i]', 'labels[i] = bLabel[i]'],
    ['M24-init-usage', 'WEmeans.mjs', 'const INIT_USAGE = 1e-10', 'const INIT_USAGE = 1'],
    ['M25-check-every', 'WEmeans.mjs', 'const CHECK_UNUSED_EVERY = 5', 'const CHECK_UNUSED_EVERY = 7'],
    ['M26-kpp-trials', 'WClusterLloyd.mjs', 'let nTrials = 2 + Math.floor(Math.log(k))', 'let nTrials = 2'],
    ['M27-flatten-rowlen', 'WClusterUtil.mjs', 'if (row.length !== d) {', 'if (false) {'],
    ['M28-opt-validate', 'WEmeans.mjs', 'return isenum(v, chk) ? Number(v) : def', 'return Number(v)'],
    ['M29-lloyd-split', 'WClusterLloyd.mjs', 'if (nEmpty > 0) {', 'if (false) {'],
    ['M31-default-k', 'WClusterMat.mjs', ': Math.min(2, n)', ': 1'],
    ['M32-unvisited-label', 'WClusterMat.mjs', 'labels[rows[i]] = lab[i]', 'labels[rows[i]] = 0'],
    ['M33-revival-every6', 'WEmeans.mjs', 'const CHECK_UNUSED_EVERY = 5', 'const CHECK_UNUSED_EVERY = 6'],
    ['M34-donor-weight', 'WClusterUtil.mjs', 'Math.log(weight[j]) - Math.log(-Math.log(u))', 'Math.log(Math.sqrt(weight[j])) - Math.log(-Math.log(u))'],
    ['M35-ignore-initrows', 'WEmeans.mjs', 'opt.initRows instanceof Int32Array && opt.initRows.length === k) ? opt.initRows : initRows(n, k, seed)', 'opt.initRows instanceof Int32Array && opt.initRows.length === k) ? initRows(n, k, seed + 1) : initRows(n, k, seed)'],
    ['M36-no-center', 'WClusterMat.mjs', '    centerColumns(X, n, d)', '    void 0'],
    ['M37-no-bound', 'WClusterUtil.mjs', 'if (x > MAX_ABS_VALUE || x < -MAX_ABS_VALUE) {', 'if (false) {'],
    ['M38-parseopt-plain', 'WEmeans.mjs', 'let o = isPlainObject(opt) ? opt : {}', "let o = (typeof opt === 'object' && opt !== null && !Array.isArray(opt)) ? opt : {}"],
    ['M39-core-mode-gate', 'WClusterCore.mjs', "if (mode === 'e-means' && isPlainObject(opt)) {", 'if (isPlainObject(opt)) {'],
    ['M40-kRaw', 'WClusterMat.mjs', "let kRaw = get(opt, 'kNumberRaw', undefined)", 'let kRaw = undefined'],
    ['M41-flatten-alloc-guard', 'WClusterUtil.mjs', "throw new Error('invalid data: must be small enough to be processed in memory')", "throw err"],
    ['M42-init-copy', 'WEmeans.mjs', 'let init = C.slice()', 'let init = new Float64Array(C.length)'],
    ['M30-seed-parse', 'WClusterMat.mjs', "seed = (seed !== null && seed !== undefined && iseint(seed)) ? Number(seed) : null", 'seed = null'],
]

fs.rmSync(outRoot, { recursive: true, force: true })
let only = process.argv[2]
let rows = []
for (let [id, file, find, rep] of M) {
    if (only && !id.startsWith(only)) {
        continue
    }
    let dir = path.join(outRoot, id)
    fs.mkdirSync(path.join(dir, 'test'), { recursive: true })
    fs.cpSync(path.join(root, 'src'), path.join(dir, 'src'), { recursive: true })
    for (let t of testFiles) {
        fs.copyFileSync(path.join(root, 'test', t), path.join(dir, 'test', t))
    }
    let fp = path.join(dir, 'src', file)
    let s = fs.readFileSync(fp, 'utf8')
    let cnt = s.split(find).length - 1
    if (cnt !== 1) {
        rows.push(`${id}\tSKIP(find count=${cnt})`)
        continue
    }
    fs.writeFileSync(fp, s.replace(find, () => rep))
    let r = spawnSync(process.execPath, [path.join(root, 'node_modules', 'mocha', 'bin', 'mocha.js'), ...testFiles.map((t) => path.join(dir, 'test', t)), '--no-parallel', '--timeout', '60000'], { cwd: dir, encoding: 'utf8', windowsHide: true })
    let out = (r.stdout || '') + (r.stderr || '')
    let pass = (out.match(/(\d+) passing/) || [0, '?'])[1]
    let fail = (out.match(/(\d+) failing/) || [0, '0'])[1]
    let names = []
    let re = /^\s+\d+\) (.+)$/gm
    let m
    while ((m = re.exec(out)) !== null) {
        names.push(m[1].trim())
    }
    rows.push(`${id}\t${r.status !== 0 ? 'KILLED' : 'SURVIVED'}\tfail=${fail}\tpass=${pass}\t${[...new Set(names)].slice(0, 3).join(' | ')}`)
}
console.log(rows.join('\n'))
fs.mkdirSync(outRoot, { recursive: true })
fs.writeFileSync(path.join(outRoot, 'result.tsv'), rows.join('\n') + '\n')
