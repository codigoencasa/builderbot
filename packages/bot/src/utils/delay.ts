/**
 * LAYER: Domain
 * Contains: delay — promise-based sleep helper
 * Rules: No external dependencies. Pure timing helper.
 * BigO: O(1) score:5
 * keywords: [delay]
 * GOAL: Pause execution for a given number of milliseconds.
 */
/**
 * A utility function that introduces a delay in execution.
 * @param milliseconds - The duration of the delay in milliseconds.
 * @returns A Promise that resolves after the specified delay.
 */
export const delay = (milliseconds: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, milliseconds))
}
