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
        [-1.704002697669786, 0.43087564048799354],
        [-0.2509699164590232, -1.1519035967558147],
        [1.9913098008410954, 0.23244503334983269],
        [-0.03633718671228592, 0.48858292291798827]
    ]

    it(`should return '${JSON.stringify(clmat)}' when input ${JSON.stringify(mat)}, { nCompNIPALS: 2 }`, async function() {
        let r = await WCluster.PCA(mat, { nCompNIPALS: 2 })
        assert.strict.deepStrictEqual(r, clmat)
    })

    let mat2 = [
        [40, 50, 60],
        [50, 70, 60],
        [80, 70, 90],
        [50, 60, 80]
    ]
    let clmat2 = [
        [-1.704002697669786, 0.43087564048799354],
        [-0.2509699164590232, -1.1519035967558147],
        [1.9913098008410954, 0.23244503334983269],
        [-0.03633718671228592, 0.48858292291798827]
    ]

    it(`should return '${JSON.stringify(clmat2)}' when input ${JSON.stringify(mat2)}, { nCompNIPALS: 2 }`, async function() {
        let r = await WCluster.PCA(mat2, { nCompNIPALS: 2 })
        assert.strict.deepStrictEqual(r, clmat2)
    })

    let mat3 = [
        [40, 50, 60],
        [50, 70, 60],
        [80, 70, 90],
        [50, 60, 80]
    ]
    let clmat3 = [
        [-1.704002697669786, 0.43087564048799354],
        [-0.2509699164590232, -1.1519035967558147],
        [1.9913098008410954, 0.23244503334983269],
        [-0.03633718671228592, 0.48858292291798827]
    ]

    it(`should return '${JSON.stringify(clmat3)}' when input ${JSON.stringify(mat3)}, { nCompNIPALS: 2 }`, async function() {
        let r = await WCluster.PCA(mat3, { nCompNIPALS: 2 })
        assert.strict.deepStrictEqual(r, clmat3)
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
