const flatObject = (listArray = []) => {
    const cbNestedList = Array.isArray(listArray) ? listArray : []

    if (!listArray.length) return {}

    const cbNestedObj = cbNestedList.map(({ ctx }) => ctx?.callbacks).filter((i) => !!i)
    const queueCb = cbNestedObj.reduce((acc, current) => {
        const getKeys = Object.keys(current)
        const parse = getKeys.map((icb, i) => ({
            [icb]: Object.values(current)[i],
        }))
        return [...acc, ...parse]
    }, [])

    const flatObj = {}
    for (const iteration of queueCb) {
        const [keyCb] = Object.keys(iteration)
        flatObj[keyCb] = iteration[keyCb]
    }
    return flatObj
}

module.exports = { flatObject }
