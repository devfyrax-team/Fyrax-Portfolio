export const join = (...parts: string[]) => parts.filter(Boolean).join('/')
export default { join }
