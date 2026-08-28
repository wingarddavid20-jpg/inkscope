// Probe: time-range filters + cursor placement for the Nado indexer.
const SUB = '0xb22d22f9d74b78f425edcdd670ad7ce7f9aa015164656661756c740000000000';
const V1 = 'https://archive.prod.nado.xyz/v1';

async function post(body) {
  const res = await fetch(V1, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => null);
  return { status: res.status, json: j };
}

async function main() {
  const base = await post({ matches: { subaccounts: [SUB], limit: 3, desc: true } });
  const baseIdx = base.json.matches.map((m) => String(m.submission_idx)).join(',');
  console.log('base:', baseIdx);

  // cursor at top level (sibling of matches)
  for (const key of ['before', 'after']) {
    const j = await post({ matches: { subaccounts: [SUB], limit: 3, desc: true }, [key]: base.json.matches[1].submission_idx });
    const idxs = (j.json?.matches ?? []).map((m) => String(m.submission_idx)).join(',');
    console.log(`top-level ${key}= → [${idxs}] ${idxs !== baseIdx ? '⚠ CHANGED' : 'ignored'}`);
  }

  // time-ish filters inside matches (use a recent ts ~ Jul 2026 → should restrict)
  const tsJul = 1782900000; // ~2026-07-01
  for (const key of ['from_ts', 'to_ts', 'min_ts', 'max_ts', 'ts_gt', 'ts_lt', 'timestamp_gt', 'timestamp_lt', 'start_ts', 'end_ts', 'from', 'to']) {
    const body = { matches: { subaccounts: [SUB], limit: 3, desc: true } };
    body.matches[key] = tsJul;
    const j = await post(body);
    const idxs = (j.json?.matches ?? []).map((m) => String(m.submission_idx)).join(',');
    const changed = idxs !== baseIdx && idxs.length > 0;
    console.log(`matches.${key}=${tsJul} → [${idxs}] ${changed ? '⚠ CHANGED' : 'ignored'}`);
  }

  // submission_idx filters (lte < 500th idx → only older fills)
  const all = await post({ matches: { subaccounts: [SUB], limit: 500, desc: true } });
  const oldestIdx = Number(all.json.matches[all.json.matches.length - 1].submission_idx);
  for (const key of ['lte', 'lt', 'max', 'submission_idx_lt', 'submission_idx_lte']) {
    const body = { matches: { subaccounts: [SUB], limit: 3, desc: true } };
    body.matches[key] = oldestIdx;
    const j = await post(body);
    const idxs = (j.json?.matches ?? []).map((m) => String(m.submission_idx)).join(',');
    const changed = idxs !== baseIdx && idxs.length > 0;
    console.log(`matches.${key}=${oldestIdx} → [${idxs}] ${changed ? '⚠ CHANGED' : 'ignored'}`);
  }

  // other top-level query keys: txs/submissions/orders
  for (const topKey of ['txs', 'submissions', 'orders']) {
    const j = await post({ [topKey]: { subaccounts: [SUB], limit: 3, desc: true } });
    const keys = j.json ? Object.keys(j.json).join(',') : '(no json)';
    const n = (j.json?.[topKey] ?? []).length;
    console.log(`query key "${topKey}" → status ${j.status}, response keys: ${keys}, ${topKey}: ${n}`);
  }
}

main().catch((err) => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
