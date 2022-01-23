export function extractAllAsyncFunctions(obj: any) {
  let props: string[] = [];
  do {
    const l = Object.getOwnPropertyNames(obj)
      .concat(Object.getOwnPropertySymbols(obj).map((s) => s.toString()))
      .sort()
      .filter(
        // eslint-disable-next-line no-loop-func
        (p, i, arr) =>
          typeof obj[p] === 'function' && // only the methods
          p !== 'constructor' && // not the constructor
          (i === 0 || p !== arr[i - 1]) && // not overriding in this prototype
          props.indexOf(p) === -1 // not overridden in a child
      );
    props = props.concat(l);
  } while (
    // eslint-disable-next-line no-cond-assign, no-param-reassign
    (obj = Object.getPrototypeOf(obj)) && // walk-up the prototype chain
    Object.getPrototypeOf(obj) // not the the Object prototype methods (hasOwnProperty, etc...)
  );
  return props;
}

export function Stringify(obj: any): string {
  if (typeof obj === 'string') {
    return obj;
  }
  // If it has a toString function
  // Execute
  if (obj.toString != null && typeof obj.toString === 'function')
    return obj.toString();
  // Otherwise, convert to JSON Object and hope it works
  // JSON Object would work for Array and Objects both usually
  if (typeof obj === 'object' || Array.isArray(obj)) {
    try {
      return JSON.stringify(obj);
    } catch (err) {
      // Do not error out
    }
  }
  // When all else fails
  return String(obj);
}

export function Objectify(str: string, returns?: string): unknown {
  const returnsP = returns?.toLowerCase();
  if (returnsP === 'boolean') return Boolean(str);
  if (returnsP === 'number') return Number(str);
  if (returnsP === 'date') return new Date(str);
  if (returnsP === 'string') return str;

  try {
    return JSON.parse(str);
  } catch (err) {
    return str as unknown;
  }
}
