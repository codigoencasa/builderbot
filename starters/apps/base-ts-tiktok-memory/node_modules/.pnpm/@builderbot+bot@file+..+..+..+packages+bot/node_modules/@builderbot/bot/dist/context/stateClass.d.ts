type Context = {
    from: string;
};
type StateValue = Record<string, any>;
declare class SingleState {
    private STATE;
    constructor();
    /**
     * Updates the state for a given context.
     * @param ctx - The context for which to update the state.
     * @returns A function that takes a key-value object to update the state.
     */
    updateState: (ctx?: Context) => ((keyValue: StateValue) => Promise<void>);
    /**
     * Retrieves the state for a given context.
     * @param from - The identifier for the context.
     * @returns A function that returns the state.
     */
    getMyState: (from: string) => (() => StateValue | undefined);
    /**
     * Retrieves a specific property from the state of a given context.
     * @param from - The identifier for the context.
     * @returns A function that takes a property name and returns its value.
     */
    get: (from: string) => ((prop: string) => any);
    /**
     * Retrieves all states.
     * @returns An iterator for the values of the state map.
     */
    getAllState: () => IterableIterator<StateValue>;
    /**
     * Clears the state for a given context.
     * @param from - The identifier for the context.
     * @returns A function that clears the state.
     */
    clear: (from: string) => (() => boolean);
    /**
     *
     * @returns
     */
    clearAll: () => void;
}
export { SingleState };
//# sourceMappingURL=stateClass.d.ts.map