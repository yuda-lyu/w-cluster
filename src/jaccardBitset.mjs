// Jaccard 距離的位元打包(bitset) + popcount 加速版。
//
// 對「0/1 二元向量」做 k-medoids + Jaccard 分群時, 建距離矩陣為 O(n²·D)。逐維計算
// Jaccard 在高維很慢; 改用「把 D 個 0/1 位元打包成 ceil(D/32) 個 32-bit word, 以
// popcount 一次處理 32 維」, 每對距離計算可加速約一個數量級(實測高維 ~14–23x)。
//
// 用法:
//   import { jaccardBitset } from './jaccardBitset.mjs'
//   let { data, funDist } = jaccardBitset(rows)   //rows: 各列為等長 0/1 陣列
//   let rc = await WCluster.cluster(data, { mode: 'k-medoids', kNumber, usePCA: false, funDist, useMethod: 'fasterPAM' })
//   //rc.ginds 為各群所屬「原始列 index」, 與 rows 對應
//
// 注意:
//   1) 必須 usePCA:false —— 打包後的列是 word 值, 不可再做 PCA。
//   2) funDist 必須搭配「打包後的 data」使用(兩者由本函數成對產出)。
//   3) 兩列皆全 0(聯集為 0)時 Jaccard 距離視為相同(0), 與逐維版語意一致。


//把單一 0/1 陣列打包成 plain Array(每元素為一個 32-bit word)。
//  用 plain Array(非 Uint32Array)以相容 WCluster 的陣列型別檢核(isearr 只認真正 Array)。
function packBits(v) {
    let nw = Math.ceil(v.length / 32)
    let w = new Array(nw).fill(0)
    for (let i = 0; i < v.length; i++) {
        if (v[i]) {
            w[i >> 5] |= (1 << (i & 31))
        }
    }
    return w
}


//32-bit popcount(SWAR); 以 >>> 確保以無號位元樣式計算。
function popcount32(x) {
    x = x >>> 0
    x = x - ((x >>> 1) & 0x55555555)
    x = (x & 0x33333333) + ((x >>> 2) & 0x33333333)
    x = (x + (x >>> 4)) & 0x0f0f0f0f
    return Math.imul(x, 0x01010101) >>> 24
}


//兩個「打包後列」的 Jaccard 距離 = 1 − |交集| / |聯集|; 聯集為 0(兩列皆空)視為相同(0)。
function jaccardBits(wa, wb) {
    let inter = 0
    let uni = 0
    for (let i = 0; i < wa.length; i++) {
        inter += popcount32(wa[i] & wb[i])
        uni += popcount32(wa[i] | wb[i])
    }
    return uni === 0 ? 0 : 1 - inter / uni
}


//便利函數: 輸入 0/1 列陣列, 回傳 { data:打包後列陣列, funDist:jaccardBits }, 直接餵 WCluster.cluster。
function jaccardBitset(rows) {
    let data = rows.map((v) => packBits(v))
    return { data, funDist: jaccardBits }
}


export { packBits, popcount32, jaccardBits, jaccardBitset }
export default jaccardBitset
