class GlobalState {
    STATE = new Map()
    RAW = {}
    constructor() {}

    /**
     *
     * @param {*} ctx
     * @returns
     */
    updateState = () => {
        const currentStateByFrom = this.STATE.get('__global__')
        return (keyValue) => this.STATE.set('__global__', { ...currentStateByFrom, ...keyValue })
    }

    /**
     *
     * @returns
     */
    getMyState = () => {
        return () => this.STATE.get('__global__')
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
    clear = () => {
        return () => this.STATE.delete('__global__')
    }
}

module.exports = GlobalState
