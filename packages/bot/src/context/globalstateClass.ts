type GlobalStateType = Record<string, any>

class GlobalState {
    public RAW: GlobalStateType
    private STATE: Map<string, GlobalStateType>

    constructor() {
        this.STATE = new Map<string, GlobalStateType>()
        this.STATE.set('__global__', {})
        this.RAW = {}
    }

    /**
     * Updates the global state with the provided key-value pairs.
     * @param keyValue - An object containing the key-value pairs to update the state with.
     * @returns A function that updates the state when called.
     */
    updateState = (): ((keyValue: GlobalStateType) => Promise<void>) => {
        return (keyValue: GlobalStateType) =>
            new Promise((resolve) => {
                const currentStateByFrom = this.STATE.get('__global__')
                const updatedState = { ...currentStateByFrom, ...keyValue }
                this.STATE.set('__global__', updatedState)
                resolve()
            })
    }

    /**
     * Retrieves the global state.
     * @returns A function that returns the global state when called.
     */
    getMyState = (): (() => GlobalStateType) => {
        return () => this.STATE.get('__global__')
    }

    /**
     * Retrieves a specific property from the global state.
     * @returns A function that returns the value of the specified property when called.
     */
    get = (): ((prop: string) => any) => {
        return (prop: string) => this.STATE.get('__global__')?.[prop]
    }

    /**
     * Retrieves all state values.
     * @returns An iterator for the values of the state.
     */
    getAllState = (): IterableIterator<GlobalStateType> => this.STATE.values()

    /**
     * Clears the global state.
     * @returns A function that clears the global state when called.
     */
    clear = (): (() => void) => {
        return () => this.STATE.set('__global__', {})
    }
}

export { GlobalState }
