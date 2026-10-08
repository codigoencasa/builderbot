/**
 * LAYER: Infrastructure
 * Contains: DialogFlowContext, ParamsDialogFlow
 * Rules: Implements ports from Application. Can use any framework.
 * BigO: O(1) score:5
 * keywords: [DialogFlowContext, ParamsDialogFlow]
 * GOAL: Own the "dialogflow" concern of the contexts-dialogflow package.
 */
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
