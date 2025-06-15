export function cmpKeyed<T>(
  getKey: (elem: T) => unknown[]
): (a: T, b: T) => number {
  return (aObj: T, bObj: T) => {
    const aArr = getKey(aObj);
    const bArr = getKey(bObj);
    for (let i = 0; i < Math.max(aArr.length, bArr.length); i++) {
      const a = aArr[i];
      const b = bArr[i];
      // @ts-expect-error
      if (a < b) return -1;
      // @ts-expect-error
      if (a > b) return 1;
    }
    return 0;
  };
}
