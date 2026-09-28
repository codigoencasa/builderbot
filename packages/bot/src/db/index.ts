/**
 * LAYER: Infrastructure
 * Contains: MemoryDB — in-memory persistence adapter
 * Rules: Implements the persistence contract. No business rules.
 * BigO: O(n) score:3
 * keywords: [MemoryDB, CoreClass]
 * GOAL: Persist conversation state in memory as the default storage adapter.
 */
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
