class SingleState {
    STATE = new Map()
    constructor() {}

    /**
     *
     * @param {*} ctx
     * @returns
     */
    updateState = (ctx = {}) => {
        const currentStateByFrom = this.STATE.get(ctx.from)
        return (keyValue) => this.STATE.set(ctx.from, { ...currentStateByFrom, ...keyValue })
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
