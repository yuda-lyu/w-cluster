import get from 'lodash-es/get'
import each from 'lodash-es/each'
import size from 'lodash-es/size'
// import take from 'lodash-es/take'
import map from 'lodash-es/map'
import values from 'lodash-es/values'
import dtpick from 'wsemi/src/dtpick.mjs'
import isnum from 'wsemi/src/isnum.mjs'
import isearr from 'wsemi/src/isearr.mjs'
import iseobj from 'wsemi/src/iseobj.mjs'
import cint from 'wsemi/src/cint.mjs'
import WPCAMat from './WPCAMat.mjs'
import WClusterMat from './WClusterMat.mjs'


function getEffKeys(ltdt) {
    let ks = {}
    each(ltdt, (dt) => {
        each(dt, (v, k) => {
            if (!ks[k]) {
                ks[k] = 0
            }
            if (ks[k] === 0 && isnum(v)) {
                ks[k] = 1
            }
            if (ks[k] === 1 && !isnum(v)) {
                ks[k] = -1
            }
        })
    })
    let r = []
    each(ks, (v, k) => {
        if (v === 1) {
            r.push(k)
        }
    })
    return r
}


function getEffData(ltdt, ks) {
    let rs = map(ltdt, (dt) => {
        let cs = dtpick(dt, ks)
        let vs = values(cs)
        return vs
    })
    return rs
}


function WClusterCore(data, opt = {}) {

    //check
    if (!isearr(data)) {
        throw new Error('data is not eff. array')
    }

    //kNumber
    let kNumber = get(opt, 'kNumber')
    if (!isnum(kNumber)) {
        kNumber = 2
    }
    kNumber = cint(kNumber)

    //nCompNIPALS
    let nCompNIPALS = get(opt, 'nCompNIPALS')
    if (!isnum(nCompNIPALS)) {
        nCompNIPALS = 2
    }
    nCompNIPALS = cint(nCompNIPALS)
    // console.log('nCompNIPALS', nCompNIPALS)

    //mode, 由WDataCluster檢核與給予預設值
    let mode = get(opt, 'mode')

    let type = ''
    let n = size(data)
    let iobj = 0
    let imat = 0
    each(data, (v) => {
        if (iseobj(v)) {
            iobj += 1
        }
        else if (isearr(v)) {
            imat += 1
        }
    })
    if (iobj === n) {
        type = 'obj'
        // return WClusterCore(data, opt)
    }
    else if (imat === n) {
        type = 'mat'
        // return WClusterMat(data, opt)
    }
    else {
        throw new Error('data is not of the same type')
    }

    let ks = null
    let mat
    if (type === 'obj') {

        //getEffKeys
        ks = getEffKeys(data)

        //getEffData
        mat = getEffData(data, ks)

    }
    else {
        mat = data
    }

    //WPCAMat
    let pcad = WPCAMat(mat, { nCompNIPALS })

    // //reduce
    // pcad = map(pcad, (v) => {
    //     v = take(v, nCompNIPALS)
    //     return v
    // })
    // // console.log('pcad', pcad)

    //WClusterMat
    let ginds = WClusterMat(pcad, { kNumber, mode })

    //gmat
    let gmat = map(ginds, (inds) => {
        return map(inds, (ind) => {
            return pcad[ind]
        })
    })

    //gltdt
    let gltdt = map(ginds, (inds) => {
        return map(inds, (ind) => {
            return data[ind]
        })
    })

    return {
        keys: ks,
        ginds, //各群所屬樣本指標
        gmat, //各群所屬主成份分析轉換後樣本數據
        gltdt, //各群所屬原始樣本數據
    }
}


export default WClusterCore
