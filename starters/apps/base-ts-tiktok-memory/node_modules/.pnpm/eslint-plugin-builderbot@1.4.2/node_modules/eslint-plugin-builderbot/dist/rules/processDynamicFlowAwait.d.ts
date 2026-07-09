import type { Context, INode } from '../types';
declare const processDynamicFlowAwait: (context: Context) => {
    'CallExpression[callee.name="flowDynamic"]'(node: INode): void;
};
export { processDynamicFlowAwait };
//# sourceMappingURL=processDynamicFlowAwait.d.ts.map