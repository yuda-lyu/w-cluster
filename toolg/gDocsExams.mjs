import fs from 'fs'
import _ from 'lodash-es'
import getFiles from 'w-package-tools/src/getFiles.mjs'
import getPks from 'w-package-tools/src/getPks.mjs'


let fdSrc = './examples/'
let fdTar = './docs/examples/'


function main() {
    //把example裡面cdn更換, 再複製到docs的example內, 作為日後發佈為靜態網站

    //pks
    let pks = getPks()

    //url
    let url = `https://cdn.jsdelivr.net/npm/w-cluster@${pks.version}/dist/w-cluster.umd.js`
    let urlww = `https://cdn.jsdelivr.net/npm/w-cluster@${pks.version}/dist/w-cluster.wk.umd.js`

    //mkdirSync
    if (!fs.existsSync(fdTar)) {
        fs.mkdirSync(fdTar)
    }

    //getFiles
    let ltfs = getFiles(fdSrc)

    _.each(ltfs, function(v) {

        //fn
        let fn = fdSrc + v

        //c
        let c = fs.readFileSync(fn, 'utf8')

        //replace
        let r
        r = `../dist/w-cluster.umd.js`
        c = c.replace(r, url)
        r = `../dist/w-cluster.wk.umd.js`
        c = c.replace(r, urlww)

        //write
        //console.log(c)
        fs.writeFileSync(fdTar + v, c, 'utf8')

    })

}
main()
