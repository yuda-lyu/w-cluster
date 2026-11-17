# 狀態(現況)

只記現況,不寫過程(過程見 `sgud/exp/experience.md`). 規則藍圖見 `sgud/rule/rulebook.md`.

## 功能現況

| 功能 | 狀態 | 規則帳本 | 測試/指令 |
|---|---|---|---|
| `WCluster.PCA` | 既有,未動 | - | `test/PCA.test.mjs` |
| `WCluster.cluster` mode `k-means`(ml-kmeans)、`k-medoids`(FasterPAM/simple) | 既有,行為與輸出未動 | R-EM-03 | `test/kMeans.test.mjs`、`test/kMedoids-*.test.mjs`、`test/jaccardBitset.test.mjs` |
| `WCluster.cluster` mode `e-means`(EMA小批次k-means,論文arXiv:2611.09501之JavaScript移植,純CPU單執行緒) | 完成 | R-EM-02、R-EM-03、R-EM-04 | `test/unit-eMeans.test.mjs`(80案); 變異證明 `node test/tools/mutate-eMeans.mjs`(62項全被殺) |
| e-means之 `opt.init`(`'random'`預設/`'k-means++'`, 貪婪k-means++, 本庫新增, 非論文作法) | 完成(預設仍 `'random'`, 是否改預設待裁示) | R-EM-08 | 同上(「e-means: init選項」8案、API 2案、Lloyd 區 `initKMeansPP` 與 `init: 'kmeans++'` 4案; 變異M43~M59) |
| 共用最近中心核心 `src/WClusterNearest.mjs`、小工具與復活分裂與貪婪k-means++初始化 `src/WClusterUtil.mjs` | 完成 | R-EM-01、R-EM-08 | 同上 |
| Lloyd k-means對照組 `src/WClusterLloyd.mjs`(僅供評測與測試,不由WCluster匯出; `initKMeansPP` 自Util匯入並再匯出) | 完成 | R-EM-01、R-EM-06 | 同上 |
| e-means評測 `toolg/evalEmeans/`(資料產生、設定表、執行器、報告彙整、記憶體量測、初始化比較)與 `REPORT.md` | 完成(11組合成資料,5~8 seeds; 初始化比較同11組,5~24 seeds,另4組小資料100~200 seeds) | R-EM-06、R-EM-08 | 重跑指令見規則帳本 R-EM-06 |

## e-means評測現況(摘要; 完整數據見 `toolg/evalEmeans/REPORT.md`)

- 以同一核心、同一組初始中心比較Lloyd@25: e-means約1~3個走訪即達Lloyd@25之測試誤差(論文1.4~2.6),距離計算次數少8.3~25倍以上,每走訪CPU成本為Lloyd之1.03~1.2倍(計算量大之設定),CPU時間少約4~19倍. 結論: 加速來自演算法本身,與GPU無關.
- 不成立處: 分離型混合資料上Lloyd(k-means++)@25之誤差低於e-means; 小k、小n、低維增益小; 規模遠小於論文; 資料皆為合成.

## e-means初始化(`init`)評測現況(摘要; 完整數據見 `toolg/evalEmeans/REPORT.md`〈e-means之初始化〉)

- 結論: k-means++ 對 e-means 部分有效, 已添加為選項(預設仍隨機). 品質: 大資料分離型6組中4組顯著較佳(測試誤差低5.0%~8.1%, T=5), 小資料落入局部解之比例 31%->0%、40%->0%、56%->6%、97%->34%; 不劣化: 無結構與重疊資料差異-0.03%~+0.09%(雜訊內); 成本: 初始化約3.6~7.0個走訪之距離計算, 總距離計算次數為Lloyd(隨機)@25之0.34~0.48倍, CPU時間0.65~0.85倍(未達事先定之0.5門檻), 為隨機e-means之2.5~4.0倍; 對Lloyd(k-means++)@25之CPU時間0.45~0.53倍且誤差相同或較低(11組中10組).
- 適用條件(README已載): 群分離明顯之資料(小資料、中等資料, 或分離明顯且k為數十以上); 無群結構、重疊、n/k很大之低維、k很小者無益.

## 已知缺口與待辦

- **待裁示**: `init` 預設是否改為 `'k-means++'`(數據見上與 `REPORT.md`; 取捨為CPU加速由約4~20倍降為約1.2~1.5倍, 換得群分離明顯資料較不易落入局部解).
- `initKMeansPP` 之距離迴圈未用最近中心核心之dot技巧與分塊, 每次距離計算之CPU時間約為Lloyd(含指派與更新之平均)之1.8~2.7倍(11組評測之 `initCpuMs/initDist` 對 Lloyd@25 之 `cpuMs/dist`; `init: 'k-means++'` 之CPU比因此高於距離次數比); 若要降低須改該共用函數且保持Lloyd對照組之輸出逐位不變(本輪未做, 屬效能優化而非需求).
- `init: 'k-means++'` 於n很大(百萬列以上)未驗證: `initKMeansPP` 配置4個長度n之Float64Array(約32n位元組)並做 (2+ln k)*k 次全資料掃描.
- `opt.debug`(輸入規格K3之警告)未實作,待wsemi公開共用opt解析函數(見 `sgud/feedback/feedback.md` 第1列).
- e-means路徑之輸入檢測限於e-means自身: 預設之PCA前處理(`usePCA: true`)、`nCompNIPALS` 轉換、物件列之欄位篩選(`getEffKeys`,結果依列順序)沿用既有行為,數字字串須 `usePCA: false`; 統一改善須動既有mode之行為,待裁示.
- 最近中心之距離以 `|c|^2 - 2x·c` 比較(與Faiss同法),已由 `kEmeans` 置中與限定資料絕對值<=1e100緩解; 內部直接呼叫者須自行確保資料已置中(見R-EM-01).
- 未驗證: 論文規模(百萬至百億列)之行為; 真實嵌入資料(無授權可查證之公開資料集納入); 瀏覽器端(UMD/web worker)之 `mode: 'e-means'`(未重建 `dist/`,未實跑).
- **`package.json` 之 `main` 指向 `dist/w-cluster.umd.js`,發布前須重建**(舊 `dist/` 不認得 `mode: 'e-means'`,會因既有之「未知mode改用k-medoids」而靜默跑k-medoids); 發布與建置(`dist/`、`docs/`、版號)由套件擁有者之自動化流程處理,本輪未動.

## 最近一次驗證

- 日期: 2026-11-17,套件版本 1.0.65(未改版號). 全套測試 `mocha --parallel "test/*.test.mjs"`: 133 passing(既有53 + e-means 80), 0 failing, 0 pending; 變異證明62/62被殺; 預設行為前後對拍(基準為HEAD之 `src`)540項逐位相同; eslint(專案設定)對新增與修改檔無錯誤.
