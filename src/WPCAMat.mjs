
import get from 'lodash/get'
import size from 'lodash/size'
import isearr from 'wsemi/src/isearr.mjs'
import isbol from 'wsemi/src/isbol.mjs'
import isnum from 'wsemi/src/isnum.mjs'
import cint from 'wsemi/src/cint.mjs'
import { PCA } from 'ml-pca'


function WPCAMat(data, opt = {}) {

    //check
    if (!isearr(data)) {
        throw new Error('data is not eff. array')
    }

    //scale
    let scale = get(opt, 'scale')
    if (!isbol(scale)) {
        scale = true //true: divide by the standard deviation
    }

    //nCompNIPALS
    let nCompNIPALS = get(opt, 'nCompNIPALS')
    if (!isnum(nCompNIPALS)) {
        nCompNIPALS = 2 //with NIPALS. 指定PCA降維后的特徵數, 也就是降維后的維度
    }
    nCompNIPALS = cint(nCompNIPALS)

    //n
    let n = size(get(data, 0, []))

    //check
    if (n === 0) {
        throw new Error('invalid dimension of data')
    }

    //check
    if (nCompNIPALS > n) {
        throw new Error(`nCompNIPALS[${nCompNIPALS}] is more than the dimension[${n}] of data`)
    }

    //pca
    let method = 'NIPALS' //SVD NIPALS
    let pca = new PCA(data, { method, scale, nCompNIPALS })

    //transform
    let tf = pca.predict(data)

    //inverse_transform
    let itf = pca.invert(tf)

    //res
    let res = itf.toJSON()

    return res
}

export default WPCAMat
