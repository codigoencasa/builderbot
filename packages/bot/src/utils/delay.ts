export const delay = (miliseconds: number) =>
    new Promise((res) => setTimeout(res, miliseconds))
