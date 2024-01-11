import { DialogFlowContext } from './dialogflow.class'

/**
 * Crear instancia de clase Bot
 * @param {*} args
 * @returns
 */
const createBotDialog = async ({ database, provider }) => new DialogFlowContext(database, provider)

export { createBotDialog, DialogFlowContext }
