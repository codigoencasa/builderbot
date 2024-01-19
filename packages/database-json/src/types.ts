export interface JsonFileAdapterOptions {
    filename: string
}

export interface HistoryEntry {
    ref: string
    keyword: string
    answer: any
    refSerialize: string
    from: string
    options: any
}
