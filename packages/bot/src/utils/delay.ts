/**
 * A utility function that introduces a delay in execution.
 * @param milliseconds - The duration of the delay in milliseconds.
 * @returns A Promise that resolves after the specified delay.
 */
export const delay = (milliseconds: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, milliseconds))
}
