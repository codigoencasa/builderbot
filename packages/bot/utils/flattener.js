const flatObject = (listArray = []) => {
    const cbNestedList = Array.isArray(listArray) ? listArray : []

    if (!cbNestedList.length) return {}

    const cbNestedObj = cbNestedList.map(({ ctx }) => ctx?.callbacks).filter(Boolean)

    const flatObj = cbNestedObj.reduce((acc, current) => {
        const keys = Object.keys(current)
        const values = Object.values(current)

        keys.forEach((key, i) => {
            // acc[key] = values[i](a,b,c)
            acc[key] = values[i]
        })

        return acc
    }, {})

    return flatObj
}

module.exports = { flatObject }
