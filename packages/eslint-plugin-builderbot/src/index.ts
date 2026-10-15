/**
 * LAYER: Interface
 * Contains: Src
 * Rules: Handles HTTP/CLI. Calls use cases only. No direct domain/infrastructure access.
 * BigO: O(1) score:5
 * keywords: [Src]
 * GOAL: Own the "src" concern of the eslint-plugin-builderbot package.
 */
import { rulesRecommended } from './configs/recommended'
import {
    processDynamicFlowAwait,
    processEndFlowReturn,
    processEndFlowWithFlowDynamic,
    processFallBackReturn,
    processGotoFlowReturn,
    processStateUpdateAwait,
} from './rules'

const configs = {
    recommended: {
        rules: rulesRecommended,
    },
}
const rules = {
    'func-prefix-goto-flow-return': {
        meta: {
            fixable: 'code',
        },
        create: processGotoFlowReturn,
    },
    'func-prefix-fall-back-return': {
        meta: {
            fixable: 'code',
        },
        create: processFallBackReturn,
    },
    'func-prefix-end-flow-return': {
        meta: {
            fixable: 'code',
        },
        create: processEndFlowReturn,
    },
    'func-prefix-dynamic-flow-await': {
        meta: {
            fixable: 'code',
        },
        create: processDynamicFlowAwait,
    },
    'func-prefix-state-update-await': {
        meta: {
            fixable: 'code',
        },
        create: processStateUpdateAwait,
    },
    'func-prefix-endflow-flowdynamic': {
        meta: {
            fixable: 'code',
        },
        create: processEndFlowWithFlowDynamic,
    },
}

export { rules, configs }
