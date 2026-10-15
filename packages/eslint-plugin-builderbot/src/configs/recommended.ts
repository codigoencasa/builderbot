/**
 * LAYER: Interface
 * Contains: Recommended
 * Rules: Handles HTTP/CLI. Calls use cases only. No direct domain/infrastructure access.
 * BigO: O(1) score:5
 * keywords: [Recommended]
 * GOAL: Own the "recommended" concern of the eslint-plugin-builderbot package.
 */
export const rulesRecommended = {
    'builderbot/func-prefix-goto-flow-return': 2,
    'builderbot/func-prefix-end-flow-return': 2,
    'builderbot/func-prefix-dynamic-flow-await': 2,
    'builderbot/func-prefix-state-update-await': 2,
    'builderbot/func-prefix-fall-back-return': 2,
    'builderbot/func-prefix-endflow-flowdynamic': 2,
}
