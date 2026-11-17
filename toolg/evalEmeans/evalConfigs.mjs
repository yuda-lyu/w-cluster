/**
 * e-means評測之設定表(evalRun.mjs與evalInit.mjs共用, 單一擁有者)
 *
 * seeds為演算法seed數(初始中心與洗牌), 資料固定於dataSeed
 */
const CONFIGS = {
    'gmm-sep-d64': { kind: 'gmm-sep', n: 50000, d: 64, k: 256, dataSeed: 101, seeds: 5 },
    'gmm-overlap-d32': { kind: 'gmm-overlap', n: 50000, d: 32, k: 128, dataSeed: 102, seeds: 8 },
    'gmm-zipf-d64': { kind: 'gmm-zipf', n: 50000, d: 64, k: 256, dataSeed: 103, seeds: 5 },
    'uniform-d16': { kind: 'uniform', n: 50000, d: 16, k: 128, dataSeed: 104, seeds: 8 },
    'stretched-d128': { kind: 'stretched', n: 30000, d: 128, k: 128, dataSeed: 105, seeds: 5 },
    'gmm-sep-d8-highnk': { kind: 'gmm-sep', n: 100000, d: 8, k: 64, dataSeed: 106, seeds: 8 },
    'gmm-sep-d32-small': { kind: 'gmm-sep', n: 5000, d: 32, k: 64, dataSeed: 107, seeds: 8 },
    'uniform-d2': { kind: 'uniform', n: 100000, d: 2, k: 100, dataSeed: 108, seeds: 8 },
    'gmm-sep-d16-k8': { kind: 'gmm-sep', n: 20000, d: 16, k: 8, dataSeed: 111, seeds: 8 },
    'gmm-sep-d32-ml': { kind: 'gmm-sep', n: 20000, d: 32, k: 64, dataSeed: 109, seeds: 5, ml: true },
    'uniform-d16-ml': { kind: 'uniform', n: 20000, d: 16, k: 64, dataSeed: 110, seeds: 5, ml: true },
}


export { CONFIGS }
export default CONFIGS
