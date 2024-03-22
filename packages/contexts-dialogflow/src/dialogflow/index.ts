import { DialogFlowContext } from './dialogflow.class'
import type { ParamsDialogFlow } from '../types'

/**
 * Crear instancia de clase Bot
 * @param {*} args
 * @returns
 */
const createBotDialog = async ({ database, provider, options }: ParamsDialogFlow) =>
    new DialogFlowContext(database, provider, options)

export { createBotDialog }
