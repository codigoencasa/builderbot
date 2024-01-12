type Context = {
    from: string
}

type StateValue = Record<string, any>

class SingleState {
    private STATE: Map<string, StateValue> = new Map()

    constructor() {}

    /**
     * Updates the state for a given context.
     * @param ctx - The context for which to update the state.
     * @returns A function that takes a key-value object to update the state.
     */
    updateState = (ctx: Context = { from: '' }): ((keyValue: StateValue) => Promise<void>) => {
        return (keyValue: StateValue) => {
            return new Promise((resolve) => {
                const currentStateByFrom = this.STATE.get(ctx.from) || {}
                const updatedState = { ...currentStateByFrom, ...keyValue }
                this.STATE.set(ctx.from, updatedState)
                resolve()
            })
        }
    }

    /**
     * Retrieves the state for a given context.
     * @param from - The identifier for the context.
     * @returns A function that returns the state.
     */
    getMyState = (from: string): (() => StateValue | undefined) => {
        return () => this.STATE.get(from)
    }

    /**
     * Retrieves a specific property from the state of a given context.
     * @param from - The identifier for the context.
     * @returns A function that takes a property name and returns its value.
     */
    get = (from: string): ((prop: string) => any) => {
        return (prop: string) => this.STATE.get(from)?.[prop]
    }

    /**
     * Retrieves all states.
     * @returns An iterator for the values of the state map.
     */
    getAllState = (): IterableIterator<StateValue> => this.STATE.values()

    /**
     * Clears the state for a given context.
     * @param from - The identifier for the context.
     * @returns A function that clears the state.
     */
    clear = (from: string): (() => boolean) => {
        return () => this.STATE.delete(from)
    }

    /**
     *
     * @returns
     */
    clearAll = (): void => this.STATE.clear()
}

export { SingleState }
