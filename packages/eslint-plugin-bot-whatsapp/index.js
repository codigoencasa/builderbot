const { processGotoFlowReturn } = require('./rules/processGotoFlowReturn')
const { processDynamicFlowAwait } = require('./rules/processDynamicFlowAwait')
const { processStateUpdateAwait } = require('./rules/processStateUpdateAwait')
const { processFallBackReturn } = require('./rules/processFallBackReturn')
const { processEndFlowReturn } = require('./rules/processEndFlowReturn')

module.exports = {
    configs: {
        recommended: require('./configs/recommended'),
    },
    rules: {
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
    },
}
