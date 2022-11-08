class FlowClass {
    flow
    constructor(_flow) {
        this.flow = _flow
    }

    find = (message, ref = false) => {
        let keyRef = ref
        let ansRef = null
        if (!keyRef) {
            keyRef =
                this.flow.find((n) => n.keyword.includes(message))?.ref || null
        }
        ansRef = this.flow.find((n) => n.keyword === keyRef)
        if (ansRef) return ansRef
        return false
    }
}

module.exports = FlowClass
