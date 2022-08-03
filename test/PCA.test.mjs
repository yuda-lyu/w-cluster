import assert from 'assert'
import WCluster from '../src/WCluster.mjs'


describe(`PCA`, function() {

    let mat = [
        [40, 50, 60],
        [50, 70, 60],
        [80, 70, 90],
        [50, 60, 80]
    ]
    let clmat = [
        [-22.27637140016484, -4.7649452046492735],
        [-9.12778006150881, 12.303870466192656],
        [31.31672176507748, 0.2183960452169238],
        [0.08742969659617117, -7.757321306760306]
    ]

    it(`should return '${JSON.stringify(clmat)}' when input ${JSON.stringify(mat)}, { nCompNIPALS: 2 }`, async function() {
        let r = await WCluster.PCA(mat, { nCompNIPALS: 2 })
        assert.strict.deepStrictEqual(r, clmat)
    })

    it(`should return 'Error: data is not eff. array' when input 123`, async function() {
        let r = ''
        await WCluster.PCA(123)
            .catch((err) => {
                r = err.toString()
            })
        let rr = 'Error: data is not eff. array'
        assert.strict.deepStrictEqual(r, rr)
    })

    it(`should return 'Error: data is not eff. array' when input 123.456`, async function() {
        let r = ''
        await WCluster.PCA(123.456)
            .catch((err) => {
                r = err.toString()
            })
        let rr = 'Error: data is not eff. array'
        assert.strict.deepStrictEqual(r, rr)
    })

    it(`should return 'Error: data is not eff. array' when input '123'`, async function() {
        let r = ''
        await WCluster.PCA('123')
            .catch((err) => {
                r = err.toString()
            })
        let rr = 'Error: data is not eff. array'
        assert.strict.deepStrictEqual(r, rr)
    })

    it(`should return 'Error: data is not eff. array' when input '123.456'`, async function() {
        let r = ''
        await WCluster.PCA('123.456')
            .catch((err) => {
                r = err.toString()
            })
        let rr = 'Error: data is not eff. array'
        assert.strict.deepStrictEqual(r, rr)
    })

    it(`should return 'Error: data is not eff. array' when input true`, async function() {
        let r = ''
        await WCluster.PCA(true)
            .catch((err) => {
                r = err.toString()
            })
        let rr = 'Error: data is not eff. array'
        assert.strict.deepStrictEqual(r, rr)
    })

    it(`should return 'Error: data is not eff. array' when input ''`, async function() {
        let r = ''
        await WCluster.PCA('')
            .catch((err) => {
                r = err.toString()
            })
        let rr = 'Error: data is not eff. array'
        assert.strict.deepStrictEqual(r, rr)
    })

    it(`should return 'Error: data is not eff. array' when input []`, async function() {
        let r = ''
        await WCluster.PCA([])
            .catch((err) => {
                r = err.toString()
            })
        let rr = 'Error: data is not eff. array'
        assert.strict.deepStrictEqual(r, rr)
    })

    it(`should return 'Error: data is not eff. array' when input {}`, async function() {
        let r = ''
        await WCluster.PCA({})
            .catch((err) => {
                r = err.toString()
            })
        let rr = 'Error: data is not eff. array'
        assert.strict.deepStrictEqual(r, rr)
    })

    it(`should return 'Error: data is not eff. array' when input null`, async function() {
        let r = ''
        await WCluster.PCA(null)
            .catch((err) => {
                r = err.toString()
            })
        let rr = 'Error: data is not eff. array'
        assert.strict.deepStrictEqual(r, rr)
    })

    it(`should return 'Error: data is not eff. array' when input undefined`, async function() {
        let r = ''
        await WCluster.PCA(undefined)
            .catch((err) => {
                r = err.toString()
            })
        let rr = 'Error: data is not eff. array'
        assert.strict.deepStrictEqual(r, rr)
    })

})
