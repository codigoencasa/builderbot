import { generateRef, generateRefSerialize } from '../../utils/hash';

interface Options {
  media?: string;
  buttons?: any[]; // Replace 'any' with a more specific type if possible
  capture?: boolean;
}

interface ToCtxParams {
  body: string;
  from: string;
  prevRef?: string;
  keyword?: string;
  options?: Options;
  index?: number;
}

interface Context {
  ref: string;
  keyword: string;
  answer: string;
  options: Options;
  from: string;
  refSerialize: string;
}

/**
 * @deprecated
 * @param params ToCtxParams
 * @returns Context
 */
const toCtx = ({
  body,
  from,
  prevRef,
  keyword,
  options = {},
  index,
}: ToCtxParams): Context => {
  return {
    ref: generateRef(),
    keyword: prevRef ?? keyword,
    answer: body,
    options: options,
    from,
    refSerialize: generateRefSerialize({ index, answer: body }),
  };
};

export { toCtx };