import type { TFlow } from '../types';
/**
 * Convierte una lista de objetos anidados en un objeto plano,
 * utilizando las funciones de devolución de llamada proporcionadas.
 * @param listArray Lista de objetos anidados.
 * @returns Objeto plano resultante.
 */
declare const flatObject: <P>(listArray?: TFlow<P>[]) => Record<string, Function>;
export default flatObject;
//# sourceMappingURL=flattener.d.ts.map