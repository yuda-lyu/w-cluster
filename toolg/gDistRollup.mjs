import path from 'path'
import rollupFiles from 'w-package-tools/src/rollupFiles.mjs'
import rollupWorker from 'w-package-tools/src/rollupWorker.mjs'


let fdSrc = './src'
let fdTar = './dist'


async function rp() {

    await rollupFiles({ //rollupFiles預設會clean folder
        fns: 'WCluster.mjs',
        fdSrc,
        fdTar,
        nameDistType: 'kebabCase',
        // bNodePolyfill: true,
        // bMinify: false,
        globals: {
        },
        external: [
        ],
    })
        .catch((err) => {
            console.log(err)
        })

    await rollupWorker({
        name: 'WCluster', //原模組名稱, 將來會掛於winodw下
        type: 'object', //原模組輸出為物件
        funNames: ['PCA', 'cluster'],
        // target: 'old', //不支援IE11
        // bNodePolyfill: true,
        // bMinify: false,
        // bSourcemap: true, //rollupWebWorker不提供sourcemap
        // execObjectFunsByInstance: true, //各函式使用獨立實體執行
        fpSrc: path.resolve(fdSrc, 'WCluster.mjs'), //原始檔案路徑
        fpTar: path.resolve(fdTar, 'w-cluster.wk.umd.js'), //檔案輸出路徑
        hookNameDist: () => 'w-cluster',
        // nameDistType: 'kebabCase',
        formatOut: 'umd', //umd為瀏覽器端直接使用, es為供vue-cli或webpack使用
        globals: {
        },
        external: [
        ],
    })
        .catch((err) => {
            console.log(err)
        })

}
rp()
    .catch((err) => {
        console.log(err)
    })

