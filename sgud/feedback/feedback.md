# 回饋

任務中發現之自有套件、全域技能、全域設定之調整與抽提提案(只增不改;處置結果另記一列並寫明承接哪一列).

| # | 日期 | 類別 | 對象 | 內容 | 依據 |
|---|---|---|---|---|---|
| 1 | 2026-11-17 | 自有套件 | wsemi | 請公開匯出共用之opt解析函數(現為內部 `_optVal.mjs`,「本檔為內部使用,不由index匯出」),使各套件能依跨套件規格〈輸入參數之檢測機制〉K3統一實作 `opt.debug` 警告(各函數不各自手寫); w-cluster 之 e-means 因此暫未實作 `opt.debug`,其opt鍵之非預期輸入已依K3靜默改用預設 | `node_modules/wsemi/src/_optVal.mjs` 檔頭; `sgud/rule/rulebook.md` R-EM-04 已知限制 |
| 2 | 2026-11-17 | 全域設定 | 跨套件規格〈輸入參數之檢測機制〉K3 | K3規定opt鍵超出範圍視為未給、改用預設; 但「上限取決於資料之opt鍵」(如分群數 `kNumber` 須不超過資料列數)之超出範圍,靜默改用預設可能掩蓋呼叫端之錯誤(要求100群卻得到2群). 建議於規格明訂此類(跨資料依賴之範圍,對照V10跨鍵依賴)之處置: 維持K3改用預設、或視為無效報錯. w-cluster 之e-means暫依K3字面(改用預設2),請裁示 | `src/WClusterMat.mjs` 之 `kEmeans`; `test/unit-eMeans.test.mjs` 之「K3: kNumber非1..n之整數時視為未給」 |
| 3 | 2026-11-17 | 全域技能 | role-coder-for-test | 技能 §3 要求測試檔以 `unit-`/`api-`/`e2e-` 前綴分層,但本庫既有測試檔(`kMeans.test.mjs`、`PCA.test.mjs` 等)皆無前綴; 新增檔依技能加前綴而與既有並存. 建議技能註明「既有無前綴之套件,新增檔採前綴、既有不強制改名」或由主控統一安排改名 | `test/` 目錄現況 |
| 4 | 2026-11-17 | 全域設定 | 主控守門與長任務啟動 | 背景長任務(多設定依序之評測)需把進度寫入log, 但守門僅放行 `> /dev/null` 而擋 `>`/`>>` 重導向; 本輪以暫存 node 驅動腳本(`spawnSync` 依序經 quiet-run 取鎖, 以 `fs.appendFileSync` 寫log)啟動. 建議提供標準之 detached 驅動工具(依序執行多條命令、各自取鎖、log落檔、完成旗標), 避免各agent重寫 | 本輪 `./tmp/clu508/runInit.mjs`(已清除); 守門訊息「bash-write」 |
| 5 | 2026-11-17 | 全域技能 | role-coder-for-validate | L3「前後輸出對拍」缺可直接套用之作法: 基準以 `git archive HEAD src` 解到 `./tmp/`(不 stash/checkout), 以動態 `import()` 載入兩份 `src` 逐位比對(typed array 比 Buffer、物件比 `JSON.stringify`); 陷阱: 模組命名空間之預設匯出在 `.default`, 漏寫時兩邊皆拋同型錯誤而被判相同或僅因錯誤訊息含變數名而被判相異, 須另印「結果為錯誤」之警示. 建議補入技能 | `sgud/exp/experience.md` 〈2026-11-17 e-means之初始化選項〉節 |
