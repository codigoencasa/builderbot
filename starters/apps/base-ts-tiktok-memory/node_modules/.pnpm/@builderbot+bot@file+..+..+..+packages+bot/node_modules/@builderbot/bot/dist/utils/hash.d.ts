/**
 * Genera un UUID único con posibilidad de tener un prefijo.
 * @param prefix Prefijo opcional para el UUID.
 * @returns El UUID generado.
 */
declare const generateRef: (prefix?: string) => string;
/**
 * Genera un timestamp en milisegundos sin prefijo hex.
 * @returns El timestamp generado.
 */
declare const generateTime: () => number;
/**
 * Genera un HASH MD5 a partir de un objeto serializado como cadena JSON.
 * @param param0 Objeto con propiedades index, answer y keyword.
 * @returns El HASH MD5 generado.
 */
declare const generateRefSerialize: ({ index, answer, keyword, }: {
    index: number;
    answer: string | string[];
    keyword?: string | string[];
}) => string;
/**
 * Generamos un UUID único con posibilidad de tener un prefijo
 * @param prefix - Prefijo opcional para el UUID
 * @returns Un UUID único, opcionalmente con prefijo
 */
declare const generateRefProvider: (prefix?: string) => string;
/**
 * Encriptar data
 * @param data - Datos a encriptar
 * @returns Datos encriptados en base64
 */
declare const encryptData: (data: string) => string;
/**
 * Desencriptar data
 * @param encryptedData - Datos encriptados en base64
 * @returns Datos desencriptados o 'FAIL' en caso de error
 */
declare const decryptData: (encryptedData: string) => string;
/**
 *
 * @param prefix
 * @returns
 */
declare const generateRegex: (prefix: string) => RegExp;
export { generateRef, generateRefSerialize, generateTime, generateRegex, generateRefProvider, encryptData, decryptData };
//# sourceMappingURL=hash.d.ts.map