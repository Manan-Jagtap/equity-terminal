/* Technical indicators on the price series.
   Series shape: [{ i, close }, ...]. SMA additions mutate-by-copy. */

export function sma(arr, n) {
  return arr.map((d, i) => {
    if (i < n - 1) return { ...d, [`sma${n}`]: null };
    let s = 0;
    for (let j = i - n + 1; j <= i; j++) s += arr[j].close;
    return { ...d, [`sma${n}`]: +(s / n).toFixed(1) };
  });
}

export function rsiCalc(arr, n = 14) {
  let g = 0, l = 0;
  for (let i = 1; i <= n; i++) {
    const c = arr[i].close - arr[i - 1].close;
    if (c >= 0) g += c; else l -= c;
  }
  let ag = g / n, al = l / n;
  for (let i = n + 1; i < arr.length; i++) {
    const c = arr[i].close - arr[i - 1].close;
    ag = (ag * (n - 1) + Math.max(c, 0)) / n;
    al = (al * (n - 1) + Math.max(-c, 0)) / n;
  }
  return al === 0 ? 100 : 100 - 100 / (1 + ag / al);
}

export function technicals(co) {
  let s = sma(co.series, 20);
  s = sma(s, 50);
  const last = s[s.length - 1];
  return {
    data: s,
    rsi: rsiCalc(co.series),
    hi: Math.max(...co.series.map(d => d.close)),
    lo: Math.min(...co.series.map(d => d.close)),
    last: last.close,
    aboveSMA50: last.sma50 ? last.close > last.sma50 : false,
    aboveSMA20: last.sma20 ? last.close > last.sma20 : false,
  };
}
