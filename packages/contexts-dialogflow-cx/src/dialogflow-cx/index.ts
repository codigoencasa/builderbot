import { DialogFlowContextCX } from './dialogflow-cx.class'
import type { ParamsDialogFlowCX } from '../types'

/**
 * Crear instancia de clase Bot
 * @param {*} args
 * @returns
 */
const createBotDialog = async ({ database, provider, options }: ParamsDialogFlowCX) =>
    new DialogFlowContextCX(database, provider, options)

export { createBotDialog }
