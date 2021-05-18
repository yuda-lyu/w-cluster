import get from 'lodash/get'
import each from 'lodash/each'
import map from 'lodash/map'
import join from 'lodash/join'
import values from 'lodash/values'
import isnum from 'wsemi/src/isnum.mjs'
import cint from 'wsemi/src/cint.mjs'
import kmeds from 'k-medoids'
import kmeans from 'ml-kmeans'


function kMedoids(data, kNumber) {

    //kp
    let kp = {}
    each(data, (v, k) => {
        let key = getKey(v)
        kp[key] = k
    })

    //getKey
    function getKey(v) {
        let key = join(v, ':')
        return key
    }

    //getInstance
    let intance = kmeds.Clusterer.getInstance(data, kNumber)

    //cluster
    let rs = intance.getClusteredData()
    rs = map(rs, (gs) => {
        return map(gs, (v) => {
            let key = getKey(v)
            let ind = kp[key]
            return ind
        })
    })

    return rs
}


function kMeans(data, kNumber) {


    let r = kmeans(data, kNumber)
    //k         [ 0, 1, 2, 3 ]
    //clusters: [ 0, 0, 1, 0 ]

    let gs = {}
    each(r.clusters, (v, k) => {
        if (!gs[v]) {
            gs[v] = []
        }
        gs[v].push(k)
    })

    //values
    let rs = values(gs)

    return rs
}


// @param {Array} data 輸入數據陣列
// @param {Object} [opt={}] 輸入設定物件，預設{}
// @param {Number} [opt.kNumber=2] 輸入指定分群數整數，不能超過數據的長度，預設2
// @param {String} [opt.mode='k-medoids'] 輸入分群方法字串，可為'k-means'、'k-medoids'，k-means受初始隨機群中心影響較大，預設'k-medoids'
// @return {Array} 回傳分群後各群所屬items的指標陣列
function WClusterMat(data, opt = {}) {

    //kNumber
    let kNumber = get(opt, 'kNumber')
    if (!isnum(kNumber)) {
        kNumber = 2
    }
    else {
        kNumber = cint(kNumber)
    }

    //mode
    let mode = get(opt, 'mode')
    if (mode !== 'k-medoids' && mode !== 'k-means') {
        mode = 'k-medoids'
    }

    let rs
    if (mode === 'k-medoids') {
        rs = kMedoids(data, kNumber)
    }
    else if (mode === 'k-means') {
        rs = kMeans(data, kNumber)
    }
    else {
        throw new Error('invalid mode')
    }

    return rs
}


export default WClusterMat
