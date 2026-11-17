/**
 * 共用之最近中心計算核心(單執行緒、純JavaScript、僅用CPU)
 *
 * 為e-means(src/WEmeans.mjs)與Lloyd k-means對照組(src/WClusterLloyd.mjs)所共用之距離與指派程式,
 * 兩者之差異僅在演算法本身(更新規則、批次、步長), 不在距離計算之實作, 評測才能把演算法與實作效率分開
 *
 * 資料以列優先之Float64Array攤平儲存: X[i*d + t]為第i列第t維, 中心C[j*d + t]為第j群第t維
 *
 * 計數: 每次指派呼叫累加 nRows × k 於 stats.dist(距離計算次數, 與硬體無關)
 */


/**
 * 建立計數器
 *
 * @returns {Object} 回傳計數器物件，dist為距離計算次數(點對中心之距離評估次數)，assignRows為被指派之列次數，passes為指派之走訪次數(dist/(n*k)之等效值由呼叫端換算)
 */
function newStats() {
    return { dist: 0, assignRows: 0 }
}


/**
 * 計算各中心之平方範數
 *
 * @param {Float64Array} C 輸入中心(k*d)
 * @param {Number} k 輸入群數
 * @param {Number} d 輸入維度
 * @param {Float64Array} cn 輸出各中心之平方範數(長度k)
 * @returns {Float64Array} 回傳cn
 */
function centroidNorms(C, k, d, cn) {
    for (let j = 0; j < k; j++) {
        let o = j * d
        let s = 0
        for (let t = 0; t < d; t++) {
            let v = C[o + t]
            s += v * v
        }
        cn[j] = s
    }
    return cn
}


/**
 * 對指定列做最近中心指派(平方歐氏距離)
 *
 * 以 argmin_j (|c_j|^2 - 2 x·c_j) 取最近中心(同分取較小之群編號), 其後以直接差平方和重算該對之平方距離, 故回傳之距離不受抵銷誤差影響;
 * 以4個中心為一組暫存器分塊, 每點每中心之內積為d次乘加
 *
 * @param {Float64Array} X 輸入資料(n*d)
 * @param {Number} d 輸入維度
 * @param {Int32Array|null} rows 輸入列索引陣列, 為null時取0..nRows-1
 * @param {Number} nRows 輸入要處理之列數
 * @param {Float64Array} C 輸入中心(k*d)
 * @param {Number} k 輸入群數
 * @param {Float64Array} cn 輸入各中心之平方範數(須與C一致)
 * @param {Int32Array} outLabel 輸出各列之最近中心編號(長度至少nRows, 依處理順序)
 * @param {Float64Array|null} outDist 輸出各列之平方距離(長度至少nRows), 可為null
 * @param {Object|null} stats 輸入計數器, 可為null
 * @returns {Number} 回傳nRows個平方距離之總和(Float64)
 */
function assignNearest(X, d, rows, nRows, C, k, cn, outLabel, outDist, stats) {
    let total = 0
    let k4 = k - (k % 4)
    for (let i = 0; i < nRows; i++) {
        let r = rows === null ? i : rows[i]
        let xo = r * d
        let best = 0
        let bestv = Infinity
        let j = 0
        for (; j < k4; j += 4) {
            let o0 = j * d
            let o1 = o0 + d
            let o2 = o1 + d
            let o3 = o2 + d
            let s0 = 0
            let s1 = 0
            let s2 = 0
            let s3 = 0
            for (let t = 0; t < d; t++) {
                let xv = X[xo + t]
                s0 += xv * C[o0 + t]
                s1 += xv * C[o1 + t]
                s2 += xv * C[o2 + t]
                s3 += xv * C[o3 + t]
            }
            let v0 = cn[j] - 2 * s0
            let v1 = cn[j + 1] - 2 * s1
            let v2 = cn[j + 2] - 2 * s2
            let v3 = cn[j + 3] - 2 * s3
            if (v0 < bestv) {
                bestv = v0
                best = j
            }
            if (v1 < bestv) {
                bestv = v1
                best = j + 1
            }
            if (v2 < bestv) {
                bestv = v2
                best = j + 2
            }
            if (v3 < bestv) {
                bestv = v3
                best = j + 3
            }
        }
        for (; j < k; j++) {
            let o = j * d
            let s = 0
            for (let t = 0; t < d; t++) {
                s += X[xo + t] * C[o + t]
            }
            let v = cn[j] - 2 * s
            if (v < bestv) {
                bestv = v
                best = j
            }
        }
        outLabel[i] = best

        //以直接差平方和重算該對之距離
        let ob = best * d
        let dd = 0
        for (let t = 0; t < d; t++) {
            let df = X[xo + t] - C[ob + t]
            dd += df * df
        }
        if (outDist !== null) {
            outDist[i] = dd
        }
        total += dd
    }
    if (stats) {
        stats.dist += nRows * k
        stats.assignRows += nRows
    }
    return total
}


/**
 * 依指派結果累加各群之和與個數(sums[j*d+t] += X[r*d+t], counts[j] += 1)
 *
 * @param {Float64Array} X 輸入資料(n*d)
 * @param {Number} d 輸入維度
 * @param {Int32Array|null} rows 輸入列索引陣列, 為null時取0..nRows-1
 * @param {Number} nRows 輸入列數
 * @param {Int32Array} label 輸入各列(依處理順序)之群編號
 * @param {Float64Array} sums 輸入輸出各群之和(k*d), 就地累加
 * @param {Float64Array} counts 輸入輸出各群之個數(k), 就地累加
 */
function accumulateRows(X, d, rows, nRows, label, sums, counts) {
    for (let i = 0; i < nRows; i++) {
        let r = rows === null ? i : rows[i]
        let l = label[i]
        let xo = r * d
        let so = l * d
        counts[l] += 1
        for (let t = 0; t < d; t++) {
            sums[so + t] += X[xo + t]
        }
    }
}


export { newStats, centroidNorms, assignNearest, accumulateRows }
export default assignNearest
