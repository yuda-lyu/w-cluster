/**
 * e-means評測用之合成資料產生器(可重現; 各欄各筆之值皆由亂數產生而相異)
 *
 * 資料分佈依論文附錄D.2之合成資料設計(高斯混合、Zipf權重混合、均勻方塊、拉伸高斯),
 * 另加一組群重疊程度高之高斯混合以涵蓋分離度之軸
 *
 * 種類(kind):
 *   'gmm-sep'     : G個高斯中心, 中心間距遠大於群內分散(sigma_mu^2=2/3, sigma_w^2=1/3, 論文D.2), 各群等機率
 *   'gmm-overlap' : 同上但群重疊(sigma_mu^2=0.15, sigma_w^2=0.85), 各群等機率
 *   'gmm-zipf'    : 同gmm-sep但各群機率正比於1/g(群大小不等, 論文D.2)
 *   'uniform'     : 各維獨立之U(-sqrt(3), sqrt(3)), 無群結構
 *   'stretched'   : 各維變異數 lambda_i = d * i^-a / sum_j j^-a (a=1), 單一高斯, 無群結構(論文D.2之拉伸高斯)
 */
import { makeRng } from '../../src/WClusterUtil.mjs'


function makeGauss(rng) {
    let spare = null
    return function gauss() {
        if (spare !== null) {
            let v = spare
            spare = null
            return v
        }
        let u = 0
        while (u === 0) {
            u = rng.random()
        }
        let w = rng.random()
        let r = Math.sqrt(-2 * Math.log(u))
        spare = r * Math.sin(2 * Math.PI * w)
        return r * Math.cos(2 * Math.PI * w)
    }
}


/**
 * 產生一組評測資料(訓練集與另抽之測試集來自同一分佈、同一組中心)
 *
 * @param {Object} cfg 輸入設定物件
 * @param {String} cfg.kind 輸入種類字串
 * @param {Number} cfg.n 輸入訓練集列數
 * @param {Number} cfg.d 輸入維度
 * @param {Number} [cfg.G] 輸入混合群數(gmm類), 未給時為cfg.k
 * @param {Number} cfg.k 輸入分群時之群數
 * @param {Number} cfg.dataSeed 輸入資料seed
 * @param {Number} [cfg.nTest=10000] 輸入測試集列數
 * @returns {Object} 回傳{ X, Xtest, n, d, nTest, kind }
 */
function makeDataset(cfg) {
    let { kind, n, d, k, dataSeed } = cfg
    let nTest = cfg.nTest || 10000
    let G = cfg.G || k
    let gaussC = makeGauss(makeRng(dataSeed))
    let sigMu2 = 2 / 3
    let sigW2 = 1 / 3
    if (kind === 'gmm-overlap') {
        sigMu2 = 0.15
        sigW2 = 0.85
    }
    let sMu = Math.sqrt(sigMu2)
    let sW = Math.sqrt(sigW2)

    //中心與群權重(累積機率)
    let centers = null
    let cumW = null
    if (kind.startsWith('gmm')) {
        centers = new Float64Array(G * d)
        for (let i = 0; i < centers.length; i++) {
            centers[i] = sMu * gaussC()
        }
        cumW = new Float64Array(G)
        let acc = 0
        for (let g = 0; g < G; g++) {
            acc += kind === 'gmm-zipf' ? 1 / (g + 1) : 1
            cumW[g] = acc
        }
        for (let g = 0; g < G; g++) {
            cumW[g] /= acc
        }
    }

    //拉伸高斯之各維標準差
    let sd = null
    if (kind === 'stretched') {
        sd = new Float64Array(d)
        let z = 0
        for (let i = 1; i <= d; i++) {
            z += Math.pow(i, -1)
        }
        for (let i = 1; i <= d; i++) {
            sd[i - 1] = Math.sqrt(d * Math.pow(i, -1) / z)
        }
    }

    function fill(len, seed) {
        let rng = makeRng(seed)
        let gauss = makeGauss(rng)
        let M = new Float64Array(len * d)
        for (let i = 0; i < len; i++) {
            let o = i * d
            if (kind.startsWith('gmm')) {
                let u = rng.random()
                let lo = 0
                let hi = G - 1
                while (lo < hi) {
                    let mid = (lo + hi) >>> 1
                    if (cumW[mid] >= u) {
                        hi = mid
                    }
                    else {
                        lo = mid + 1
                    }
                }
                let co = lo * d
                for (let t = 0; t < d; t++) {
                    M[o + t] = centers[co + t] + sW * gauss()
                }
            }
            else if (kind === 'uniform') {
                let a = Math.sqrt(3)
                for (let t = 0; t < d; t++) {
                    M[o + t] = (rng.random() * 2 - 1) * a
                }
            }
            else if (kind === 'stretched') {
                for (let t = 0; t < d; t++) {
                    M[o + t] = sd[t] * gauss()
                }
            }
            else {
                throw new Error('unknown kind')
            }
        }
        return M
    }

    return { X: fill(n, dataSeed * 3 + 1), Xtest: fill(nTest, dataSeed * 3 + 2), n, d, nTest, kind }
}


export { makeDataset, makeGauss }
