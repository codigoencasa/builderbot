/**
 * LAYER: Application
 * Wait for an adapter without holding a dead call open if it ignores AbortSignal.
 * The underlying request may continue; its eventual result/rejection is observed
 * but cannot reach playback. Adapters should also honor the signal to save work.
 */
export const abortable = <T>(promise: Promise<T>, signal: AbortSignal): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
        const onAbort = () => reject(signal.reason ?? new Error('Operation aborted'))
        signal.addEventListener('abort', onAbort, { once: true })
        promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort))
        if (signal.aborted) onAbort()
    })
}
