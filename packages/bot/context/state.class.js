class SingleState {
    STATE = new Map()
    constructor() {}

    /**
     *
     * @param {*} ctx
     * @returns
     */
    updateState = (ctx = {}) => {
        return (keyValue) => {
            return new Promise((resolve) => {
                const currentStateByFrom = this.STATE.get(ctx.from)
                const updatedState = { ...currentStateByFrom, ...keyValue }
                this.STATE.set(ctx.from, updatedState)
                resolve()
            })
        }
    }

    /**
     *
     * @returns
     */
    getMyState = (from) => {
        return () => this.STATE.get(from)
    }

    /**
     *
     * @param {*} prop
     * @returns
     */
    get = (from) => {
        return (prop) => this.STATE.get(from)[prop]
    }

    /**
     *
     * @returns
     */
    getAllState = () => this.STATE.values()

    /**
     *
     * @param {*} from
     * @returns
     */
    clear = (from) => {
        return () => this.STATE.delete(from)
    }
}

module.exports = SingleState
