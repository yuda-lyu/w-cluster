/**
 * 彙整 toolg/evalEmeans/results/*.json 為評測報告 toolg/evalEmeans/REPORT.md
 *
 * 用法: node toolg/evalEmeans/evalReport.mjs
 * 結論段落手寫於 toolg/evalEmeans/conclusion.md, 彙整時附於報告開頭
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'


const dir = path.dirname(fileURLToPath(import.meta.url))
const resDir = path.join(dir, 'results')

//設定之顯示順序與說明
const ORDER = [
    ['gmm-sep-d64', '分離良好之高斯混合, 高維'],
    ['gmm-overlap-d32', '群重疊之高斯混合'],
    ['gmm-zipf-d64', '群大小不等(Zipf權重)之高斯混合'],
    ['uniform-d16', '無群結構之均勻資料'],
    ['stretched-d128', '無群結構之拉伸高斯, 高維'],
    ['gmm-sep-d8-highnk', '分離良好之高斯混合, 低維, n/k很大'],
    ['gmm-sep-d32-small', '分離良好之高斯混合, 小n'],
    ['uniform-d2', '二維均勻資料(d<=2, 預設不復活)'],
    ['gmm-sep-d16-k8', '分離良好之高斯混合, 小k'],
    ['gmm-sep-d32-ml', '分離良好之高斯混合, 含現行套件ml-kmeans對照'],
    ['uniform-d16-ml', '無群結構之均勻資料, 含現行套件ml-kmeans對照'],
]


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


function median(a) {
    let s = a.slice().sort((x, y) => x - y)
    let n = s.length
    return n % 2 === 1 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2
}


function ms(a, f = 3) {
    return `${mean(a).toFixed(f)} ± ${sd(a).toFixed(f)}`
}


function pct(a, f = 2) {
    let m = mean(a)
    return `${m >= 0 ? '+' : ''}${m.toFixed(f)}% ± ${sd(a).toFixed(f)}`
}


function fmtInt(x) {
    return Math.round(x).toLocaleString('en-US')
}


function emAt(r, T) {
    return r.arms['emeans'].find((a) => a.T === T)
}


function report() {
    let out = []
    let summary = []
    let files = {}
    for (let f of fs.readdirSync(resDir)) {
        if (f.endsWith('.json')) {
            let j = JSON.parse(fs.readFileSync(path.join(resDir, f), 'utf8'))
            files[j.name] = j
        }
    }
    let any = Object.values(files)[0]
    let conclusionFp = path.join(dir, 'conclusion.md')
    out.push('# e-means 相對 k-means 之評測報告(純JavaScript、僅用CPU、單執行緒)')
    out.push('')
    if (fs.existsSync(conclusionFp)) {
        out.push(fs.readFileSync(conclusionFp, 'utf8').trim())
        out.push('')
    }
    out.push('## 評測設計')
    out.push('')
    out.push(`- 執行環境: Node ${any ? any.node : ''}, CPU ${any ? any.cpuModel : ''}; 演算法與距離計算皆為單執行緒純JavaScript(Float64), 不使用GPU、WebGPU、WebGL、原生擴充或WASM SIMD; 評測以低優先序執行.`)
    out.push('- 對照組A: Lloyd k-means, 與e-means共用同一個最近中心核心(src/WClusterNearest.mjs)、同一組初始中心(隨機初始化)、同一個空群復活函數, 固定25次走訪(Faiss之預設); 另含貪婪k-means++初始化版(初始化之距離計算與耗時計入).')
    out.push('- 對照組B: 本庫現行k-means之後端ml-kmeans(僅於含「-ml」之設定): 其預設(自帶k-means++初始化, 至多100次走訪, tolerance 1e-6)與「同初始中心、固定25次走訪」兩種.')
    out.push('- e-means: 走訪次數T取自{1, 1.4, 2, 2.6, 3, 5, 10, 25}各跑一次(批次大小與步長依論文縮放律由程式決定, 無任何調參), 與Lloyd同一組初始中心.')
    out.push('- 誤差: 每點平方距離之平均(MSE); 訓練集與另抽之測試集(10000點, 同一分佈同一組中心)皆以「最終中心對全部點做精確最近中心指派」計算, 評估之指派不計入預算與耗時.')
    out.push('- 距離計算次數: 演算法本身之(點,中心)距離評估次數(Lloyd每次走訪n*k; e-means每個走訪之列數*k; k-means++初始化之距離一併計入); 走訪次數(epoch)=距離計算次數/(n*k). 此二者與硬體無關.')
    out.push('- CPU時間: process.cpuUsage之user+system(單執行緒演算法, 含V8背景執行緒之少量開銷), 另記牆鐘時間; 每個設定先暖機(JIT); 資料固定, 變動者為演算法seed(初始中心與洗牌).')
    out.push('- 表中數值為各seed之平均 ± 樣本標準差; 相對誤差以「同seed之Lloyd(隨機初始化)25次走訪之測試誤差」為基準(負值表示較低=較佳).')
    out.push('- 標準差只含演算法seed(初始中心與洗牌)之變異: 每個設定固定一組資料與一組測試集; 資料抽樣之變異另以少數設定之重複資料估計(見「資料抽樣重複」節), 其餘設定之結論僅限該組資料.')
    out.push('- 「達標T」(達到Lloyd@25之測試誤差所需之T)為事後以測試誤差自網格中選取之離線指標, 用以量化「同誤差下之計算量」, 不是事先可知之設定; 事先可用之比較為各表之「同走訪次數」與「同CPU耗時預算」.')
    out.push('- 評測於原始特徵空間直接分群(對應 `usePCA: false`); 公開API預設先以PCA降為2維, 此時e-means收到d=2而預設不復活(對應 uniform-d2 一組之情形).')
    out.push('')

    for (let [name, desc] of ORDER) {
        let j = files[name]
        if (!j) {
            continue
        }
        let { n, d, k, kind, nTest, nSeeds } = j.cfg
        let R = j.results
        out.push(`## ${name}: ${desc}`)
        out.push('')
        out.push(`n=${fmtInt(n)}, d=${d}, k=${k}(n/k=${(n / k).toFixed(0)}), 測試集${fmtInt(nTest)}點, 種類${kind}, seeds=${nSeeds}`)
        out.push('')

        //基準
        let L25 = R.map((r) => r.arms['lloyd-random'].traj[25])
        let K25 = R.map((r) => r.arms['lloyd-kpp'].traj[25])
        out.push(`Lloyd(隨機初始化)25次走訪: 測試MSE ${ms(L25.map((x) => x.test), 4)}, 訓練MSE ${ms(L25.map((x) => x.train), 4)}; Lloyd(k-means++)25次走訪: 測試MSE ${ms(K25.map((x) => x.test), 4)}`)
        out.push('')

        //同epoch
        out.push('### 同走訪次數(epoch)預算之測試誤差(相對Lloyd隨機初始化@25, 負值較佳)')
        out.push('')
        out.push('| 走訪次數 | Lloyd(隨機初始化) | Lloyd(k-means++, 不含初始化) | e-means |')
        out.push('|---|---|---|---|')
        for (let t of [1, 2, 3, 5, 10, 25]) {
            let rl = R.map((r) => (r.arms['lloyd-random'].traj[t].test / r.arms['lloyd-random'].traj[25].test - 1) * 100)
            let rk = R.map((r) => (r.arms['lloyd-kpp'].traj[t].test / r.arms['lloyd-random'].traj[25].test - 1) * 100)
            let re = R.map((r) => (emAt(r, t).test / r.arms['lloyd-random'].traj[25].test - 1) * 100)
            out.push(`| ${t} | ${pct(rl)} | ${pct(rk)} | ${pct(re)} |`)
        }
        out.push('')

        //達標
        let grid = j.tGrid
        let hit = (r, ref) => {
            for (let T of grid) {
                if (emAt(r, T).test <= ref) {
                    return T
                }
            }
            return Infinity
        }
        let hitL = R.map((r) => hit(r, r.arms['lloyd-random'].traj[25].test))
        let hitK = R.map((r) => hit(r, r.arms['lloyd-kpp'].traj[25].test))
        let showT = (a) => `${median(a) === Infinity ? '>25' : median(a)}(${a.filter((x) => x !== Infinity).length}/${a.length}個seed達標; 最小${Math.min(...a) === Infinity ? '-' : Math.min(...a)}, 最大${Math.max(...a) === Infinity ? '>25' : Math.max(...a)})`
        out.push('### e-means達到Lloyd@25之測試誤差所需之走訪次數(取自T網格; 對Lloyd隨機初始化者為同seed同初始中心, 對Lloyd(k-means++)者Lloyd用其自身之初始中心)')
        out.push('')
        out.push(`- 達到Lloyd(隨機初始化)@25: 中位數T=${showT(hitL)}`)
        out.push(`- 達到Lloyd(k-means++)@25: 中位數T=${showT(hitK)}`)
        out.push('')

        //計算量與CPU
        out.push('### 計算量與CPU時間(Lloyd@25 對 e-means之各T)')
        out.push('')
        out.push('| 方法 | 走訪次數 | 距離計算次數 | CPU時間(ms) | 牆鐘(ms) | 測試MSE | 訓練MSE | 訓練MSE(論文codes) |')
        out.push('|---|---|---|---|---|---|---|---|')
        out.push(`| Lloyd(隨機初始化)@25 | 25 | ${fmtInt(25 * n * k)} | ${ms(L25.map((x) => x.cpuMs), 0)} | ${ms(L25.map((x) => x.wallMs), 0)} | ${ms(L25.map((x) => x.test), 4)} | ${ms(L25.map((x) => x.train), 4)} | - |`)
        out.push(`| Lloyd(k-means++)@25(含初始化) | ${(K25.map((x) => x.dist)[0] / (n * k)).toFixed(1)} | ${fmtInt(mean(K25.map((x) => x.dist)))} | ${ms(K25.map((x) => x.cpuMs), 0)} | ${ms(K25.map((x) => x.wallMs), 0)} | ${ms(K25.map((x) => x.test), 4)} | ${ms(K25.map((x) => x.train), 4)} | - |`)
        for (let T of grid) {
            let E = R.map((r) => emAt(r, T))
            out.push(`| e-means T=${T} | ${E[0].epochs.toFixed(2)} | ${fmtInt(E[0].dist)} | ${ms(E.map((x) => x.cpuMs), 0)} | ${ms(E.map((x) => x.wallMs), 0)} | ${ms(E.map((x) => x.test), 4)} | ${ms(E.map((x) => x.train), 4)} | ${ms(E.map((x) => x.trainCodes), 4)} |`)
        }
        out.push('')
        let E0 = emAt(R[0], 2.6)
        out.push(`e-means之批次大小與初始步長(T=2.6): B=${E0.batchSize}(${E0.batchLaw}律), alpha0=${E0.alpha0.toFixed(3)}, 更新次數=${E0.steps}`)
        out.push('')

        //同耗時
        out.push('### 同CPU耗時預算(以e-means T=2.6與T=5之CPU時間為預算, Lloyd取預算內可完成之最大走訪次數)')
        out.push('')
        out.push('| 預算 | Lloyd(隨機初始化)走訪次數 | Lloyd(隨機初始化)測試MSE相對@25 | Lloyd(k-means++, 含初始化耗時)走訪次數 | Lloyd(k-means++)測試MSE相對Lloyd(隨機初始化)@25 | e-means測試MSE相對Lloyd(隨機初始化)@25 |')
        out.push('|---|---|---|---|---|---|')
        for (let T of [2.6, 5]) {
            let its = []
            let rl = []
            let re = []
            let itk = []
            let rk = []
            for (let r of R) {
                let budget = emAt(r, T).cpuMs
                let tr = r.arms['lloyd-random'].traj
                let t = 0
                for (let i = 1; i <= 25; i++) {
                    if (tr[i].cpuMs <= budget) {
                        t = i
                    }
                }
                its.push(t)
                //t=0時以初始中心之測試誤差
                rl.push((tr[t].test / tr[25].test - 1) * 100)
                re.push((emAt(r, T).test / tr[25].test - 1) * 100)
                let tk = r.arms['lloyd-kpp'].traj
                let u = 0
                for (let i = 1; i <= 25; i++) {
                    if (tk[i].cpuMs <= budget) {
                        u = i
                    }
                }
                itk.push(u)
                if (u >= 1) {
                    rk.push((tk[u].test / tr[25].test - 1) * 100)
                }
            }
            let noKpp = itk.filter((x) => x === 0).length
            out.push(`| e-means T=${T}之CPU時間(${ms(R.map((r) => emAt(r, T).cpuMs), 0)}ms) | ${ms(its, 1)} | ${pct(rl)} | ${ms(itk, 1)}(${noKpp}/${itk.length}個seed尚無完整走訪) | ${rk.length > 0 ? pct(rk) : '-'} | ${pct(re)} |`)
        }
        out.push('')

        //消融
        let nr = R[0].arms['emeans-norev']
        if (nr) {
            out.push('### 消融: 不做群復活(unusedThreshold=0), 測試MSE相對Lloyd@25')
            out.push('')
            out.push('| T | 預設(含復活) | 不復活 | 復活之群數(預設, 均值) |')
            out.push('|---|---|---|---|')
            for (let T of [2.6, 5]) {
                let a = R.map((r) => (emAt(r, T).test / r.arms['lloyd-random'].traj[25].test - 1) * 100)
                let b = R.map((r) => (r.arms['emeans-norev'].find((x) => x.T === T).test / r.arms['lloyd-random'].traj[25].test - 1) * 100)
                out.push(`| ${T} | ${pct(a)} | ${pct(b)} | ${mean(R.map((r) => emAt(r, T).splits)).toFixed(1)} |`)
            }
            out.push('')
        }

        //ml
        if (R[0].arms['ml-default']) {
            out.push('### 現行套件(ml-kmeans)對照')
            out.push('')
            out.push('| 方法 | 走訪次數 | 距離計算次數 | CPU時間(ms) | 每次走訪CPU(ms) | 測試MSE | 相對Lloyd(隨機初始化)@25 |')
            out.push('|---|---|---|---|---|---|---|')
            let rowOf = (label, A) => {
                let rel = A.map((x, i) => (x.test / L25[i].test - 1) * 100)
                out.push(`| ${label} | ${ms(A.map((x) => x.epochs), 1)} | ${fmtInt(mean(A.map((x) => x.dist)))} | ${ms(A.map((x) => x.cpuMs), 0)} | ${ms(A.map((x) => x.cpuMs / x.epochs), 1)} | ${ms(A.map((x) => x.test), 4)} | ${pct(rel)} |`)
            }
            rowOf('ml-kmeans預設(自帶k-means++, tol 1e-6, 至多100次)', R.map((r) => r.arms['ml-default']))
            rowOf('ml-kmeans同初始中心(至多25次, tol 0, 中心完全不變即停)', R.map((r) => r.arms['ml-same-init']))
            out.push(`| 本庫Lloyd對照組A(同初始中心, 25次) | 25.0 ± 0.0 | ${fmtInt(25 * n * k)} | ${ms(L25.map((x) => x.cpuMs), 0)} | ${ms(L25.map((x) => x.cpuMs / 25), 1)} | ${ms(L25.map((x) => x.test), 4)} | +0.00% ± 0.00 |`)
            let e5 = R.map((r) => emAt(r, 5))
            out.push(`| e-means T=5 | 5.0 ± 0.0 | ${fmtInt(5 * n * k)} | ${ms(e5.map((x) => x.cpuMs), 0)} | ${ms(e5.map((x) => x.cpuMs / 5), 1)} | ${ms(e5.map((x) => x.test), 4)} | ${pct(e5.map((x, i) => (x.test / L25[i].test - 1) * 100))} |`)
            out.push('')
            out.push('註: ml-kmeans之距離計算次數 = 走訪次數*n*k + 其k-means++初始化(貪婪, 首個中心n次、其後每個中心(2+floor(ln k))*n次, 取自ml-kmeans原始碼); 「同初始中心」者無初始化之距離計算; 走訪次數欄不含初始化.')
            out.push('')
        }

        //彙總
        let L25cpu = mean(L25.map((x) => x.cpuMs))
        let e26 = R.map((r) => emAt(r, 2.6))
        let tHit = median(hitL)
        let cpuRatioHit = null
        let cpuHitMs = null
        let wallRatioHit = null
        if (tHit !== Infinity) {
            let wl = []
            let we = []
            R.forEach((r, i) => {
                if (hitL[i] !== Infinity) {
                    wl.push(r.arms['lloyd-random'].traj[25].wallMs)
                    we.push(emAt(r, hitL[i]).wallMs)
                }
            })
            wallRatioHit = mean(wl) / mean(we)
            //以各seed達標時之T(未達標之seed不計)比較CPU時間: 平均Lloyd@25 / 平均e-means@T_hit(以平均之比而非比之平均, 避免CPU計時解析度造成之除以0)
            let sl = []
            let se = []
            R.forEach((r, i) => {
                if (hitL[i] !== Infinity) {
                    sl.push(r.arms['lloyd-random'].traj[25].cpuMs)
                    se.push(emAt(r, hitL[i]).cpuMs)
                }
            })
            cpuHitMs = mean(se)
            cpuRatioHit = cpuHitMs > 0 ? mean(sl) / cpuHitMs : null
        }
        //每走訪之CPU成本比: e-means(T=5)每走訪 / Lloyd(25次)每走訪
        let perEpoch = mean(R.map((r) => emAt(r, 5).cpuMs)) / 5 / (mean(L25.map((x) => x.cpuMs)) / 25)
        summary.push({
            wallRatioHit,
            perEpoch,
            cpuHitMs,
            floorHit: tHit === 1,
            distRatioHit: tHit === Infinity ? null : 25 / tHit,
            cpuRatioHit,
            name,
            n,
            d,
            k,
            hitL: median(hitL),
            hitLcount: hitL.filter((x) => x !== Infinity).length,
            hitK: median(hitK),
            hitKcount: hitK.filter((x) => x !== Infinity).length,
            nSeeds,
            e1: mean(R.map((r) => (emAt(r, 1).test / r.arms['lloyd-random'].traj[25].test - 1) * 100)),
            e26: mean(R.map((r) => (emAt(r, 2.6).test / r.arms['lloyd-random'].traj[25].test - 1) * 100)),
            e5: mean(R.map((r) => (emAt(r, 5).test / r.arms['lloyd-random'].traj[25].test - 1) * 100)),
            e25: mean(R.map((r) => (emAt(r, 25).test / r.arms['lloyd-random'].traj[25].test - 1) * 100)),
            kpp25: mean(R.map((r) => (r.arms['lloyd-kpp'].traj[25].test / r.arms['lloyd-random'].traj[25].test - 1) * 100)),
            cpuRatio26: L25cpu / mean(e26.map((x) => x.cpuMs)),
            cpuRatio5: L25cpu / mean(R.map((r) => emAt(r, 5).cpuMs)),
        })
    }

    //資料抽樣重複: 同一設定以不同資料seed(--dataSeedOffset)重複, 估計資料抽樣之變異
    let instMetrics = (j) => {
        let RR = j.results
        let hits = RR.map((r) => {
            let l25 = r.arms['lloyd-random'].traj[25].test
            for (let T of j.tGrid) {
                if (emAt(r, T).test <= l25) {
                    return T
                }
            }
            return Infinity
        })
        let rel = (f) => mean(RR.map((r) => (f(r) / r.arms['lloyd-random'].traj[25].test - 1) * 100))
        let cpuL = mean(RR.map((r) => r.arms['lloyd-random'].traj[25].wallMs))
        return {
            hit: median(hits),
            e26: rel((r) => emAt(r, 2.6).test),
            e25: rel((r) => emAt(r, 25).test),
            kpp: rel((r) => r.arms['lloyd-kpp'].traj[25].test),
            wallRatio26: cpuL / mean(RR.map((r) => emAt(r, 2.6).wallMs)),
        }
    }
    let repLines = []
    for (let [name, desc] of ORDER) {
        let reps = Object.keys(files).filter((k) => k.startsWith(name + '@d')).sort()
        if (!files[name] || reps.length === 0) {
            continue
        }
        let all = [name, ...reps].map((k) => ({ k, m: instMetrics(files[k]) }))
        repLines.push(`### ${name}: ${desc}(資料${all.length}組, 每組${files[name].cfg.nSeeds}個演算法seed)`)
        repLines.push('')
        repLines.push('| 資料 | 達標T中位數 | e-means T=2.6相對誤差 | T=25相對誤差 | Lloyd(k-means++)@25相對誤差 | 牆鐘比(Lloyd@25 / e-means T=2.6) |')
        repLines.push('|---|---|---|---|---|---|')
        for (let { k, m } of all) {
            repLines.push(`| ${k} | ${m.hit === Infinity ? '>25' : m.hit} | ${m.e26.toFixed(2)}% | ${m.e25.toFixed(2)}% | ${m.kpp.toFixed(2)}% | ${m.wallRatio26.toFixed(1)}x |`)
        }
        let f = (a, t = 2) => `${mean(a).toFixed(t)} ± ${sd(a).toFixed(t)}`
        repLines.push(`| **資料間平均 ± 標準差** | ${f(all.map((x) => x.m.hit), 1)} | ${f(all.map((x) => x.m.e26))}% | ${f(all.map((x) => x.m.e25))}% | ${f(all.map((x) => x.m.kpp))}% | ${f(all.map((x) => x.m.wallRatio26), 1)}x |`)
        repLines.push('')
    }
    if (repLines.length > 0) {
        out.push('## 資料抽樣重複(估計資料抽樣之變異)')
        out.push('')
        out.push('同一設定(同n、d、k、種類)以不同資料seed重新產生訓練集與測試集後重跑(其餘同上); 表中各列為該資料之各演算法seed平均, 末列為資料間之平均與標準差.')
        out.push('')
        out.push(...repLines)
    }

    //記憶體(evalMemory.mjs之結果)
    let memFp = path.join(resDir, 'memory.json')
    if (fs.existsSync(memFp)) {
        let m = JSON.parse(fs.readFileSync(memFp, 'utf8'))
        out.push('## 記憶體(各手臂於獨立行程執行, 峰值常駐記憶體)')
        out.push('')
        out.push(m.table)
        out.push('')
        out.push('註: 峰值RSS含V8堆積之回收延遲, 為估計值; ml-kmeans為陣列之陣列表示, 資料本身即多佔記憶體(資料載入後RSS較高), 預設路徑之k-means++初始化另有暫存.')
        out.push('')
    }

    //彙總表置於各設定之前
    let head = []
    head.push('## 彙總(各設定, 測試誤差相對Lloyd隨機初始化@25之平均, 負值較佳)')
    head.push('')
    head.push('| 設定 | n | d | k | e-means T=1 | T=2.6 | T=5 | T=25 | Lloyd(k-means++)@25 | 達Lloyd@25之T中位數(達標seed數) | 距離計算次數比(25/T達標) | CPU時間比(Lloyd@25 / e-means T達標) | 牆鐘時間比 | 每走訪CPU比(e-means/Lloyd) |')
    head.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
    for (let s of summary) {
        let f = (x) => `${x >= 0 ? '+' : ''}${x.toFixed(2)}%`
        let ge = s.floorHit ? '≥' : ''
        let cpuTxt = s.cpuRatioHit === null ? '-' : `${ge}${s.cpuRatioHit.toFixed(1)}x`
        if (s.cpuHitMs !== null && s.cpuHitMs < 40) {
            cpuTxt += '(e-means僅' + s.cpuHitMs.toFixed(0) + 'ms, 低於CPU計時解析度, 僅供參考)'
        }
        head.push(`| ${s.name} | ${fmtInt(s.n)} | ${s.d} | ${s.k} | ${f(s.e1)} | ${f(s.e26)} | ${f(s.e5)} | ${f(s.e25)} | ${f(s.kpp25)} | ${s.hitL === Infinity ? '>25' : s.hitL}(${s.hitLcount}/${s.nSeeds}) | ${s.distRatioHit === null ? '-' : ge + s.distRatioHit.toFixed(1) + 'x'} | ${cpuTxt} | ${s.wallRatioHit === null ? '-' : ge + s.wallRatioHit.toFixed(1) + 'x'} | ${s.perEpoch.toFixed(2)} |`)
    }
    head.push('')
    head.push('註: CPU時間取自process.cpuUsage(Windows解析度約15ms, 且含V8背景執行緒之編譯與回收), 數值低於約100ms者誤差大(傾向高估e-means之耗時, 即低估其優勢); 牆鐘時間為performance.now之差, 可交叉核對.')
    head.push('')
    head.push('註: 「達標T」取自T網格{1,1.4,2,2.6,3,5,10,25}之最小值, 中位數為1者表示網格下限即已達標(實際達標所需走訪可能低於1), 比值以「≥」標示為下限. 各設定之詳細表見下.')
    head.push('')
    let idx = out.indexOf('## 評測設計')
    let all = out.slice(0, idx).concat(head, out.slice(idx))
    fs.writeFileSync(path.join(dir, 'REPORT.md'), all.join('\n') + '\n')
    console.log('written ' + path.join(dir, 'REPORT.md'), all.length + ' lines')
}


report()
