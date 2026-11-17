/**
 * 產生REPORT.md之「e-means初始化: 隨機 vs 貪婪k-means++」一節(由evalReport.mjs呼叫)
 *
 * 輸入: results/init-<設定名>.json(evalInit.mjs, 大資料)與results/init-small.json(evalInitSmall.mjs, 小資料多seed)
 * 判準(事先定): 見本節輸出之「判準」, 由本檔依數據逐項計算判定
 */
import fs from 'fs'
import path from 'path'


//判準中之門檻(事先定, 不依結果調整)
const COST_RATIO_MAX = 0.5 //「明顯低於Lloyd(隨機)@25」: 含初始化之距離計算次數與CPU時間皆不高於其0.5倍(預設T=5判定)
const SEP_KINDS = ['gmm-sep', 'gmm-zipf'] //判準1(品質)之資料種類
const FLAT_KINDS = ['uniform', 'gmm-overlap', 'stretched'] //判準2(不劣化)之資料種類


function mean(a) {
    return a.reduce((x, y) => x + y, 0) / a.length
}


function sd(a) {
    if (a.length < 2) {
        return 0
    }
    let m = mean(a)
    return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1))
}


function ms(a, f = 3) {
    return `${mean(a).toFixed(f)} ± ${sd(a).toFixed(f)}`
}


function fmtInt(x) {
    return Math.round(x).toLocaleString('en-US')
}


//合併標準差(兩組樣本標準差之均方根, 等樣本數)
function pooled(a, b) {
    return Math.sqrt((sd(a) * sd(a) + sd(b) * sd(b)) / 2)
}


//讀取init-*.json(大資料), 回傳依設定名索引之物件
function loadInit(resDir) {
    let files = {}
    for (let f of fs.readdirSync(resDir)) {
        if (f.startsWith('init-') && f.endsWith('.json') && f !== 'init-small.json') {
            let j = JSON.parse(fs.readFileSync(path.join(resDir, f), 'utf8'))
            files[j.name] = j
        }
    }
    return files
}


//單一設定、單一T之比較指標
function compareAt(j, T) {
    let R = j.results
    let get = (arm) => R.map((r) => r.arms[arm].find((x) => x.T === T))
    let er = get('emeans-random')
    let ek = get('emeans-kpp')
    let lr = R.map((r) => r.arms['lloyd-random'])
    let lk = R.map((r) => r.arms['lloyd-kpp'])
    let tr = er.map((x) => x.test)
    let tk = ek.map((x) => x.test)
    let diff = mean(tr) - mean(tk) //正值: k-means++較佳
    let pool = pooled(tr, tk)
    let wins = ek.filter((x, i) => x.test < er[i].test).length
    return {
        T,
        n: R.length,
        er,
        ek,
        lr,
        lk,
        meanR: mean(tr),
        meanK: mean(tk),
        sdR: sd(tr),
        sdK: sd(tk),
        diff,
        pool,
        ratio: pool > 0 ? diff / pool : (diff > 0 ? Infinity : 0),
        wins,
        distRatio: mean(ek.map((x) => x.dist)) / mean(lr.map((x) => x.dist)),
        cpuRatio: mean(ek.map((x) => x.cpuMs)) / mean(lr.map((x) => x.cpuMs)),
        cpuRatioKpp: mean(ek.map((x) => x.cpuMs)) / mean(lk.map((x) => x.cpuMs)),
        distRatioKpp: mean(ek.map((x) => x.dist)) / mean(lk.map((x) => x.dist)),
        cpuRatioRandom: mean(ek.map((x) => x.cpuMs)) / mean(er.map((x) => x.cpuMs)),
        initEpochs: mean(ek.map((x) => x.initDist)) / (j.cfg.n * j.cfg.k),
    }
}


/**
 * 產生報告節之文字列
 *
 * @param {String} resDir 輸入results資料夾
 * @param {Array} order 輸入[[設定名, 說明], ...]顯示順序
 * @returns {Array} 回傳文字列陣列(無資料時為空陣列)
 */
function buildInitSection(resDir, order) {
    let files = loadInit(resDir)
    let smallFp = path.join(resDir, 'init-small.json')
    let small = fs.existsSync(smallFp) ? JSON.parse(fs.readFileSync(smallFp, 'utf8')) : null
    if (Object.keys(files).length === 0 && !small) {
        return []
    }
    let out = []
    out.push('## e-means之初始化: 隨機(論文作法) vs 貪婪k-means++(評估是否添加 `init` 選項)')
    out.push('')
    out.push('判準(事先定, 三項須同時成立才算「有效果」): ')
    out.push('')
    out.push('1. 品質: 分離型混合資料(gmm-sep系、gmm-zipf)上, e-means(k-means++)之最終測試誤差顯著低於e-means(隨機)(各seed平均之差大於兩組標準差之合併值), 且小資料(>=50個seed)落入局部解之比例下降;')
    out.push('2. 不劣化: 無結構與重疊資料(uniform、gmm-overlap、stretched)上不比隨機初始化差(平均之差不大於合併標準差);')
    out.push(`3. 成本可接受: 含初始化之距離計算次數與CPU時間, 在預設T=5下皆不高於Lloyd(隨機)@25之${COST_RATIO_MAX}倍(「明顯低於」之操作定義); 另報與Lloyd(k-means++)@25之比.`)
    out.push('')
    out.push('做法: e-means(k-means++)以與Lloyd(k-means++)相同之函數與seed選出初始中心(貪婪k-means++, 每個新中心自2+floor(ln k)個依D^2抽取之候選取使總平方距離最小者), 其餘步驟(批次律、步長律、EMA、復活、收尾)不變; 初始化之距離計算次數與CPU/牆鐘時間皆計入, 初始化每個seed只算一次、其成本加到各T之手臂. e-means(隨機)之初始化(不放回取k列)耗時含在其本體內. 同一份資料、同一組seed.')
    out.push('')

    let names = order.map((o) => o[0]).filter((nm) => files[nm])
    for (let T of [5, 2.6]) {
        out.push(`### 大資料(合成, 單執行緒), T=${T}${T === 5 ? '(預設)' : '(論文建議)'}: 測試MSE(各seed平均 ± 樣本標準差)與成本`)
        out.push('')
        out.push('| 設定 | 種類 | n, d, k | seeds | Lloyd(隨機)@25 | Lloyd(k-means++)@25 | e-means(隨機) | e-means(k-means++) | 差(隨機-k-means++)/合併sd | k-means++較佳之seed數 | 初始化走訪數 | 距離次數比(e-kpp/L隨機@25) | CPU比(e-kpp/L隨機@25) | CPU比(e-kpp/L k-means++@25) | CPU比(e-kpp/e-隨機) |')
        out.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
        for (let nm of names) {
            let j = files[nm]
            let c = compareAt(j, T)
            let { kind, n, d, k } = j.cfg
            out.push(`| ${nm} | ${kind} | ${fmtInt(n)}, ${d}, ${k} | ${c.n} | ${ms(c.lr.map((x) => x.test), 4)} | ${ms(c.lk.map((x) => x.test), 4)} | ${ms(c.er.map((x) => x.test), 4)} | ${ms(c.ek.map((x) => x.test), 4)} | ${c.ratio === Infinity ? '∞' : c.ratio.toFixed(2)} | ${c.wins}/${c.n} | ${c.initEpochs.toFixed(2)} | ${c.distRatio.toFixed(2)} | ${c.cpuRatio.toFixed(2)} | ${c.cpuRatioKpp.toFixed(2)} | ${c.cpuRatioRandom.toFixed(1)} |`)
        }
        out.push('')
    }
    out.push('註: 「差/合併sd」>1 表示k-means++之平均誤差低於隨機初始化達一個合併標準差以上(判準1之門檻); CPU時間取自process.cpuUsage(解析度約15ms, 低於約100ms者誤差大).')
    out.push('')

    //同CPU預算: 初始化之成本若改拿去多走訪(隨機初始化T=10), 是否同樣有效
    let hasT10 = names.filter((nm) => files[nm].results[0].arms['emeans-random'].some((x) => x.T === 10))
    if (hasT10.length > 0) {
        out.push('### 大資料: 同CPU預算之比較(把k-means++初始化之成本改拿去多走訪, 即e-means(隨機)T=10, 是否同樣有效)')
        out.push('')
        out.push('| 設定 | e-means(隨機) T=5: CPU(ms), 測試MSE | e-means(隨機) T=10: CPU(ms), 測試MSE | e-means(隨機) T=25(取自evalRun.mjs之另次執行, 同資料, 與本評測共同之前N個seed): CPU(ms), 測試MSE | e-means(k-means++) T=1.4: CPU(ms), 測試MSE | e-means(k-means++) T=2.6: CPU(ms), 測試MSE | e-means(k-means++) T=5: CPU(ms), 測試MSE | Lloyd(k-means++)@25: CPU(ms), 測試MSE |')
        out.push('|---|---|---|---|---|---|---|---|')
        let cmp25 = []
        for (let nm of hasT10) {
            let j = files[nm]
            let R = j.results
            let cell = (arm, T) => {
                let a = R.map((r) => (T === null ? r.arms[arm] : r.arms[arm].find((x) => x.T === T)))
                return `${ms(a.map((x) => x.cpuMs), 0)}, ${ms(a.map((x) => x.test), 4)}`
            }
            //T=25之隨機初始化取自evalRun.mjs之結果(results/<設定名>.json, 其e-means手臂與本評測之隨機初始化同seed同初始列)
            let oldFp = path.join(resDir, nm + '.json')
            let t25 = '-'
            if (fs.existsSync(oldFp)) {
                //evalRun.mjs之seed數可少於本評測(seed依序為1,2,3,...): 此欄與比較註記只取兩者共同之前m個seed(逐seed對應, 同seed同初始列), 並於欄內註明seed數
                let aAll = JSON.parse(fs.readFileSync(oldFp, 'utf8')).results.map((r) => r.arms['emeans'].find((x) => x.T === 25))
                let m = Math.min(aAll.length, R.length)
                let a = aAll.slice(0, m)
                t25 = `${ms(a.map((x) => x.cpuMs), 0)}, ${ms(a.map((x) => x.test), 4)} [前${m}個seed]`
                let k14 = R.slice(0, m).map((r) => r.arms['emeans-kpp'].find((x) => x.T === 1.4))
                cmp25.push({ nm, m, cpuRatio: mean(a.map((x) => x.cpuMs)) / mean(k14.map((x) => x.cpuMs)), randWorse: mean(a.map((x) => x.test)) > mean(k14.map((x) => x.test)), relDiff: (mean(a.map((x) => x.test)) / mean(k14.map((x) => x.test)) - 1) * 100 })
            }
            out.push(`| ${nm} | ${cell('emeans-random', 5)} | ${cell('emeans-random', 10)} | ${t25} | ${cell('emeans-kpp', 1.4)} | ${cell('emeans-kpp', 2.6)} | ${cell('emeans-kpp', 5)} | ${cell('lloyd-kpp', null)} |`)
        }
        out.push('')
        if (cmp25.length > 0) {
            let worse = cmp25.filter((x) => x.randWorse)
            let better = cmp25.filter((x) => !x.randWorse)
            let relTxt = worse.length > 0 ? `(高${Math.min(...worse.map((x) => x.relDiff)).toFixed(1)}%~${Math.max(...worse.map((x) => x.relDiff)).toFixed(1)}%)` : ''
            out.push(`註: 隨機初始化之e-means以T=25(取自另次執行之evalRun.mjs, 與本評測逐seed對應, 只取兩者共同之前${Math.min(...cmp25.map((x) => x.m))}~${Math.max(...cmp25.map((x) => x.m))}個seed; 兩次執行之機器負載未必相同, CPU時間之比僅供參考)之CPU時間為k-means++之T=1.4之${Math.min(...cmp25.map((x) => x.cpuRatio)).toFixed(1)}~${Math.max(...cmp25.map((x) => x.cpuRatio)).toFixed(1)}倍, 其測試誤差仍高於k-means++之T=1.4者: ${worse.length}/${cmp25.length}組(${worse.map((x) => x.nm).join(', ')})${relTxt}${better.length > 0 ? `; 較低者: ${better.map((x) => x.nm).join(', ')}` : ''}; 即在前者(k-means++有益之群分離明顯資料)上, 初始化之成本無法以多走訪補回, 在後者(無結構、重疊, 或n/k很大)上多走訪反而較佳.`)
            out.push('')
        }
    }

    //小資料
    if (small) {
        out.push('### 小資料(多seed): 落入局部解之比例')
        out.push('')
        out.push('局部解之判定: 小資料300x3為「群大小不是100/100/100」(3群明顯分離, 資料與API前處理見 `evalInitSmall.mjs`); 高斯資料為「分群與真值不同」(gauss-500x5-k4)或「訓練誤差高於全部手臂全部seed之最小值1%以上」(其餘). e-means(隨機)之結果與 `WCluster.cluster(mode=\'e-means\')` 逐seed核對相同(核對不符之seed數見表末).')
        out.push('')
        let arms = ['k-means(ml-kmeans)', 'lloyd-random@25', 'lloyd-kpp@25', 'e-means-random@T2.6', 'e-means-kpp@T2.6', 'e-means-random@T5', 'e-means-kpp@T5', 'e-means-random@T25', 'e-means-kpp@T25']
        out.push(`| 資料集 | seeds | ${arms.join(' | ')} |`)
        out.push(`|---|---|${arms.map(() => '---').join('|')}|`)
        for (let ds of small.datasets) {
            let cells = arms.map((a) => {
                let runs = ds.arms[a].runs
                let bad = ds.name === 'small-300x3-k3' ? runs.filter((r) => JSON.stringify(r.sizes) !== JSON.stringify(small.sizes300)).length : (ds.name === 'gauss-500x5-k4' ? runs.filter((r) => !r.truthOk).length : runs.filter((r) => r.notBest === true).length)
                return `${bad}/${runs.length}(${(bad / runs.length * 100).toFixed(0)}%)`
            })
            out.push(`| ${ds.name}(n=${ds.n}, d=${ds.d}, k=${ds.k}) | ${ds.nSeeds} | ${cells.join(' | ')} |`)
        }
        out.push('')
        out.push(`與API逐seed核對不符之seed數: ${small.datasets.map((ds) => `${ds.name}=${ds.apiMismatch}`).join(', ')}.`)
        out.push('')
        out.push('### 小資料: 最終訓練誤差(各seed平均 ± 樣本標準差; ml-kmeans以各群平均為中心計)')
        out.push('')
        out.push(`| 資料集 | ${arms.join(' | ')} |`)
        out.push(`|---|${arms.map(() => '---').join('|')}|`)
        for (let ds of small.datasets) {
            out.push(`| ${ds.name} | ${arms.map((a) => ms(ds.arms[a].runs.map((r) => r.mse), 5)).join(' | ')} |`)
        }
        out.push('')
    }

    //判準判定
    let verdict = judge(files, small)
    out.push('### 判準判定(由本檔依上列數據計算)')
    out.push('')
    out.push(...verdict.lines)
    out.push('')
    return out
}


//逐項判定三項判準
function judge(files, small) {
    let lines = []
    let res = {}
    for (let T of [5, 2.6]) {
        let c1 = []
        let c2 = []
        let c3 = []
        for (let [nm, j] of Object.entries(files)) {
            let c = compareAt(j, T)
            let kind = j.cfg.kind
            if (SEP_KINDS.includes(kind)) {
                c1.push({ nm, c, ok: c.ratio > 1 })
            }
            if (FLAT_KINDS.includes(kind)) {
                c2.push({ nm, c, ok: -c.diff <= c.pool })
            }
            c3.push({ nm, c, ok: c.distRatio <= COST_RATIO_MAX && c.cpuRatio <= COST_RATIO_MAX })
        }
        res[T] = { c1, c2, c3 }
        let f = (arr) => `${arr.filter((x) => x.ok).length}/${arr.length}(${arr.map((x) => `${x.nm}:${x.ok ? '是' : '否'}`).join(', ')})`
        let rng = (arr, key) => `${Math.min(...arr.map((x) => x.c[key])).toFixed(2)}~${Math.max(...arr.map((x) => x.c[key])).toFixed(2)}`
        lines.push(`- T=${T} 判準1(品質; 差/合併sd>1之設定): ${f(c1)}`)
        lines.push(`- T=${T} 判準2(不劣化; k-means++平均較差之幅度不超過合併sd之設定): ${f(c2)}`)
        lines.push(`- T=${T} 判準3a(成本, 距離計算次數比<=${COST_RATIO_MAX}之設定; 全部設定之比值範圍${rng(c3, 'distRatio')}): ${f(c3.map((x) => ({ nm: x.nm, c: x.c, ok: x.c.distRatio <= COST_RATIO_MAX })))}`)
        lines.push(`- T=${T} 判準3b(成本, CPU時間比<=${COST_RATIO_MAX}之設定; 全部設定之比值範圍${rng(c3, 'cpuRatio')}; 對Lloyd(k-means++)@25之CPU比範圍${rng(c3, 'cpuRatioKpp')}): ${f(c3.map((x) => ({ nm: x.nm, c: x.c, ok: x.c.cpuRatio <= COST_RATIO_MAX })))}`)
    }
    if (small) {
        let ds = small.datasets
        let rate = (d, a) => {
            let runs = d.arms[a].runs
            let bad = d.name === 'small-300x3-k3' ? runs.filter((r) => JSON.stringify(r.sizes) !== JSON.stringify(small.sizes300)).length : (d.name === 'gauss-500x5-k4' ? runs.filter((r) => !r.truthOk).length : runs.filter((r) => r.notBest === true).length)
            return bad / runs.length
        }
        let low = ds.map((d) => `${d.name}: ${(rate(d, 'e-means-random@T5') * 100).toFixed(0)}% -> ${(rate(d, 'e-means-kpp@T5') * 100).toFixed(0)}%`)
        lines.push(`- 小資料局部解比例(T=5, 隨機 -> k-means++): ${low.join('; ')}`)
    }
    return { lines, res }
}


export { buildInitSection, judge, compareAt, loadInit, COST_RATIO_MAX }
