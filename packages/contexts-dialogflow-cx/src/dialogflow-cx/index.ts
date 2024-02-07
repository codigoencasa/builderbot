import { DialogFlowContext } from './dialogflow-cx.class'
import { ParamsDialogFlowCX } from '../types'

/**
 * Crear instancia de clase Bot
 * @param {*} args
 * @returns
 */
const createBotDialog = async ({ database, provider, options }: ParamsDialogFlowCX) =>
    new DialogFlowContext(database, provider, options)

export { createBotDialog }
