// Verify the latest Vercel deploy contains the new Tydro fallback code by
// scanning served JS chunks for marker strings only present in the new
// fetchReserveBalances/fetchTokenBalance implementation.
const base = 'https://inkscope-one.vercel.app';
const markers = ['trying balanceOf', 'balanceOf failed for', 'getUserReserveData failed'];

const html = await (await fetch(base)).text();
const srcs = [...new Set([...html.matchAll(/src="(\/_next\/static\/[^"]+\.js)"/g)].map((m) => m[1]))];
console.log('SCRIPT_CHUNKS:' + srcs.length);

let scanned = 0;
let hits = 0;
for (const src of srcs) {
  if (scanned >= 40) break;
  scanned++;
  try {
    const code = await (await fetch(base + src)).text();
    if (markers.some((m) => code.includes(m))) {
      hits++;
      console.log('NEW_CODE_IN:' + src);
    }
  } catch {
    // chunk fetch failed — skip
  }
}
console.log('SCANNED:' + scanned + ' HITS:' + hits);
if (hits === 0) console.log('RESULT: new Tydro fallback code NOT found in served bundles (deploy may still be building, or markers split across chunks)');
