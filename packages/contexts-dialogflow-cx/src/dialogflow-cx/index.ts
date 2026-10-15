/**
 * LAYER: Infrastructure
 * Contains: DialogFlowContextCX, ParamsDialogFlowCX
 * Rules: Implements ports from Application. Can use any framework.
 * BigO: O(1) score:5
 * keywords: [DialogFlowContextCX, ParamsDialogFlowCX]
 * GOAL: Own the "dialogflow cx" concern of the contexts-dialogflow-cx package.
 */
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
