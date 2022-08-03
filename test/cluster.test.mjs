import assert from 'assert'
import WCluster from '../src/WCluster.mjs'


describe(`cluster`, function() {

    let mode = 'k-medoids'

    let mat = [
        [40, 50, 60],
        [50, 70, 60],
        [80, 70, 90],
        [50, 60, 80]
    ]
    let clmat = {
        'keys': null,
        'ginds': [
            [2],
            [0, 1, 3]
        ],
        'gmat': [
            [
                [31.31672176507748, 0.2183960452169238]
            ],
            [
                [-22.27637140016484, -4.7649452046492735],
                [-9.12778006150881, 12.303870466192656],
                [0.08742969659617117, -7.757321306760306]
            ]
        ],
        'gltdt': [
            [
                [80, 70, 90]
            ],
            [
                [40, 50, 60],
                [50, 70, 60],
                [50, 60, 80]
            ]
        ]
    }

    it(`should return '${JSON.stringify(clmat)}' when input ${JSON.stringify(mat)}, { mode, kNumber: 2, nCompNIPALS: 2 }`, async function() {
        let r = await WCluster.cluster(mat, { mode, kNumber: 2, nCompNIPALS: 2 })
        assert.strict.deepStrictEqual(r, clmat)
    })

    let ltdt = [
        { name: 'Cameron', a: 40, b: 50, c: 60 },
        { name: 'Buckley', a: 50, b: 70, c: 60 },
        { name: 'Paul', a: 80, b: 70, c: 90 },
        { name: 'Fawcett', a: 50, b: 60, c: 80 },
    ]
    let clltdt = {
        'keys': ['a', 'b', 'c'],
        'ginds': [
            [2],
            [0, 1, 3]
        ],
        'gmat': [
            [
                [31.31672176507748, 0.2183960452169238]
            ],
            [
                [-22.27637140016484, -4.7649452046492735],
                [-9.12778006150881, 12.303870466192656],
                [0.08742969659617117, -7.757321306760306]
            ]
        ],
        'gltdt': [
            [
                { 'name': 'Paul', 'a': 80, 'b': 70, 'c': 90 }
            ],
            [
                { 'name': 'Cameron', 'a': 40, 'b': 50, 'c': 60 },
                { 'name': 'Buckley', 'a': 50, 'b': 70, 'c': 60 },
                { 'name': 'Fawcett', 'a': 50, 'b': 60, 'c': 80 }
            ]
        ]
    }

    it(`should return '${JSON.stringify(clltdt)}' when input ${JSON.stringify(ltdt)}, { mode, kNumber: 2, nCompNIPALS: 2 }`, async function() {
        let r = await WCluster.cluster(ltdt, { mode, kNumber: 2, nCompNIPALS: 2 })
        assert.strict.deepStrictEqual(r, clltdt)
    })

    it(`should return 'Error: data is not eff. array' when input 123`, async function() {
        let r = ''
        await WCluster.cluster(123)
            .catch((err) => {
                r = err.toString()
            })
        let rr = 'Error: data is not eff. array'
        assert.strict.deepStrictEqual(r, rr)
    })

    it(`should return 'Error: data is not eff. array' when input 123.456`, async function() {
        let r = ''
        await WCluster.cluster(123.456)
            .catch((err) => {
                r = err.toString()
            })
        let rr = 'Error: data is not eff. array'
        assert.strict.deepStrictEqual(r, rr)
    })

    it(`should return 'Error: data is not eff. array' when input '123'`, async function() {
        let r = ''
        await WCluster.cluster('123')
            .catch((err) => {
                r = err.toString()
            })
        let rr = 'Error: data is not eff. array'
        assert.strict.deepStrictEqual(r, rr)
    })

    it(`should return 'Error: data is not eff. array' when input '123.456'`, async function() {
        let r = ''
        await WCluster.cluster('123.456')
            .catch((err) => {
                r = err.toString()
            })
        let rr = 'Error: data is not eff. array'
        assert.strict.deepStrictEqual(r, rr)
    })

    it(`should return 'Error: data is not eff. array' when input true`, async function() {
        let r = ''
        await WCluster.cluster(true)
            .catch((err) => {
                r = err.toString()
            })
        let rr = 'Error: data is not eff. array'
        assert.strict.deepStrictEqual(r, rr)
    })

    it(`should return 'Error: data is not eff. array' when input ''`, async function() {
        let r = ''
        await WCluster.cluster('')
            .catch((err) => {
                r = err.toString()
            })
        let rr = 'Error: data is not eff. array'
        assert.strict.deepStrictEqual(r, rr)
    })

    it(`should return 'Error: data is not eff. array' when input []`, async function() {
        let r = ''
        await WCluster.cluster([])
            .catch((err) => {
                r = err.toString()
            })
        let rr = 'Error: data is not eff. array'
        assert.strict.deepStrictEqual(r, rr)
    })

    it(`should return 'Error: data is not eff. array' when input {}`, async function() {
        let r = ''
        await WCluster.cluster({})
            .catch((err) => {
                r = err.toString()
            })
        let rr = 'Error: data is not eff. array'
        assert.strict.deepStrictEqual(r, rr)
    })

    it(`should return 'Error: data is not eff. array' when input null`, async function() {
        let r = ''
        await WCluster.cluster(null)
            .catch((err) => {
                r = err.toString()
            })
        let rr = 'Error: data is not eff. array'
        assert.strict.deepStrictEqual(r, rr)
    })

    it(`should return 'Error: data is not eff. array' when input undefined`, async function() {
        let r = ''
        await WCluster.cluster(undefined)
            .catch((err) => {
                r = err.toString()
            })
        let rr = 'Error: data is not eff. array'
        assert.strict.deepStrictEqual(r, rr)
    })

})
