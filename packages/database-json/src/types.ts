export interface JsonFileAdapterOptions {
    filename: string
    /**
     * Tiempo en ms para agrupar escrituras (debounce).
     * Mejora performance cuando hay muchas escrituras simultáneas.
     * Default: 0 (sin debounce, escritura inmediata)
     */
    debounceTime?: number
}

export interface HistoryEntry {
    ref: string
    keyword: string
    answer: any
    refSerialize: string
    from: string
    options: any
}
