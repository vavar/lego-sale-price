// sync.test.js — validate sync.js flows with a DOM stub:
// scope selection, snippet generation, direct-API mode (mocked), paste->download validation.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = '/home/vavar/projects/lego-sale-price';

function makeEl(id) {
  return {
    id, value: '', checked: false, disabled: false, textContent: '', innerHTML: '',
    listeners: {},
    style: { width: '' },
    classList: {
      _s: new Set(['hidden']),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); }
    },
    addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); },
    appendChild(n) { this._rows = (this._rows || []).concat(n); },
    scrollTop: 0, scrollHeight: 0, onclick: null
  };
}

const ids = ['stats', 'missCount', 'allCount', 'customSets', 'autoBtn', 'pbarWrap', 'pbar',
  'log', 'corsHint', 'autoResult', 'autoSummary', 'dlAuto', 'snipBox', 'copySnip',
  'paste', 'pasteStatus', 'dlPaste', 'pasteResult', 'resTbl'];
const elems = Object.fromEntries(ids.map(i => [i, makeEl(i)]));

// radio scope: default "missing" checked
elems['scopeRadios'] = [
  { value: 'missing', checked: true, addEventListener() {} },
  { value: 'all', checked: false, addEventListener() {} },
  { value: 'custom', checked: false, addEventListener() {} }
];

const csvText = require('fs').readFileSync(path.join(ROOT, 'data/lego-sale_2026-09-24-27.csv'), 'utf8');

let headFailures = new Set(['10310', '10318', '31395']); // simulate: these have no local img
global.fetch = (url) => {
  if (url.includes('lego-sale_2026')) {
    return Promise.resolve({ text: () => Promise.resolve(csvText) });
  }
  const m = url.match(/img\/([^/]+)\.jpg/);
  const item = decodeURIComponent(m[1]);
  if (headFailures.has(item)) return Promise.resolve({ ok: false });
  return Promise.resolve({ ok: true });
};

global.document = {
  getElementById: (id) => elems[id],
  querySelectorAll: (sel) => sel.includes('name="scope"') ? elems['scopeRadios'] : [],
  createElement: () => ({ href: '', click() {}, download: '' }),
  body: { style: {} }
};
global.document.querySelector = (sel) => {
  if (sel.includes('scope') && sel.includes(':checked')) {
    return elems['scopeRadios'].find(r => r.checked);
  }
  return null;
};

global.Blob = class { constructor(parts) { this.size = JSON.stringify(parts[0]).length; } };
global.URL = { createObjectURL: () => 'blob:x', revokeObjectURL() {} };
global.navigator = {};
global.alert = (m) => { global.__alerted = m; };

eval(fs.readFileSync(path.join(ROOT, 'assets/sync.js'), 'utf8'));

(async () => {
  // wait for inventory load (CSV + 875 HEADs resolve fast in stub)
  await new Promise(r => setTimeout(r, 100));

  assert.strictEqual(Number(elems['missCount'].textContent), 3, 'missing count = 3, got ' + elems['missCount'].textContent);
  assert.strictEqual(Number(elems['allCount'].textContent), 875, 'all count = 875');
  console.log('inventory: all=' + elems['allCount'].textContent + ' missing=' + elems['missCount'].textContent);

  // snippet generated for default scope (missing)
  const snip = elems['snipBox'].textContent;
  assert.ok(snip.includes('searchapi.lego.com'), 'snippet uses LEGO search API');
  assert.ok(snip.includes('"10310"') && snip.includes('"31395"'), 'snippet contains the 3 missing sets');
  assert.ok(snip.includes('navigator.clipboard'), 'snippet copies to clipboard');
  console.log('snippet ok (' + snip.split('\n').length + ' lines)');

  // --- direct API mode: mock success for 2 of 3 ---
  const realFetch = global.fetch;
  global.fetch = (url) => {
    if (url.includes('searchapi.lego.com')) {
      const item = decodeURIComponent(url.match(/text=([^&]+)/)[1]);
      const body = item === '10310'
        ? { results: [{ productCode: '10310', imageUrl: 'https://www.lego.com/cdn/abc.png' }] }
        : { results: [] };
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
    }
    return realFetch(url);
  };
  elems['autoBtn'].listeners.click[0]();
  await new Promise(r => setTimeout(r, 150));
  assert.ok(!elems['autoResult'].classList.contains('hidden'), 'auto result shown when not blocked');
  assert.ok(/เจอ URL รูป 1 จาก 3/.test(elems['autoSummary'].textContent), 'summary 1/3, got: ' + elems['autoSummary'].textContent);
  assert.ok(elems['log'].textContent.includes('✔ 10310'), 'log shows found item');
  console.log('direct API mode ok:', elems['autoSummary'].textContent);

  // --- blocked path ---
  elems['autoBtn'].listeners.click[0](); // fetch now always rejects below
  global.fetch = (url) => {
    if (url.includes('searchapi.lego.com')) return Promise.reject(new Error('CORS'));
    return realFetch(url);
  };
  elems['log'].textContent = '';
  elems['autoBtn'].disabled = false;
  elems['autoBtn'].listeners.click[0]();
  await new Promise(r => setTimeout(r, 150));
  assert.ok(!elems['corsHint'].classList.contains('hidden'), 'CORS hint shown when blocked');
  console.log('blocked path shows CORS hint ✅');

  // --- paste validation ---
  elems['paste'].value = JSON.stringify({ '10310': 'https://www.lego.com/cdn/x.png', '31395': null });
  elems['paste'].listeners.input[0]();
  assert.ok(elems['dlPaste'].disabled === false, 'download enabled after valid paste');
  assert.ok(/2 เซ็ต/.test(elems['pasteStatus'].textContent), 'status counts sets');
  assert.ok(/เจอ URL 1/.test(elems['pasteStatus'].textContent), 'status counts urls');
  assert.ok(/<th>เซ็ต<\/th>/.test(elems['resTbl'].innerHTML), 'table header rendered');
  assert.ok(elems['resTbl']._rows.length === 2, 'result table has 2 data rows');
  // invalid JSON
  elems['paste'].value = '{oops';
  elems['paste'].listeners.input[0]();
  assert.ok(/ไม่ถูกต้อง/.test(elems['pasteStatus'].textContent), 'invalid JSON flagged');
  console.log('paste validation ok:', elems['pasteStatus'].textContent);

  console.log('\nALL SYNC TESTS PASSED ✅');
  process.exit(0);
})().catch(e => { console.error('TEST FAILED ❌', e); process.exit(1); });
