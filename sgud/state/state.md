# 狀態(現況)

只記現況,不寫過程(過程見 `sgud/exp/experience.md`). 規則藍圖見 `sgud/rule/rulebook.md`.

## 功能現況

| 功能 | 狀態 | 規則帳本 | 測試/指令 |
|---|---|---|---|
| `WCluster.PCA` | 既有,未動 | - | `test/PCA.test.mjs` |
| `WCluster.cluster` mode `k-means`(ml-kmeans)、`k-medoids`(FasterPAM/simple) | 既有,行為與輸出未動 | R-EM-03 | `test/kMeans.test.mjs`、`test/kMedoids-*.test.mjs`、`test/jaccardBitset.test.mjs` |
| `WCluster.cluster` mode `e-means`(EMA小批次k-means,論文arXiv:2611.09501之JavaScript移植,純CPU單執行緒) | 完成 | R-EM-02、R-EM-03、R-EM-04 | `test/unit-eMeans.test.mjs`(66案); 變異證明 `node test/tools/mutate-eMeans.mjs`(45項全被殺) |
| 共用最近中心核心 `src/WClusterNearest.mjs`、小工具與復活分裂 `src/WClusterUtil.mjs` | 完成 | R-EM-01 | 同上 |
| Lloyd k-means對照組 `src/WClusterLloyd.mjs`(僅供評測與測試,不由WCluster匯出) | 完成 | R-EM-01、R-EM-06 | 同上 |
| e-means評測 `toolg/evalEmeans/`(資料產生、執行器、報告彙整、記憶體量測)與 `REPORT.md` | 完成(11組合成資料,5~8 seeds) | R-EM-06 | 重跑指令見規則帳本 R-EM-06 |

## e-means評測現況(摘要; 完整數據見 `toolg/evalEmeans/REPORT.md`)

- 以同一核心、同一組初始中心比較Lloyd@25: e-means約1~3個走訪即達Lloyd@25之測試誤差(論文1.4~2.6),距離計算次數少8.3~25倍以上,每走訪CPU成本為Lloyd之1.03~1.2倍(計算量大之設定),CPU時間少約4~19倍. 結論: 加速來自演算法本身,與GPU無關.
- 不成立處: 分離型混合資料上Lloyd(k-means++)@25之誤差低於e-means; 小k、小n、低維增益小; 規模遠小於論文; 資料皆為合成.

## 已知缺口與待辦

- `opt.debug`(輸入規格K3之警告)未實作,待wsemi公開共用opt解析函數(見 `sgud/feedback/feedback.md` 第1列).
- e-means路徑之輸入檢測限於e-means自身: 預設之PCA前處理(`usePCA: true`)、`nCompNIPALS` 轉換、物件列之欄位篩選(`getEffKeys`,結果依列順序)沿用既有行為,數字字串須 `usePCA: false`; 統一改善須動既有mode之行為,待裁示.
- 最近中心之距離以 `|c|^2 - 2x·c` 比較(與Faiss同法),已由 `kEmeans` 置中與限定資料絕對值<=1e100緩解; 內部直接呼叫者須自行確保資料已置中(見R-EM-01).
- 未驗證: 論文規模(百萬至百億列)之行為; 真實嵌入資料(無授權可查證之公開資料集納入); 瀏覽器端(UMD/web worker)之 `mode: 'e-means'`(未重建 `dist/`,未實跑).
- **`package.json` 之 `main` 指向 `dist/w-cluster.umd.js`,發布前須重建**(舊 `dist/` 不認得 `mode: 'e-means'`,會因既有之「未知mode改用k-medoids」而靜默跑k-medoids); 發布與建置(`dist/`、`docs/`、版號)由套件擁有者之自動化流程處理,本輪未動.

## 最近一次驗證

- 日期: 2026-11-17,套件版本 1.0.64(未改版號). 全套測試 `mocha --parallel "test/*.test.mjs"`: 119 passing(既有53 + 新增66), 0 failing, 0 pending; eslint(專案設定)對新增與修改檔無錯誤; 第三方獨立審(terra)發現之屬實項已修並補測試.
