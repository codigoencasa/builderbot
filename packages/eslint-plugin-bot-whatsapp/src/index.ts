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
