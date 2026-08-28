// Check the live Inkscope deployment (Vercel).
const url = process.argv[2] || 'https://inkscope-one.vercel.app';
try {
  const res = await fetch(url, { redirect: 'follow' });
  console.log('STATUS:' + res.status);
  console.log('FINAL_URL:' + res.url);
  const text = await res.text();
  const title = text.match(/<title>(.*?)<\/title>/i);
  console.log('TITLE:' + (title ? title[1].trim() : '(none)'));
  console.log('CONTAINS_INKSCOPE:' + /inkscope/i.test(text));
  console.log('HAS_NEXT_DATA:' + text.includes('__NEXT_DATA__'));
} catch (err) {
  console.log('FETCH_ERROR:' + (err.cause?.message || err.message));
  process.exit(1);
}
