class MemoryDB {
    public listHistory: any[] = []

    /**
     *
     * @param from
     * @returns
     */
    async getPrevByNumber(from: string): Promise<any> {
        const history = this.listHistory
            .slice()
            .reverse()
            .filter((i) => !!i.keyword)
        return history.find((a) => a.from === from)
    }

    /**
     *
     * @param ctx
     */
    async save(ctx: any): Promise<void> {
        this.listHistory.push(ctx)
    }
}

export { MemoryDB }
