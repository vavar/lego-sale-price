// sync.test.js — sync.js flows + search-page extraction logic:
// scope, snippet generation, direct mode (mocked blocked/ok), paste validation,
// and parseForImage/deepFindImage against a realistic __NEXT_DATA__ document.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = '/home/vavar/projects/lego-sale-price';

function makeEl(id) {
  return {
    id, value: '', checked: false, disabled: false, textContent: '', innerHTML: '',
    listeners: {}, style: { width: '' },
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
elems['scopeRadios'] = [
  { value: 'missing', checked: true, addEventListener() {} },
  { value: 'all', checked: false, addEventListener() {} },
  { value: 'custom', checked: false, addEventListener() {} }
];

const csvText = fs.readFileSync(path.join(ROOT, 'data/lego-sale_2026-09-24-27.csv'), 'utf8');
const headFailures = new Set(['10310', '10318', '31395']);
const realFetch = (url) => {
  if (url.includes('lego-sale_2026')) return Promise.resolve({ text: () => Promise.resolve(csvText) });
  const m = url.match(/img\/([^/]+)\.jpg/);
  if (!m) return Promise.reject(new Error('unexpected ' + url));
  return Promise.resolve({ ok: !headFailures.has(decodeURIComponent(m[1])) });
};
global.fetch = realFetch;

global.document = {
  getElementById: (id) => elems[id],
  querySelectorAll: (sel) => sel.includes('name="scope"') ? elems['scopeRadios'] : [],
  querySelector: (sel) => sel.includes(':checked') ? elems['scopeRadios'].find(r => r.checked) : null,
  createElement: () => ({ href: '', click() {}, download: '' }),
  body: { style: {} }
};
global.Blob = class { constructor(p) { this.size = JSON.stringify(p[0]).length; } };
global.URL = { createObjectURL: () => 'blob:x', revokeObjectURL() {} };
global.navigator = {};
global.alert = () => {};

// capture sync.js internals for direct extraction testing
global.__capture = {};
const src = fs.readFileSync(path.join(ROOT, 'assets/sync.js'), 'utf8');
const patched = src.replace('function deepFindImage', 'global.__capture.deepFindImage = deepFindImage;\nfunction deepFindImage')
                   .replace('function parseForImage', 'global.__capture.parseForImage = parseForImage;\nfunction parseForImage');
eval(patched);

const { parseForImage, deepFindImage } = global.__capture;

(async () => {
  await new Promise(r => setTimeout(r, 100));
  assert.strictEqual(Number(elems['missCount'].textContent), 3, 'missing = 3');
  assert.strictEqual(Number(elems['allCount'].textContent), 875, 'all = 875');
  console.log('inventory ok (all=875, missing=3)');

  // ---------- extraction logic: realistic __NEXT_DATA__ ----------
  const nextData = JSON.stringify({
    props: { pageProps: { searchResults: {
      results: [
        { title: 'Transformers Soundwave', productCode: '10358',
          image: 'https://www.lego.com/cdn/product-assets/product.bi.core.pdp/abc123.png' },
        { title: 'other', productCode: '99999', image: 'https://www.lego.com/cdn/x.png' }
      ],
      total: 2
    } } }
  });
  const html1 = '<!DOCTYPE html><html><head><script id="__NEXT_DATA__" type="application/json">' + nextData + '<\/script></head><body></body></html>';
  const u1 = parseForImage(html1, '10358');
  assert.ok(u1 && u1.includes('product.bi.core.pdp/abc123.png'), '__NEXT_DATA__ extraction, got ' + u1);
  // wrong item -> no match for 31395 (absent)
  assert.strictEqual(parseForImage(html1, '31395'), null, 'absent item -> null');
  console.log('__NEXT_DATA__ extraction ok:', u1);

  // ---------- fallback: no __NEXT_DATA__, URL proximity ----------
  const html2 = '<div>... "10318" ... <img src="https://www.lego.com/cdn/a/b/concorde.jpg">' +
                '<img src="https://www.lego.com/cdn/zzz.png">';
  const u2 = parseForImage(html2, '10318');
  assert.ok(u2 && u2.includes('concorde.jpg'), 'proximity fallback picks nearest URL after set number, got ' + u2);
  console.log('proximity fallback ok:', u2);

  // ---------- snippet embeds the same functions ----------
  const snip = elems['snipBox'].textContent;
  assert.ok(snip.includes('www.lego.com/en-us/search?q='), 'snippet uses search page');
  assert.ok(snip.includes('__NEXT_DATA__'), 'snippet parses __NEXT_DATA__');
  assert.ok(snip.includes('"10310"') && snip.includes('"31395"'), 'snippet has missing sets');
  assert.ok(snip.includes('navigator.clipboard'), 'snippet copies result');
  console.log('snippet ok (search-page based)');

  // ---------- direct mode: mocked OK (server returns NEXT_DATA containing the searched item) ----------
  global.fetch = (url) => {
    if (url.includes('lego.com/en-us/search')) {
      const item = decodeURIComponent(url.match(/q=([^&]+)/)[1]);
      const data = JSON.stringify({ props: { pageProps: { searchResults: { results: [
        { productCode: item, image: 'https://www.lego.com/cdn/product-assets/' + item + '.png' }
      ] } } } });
      const html = '<script id="__NEXT_DATA__" type="application/json">' + data + '<\/script>';
      return Promise.resolve({ ok: true, text: () => Promise.resolve(html) });
    }
    return realFetch(url);
  };
  elems['autoBtn'].listeners.click[0]();
  await new Promise(r => setTimeout(r, 150));
  assert.ok(!elems['autoResult'].classList.contains('hidden'), 'auto result shown');
  assert.ok(/เจอ URL รูป 3 จาก 3/.test(elems['autoSummary'].textContent), 'found 3/3, got ' + elems['autoSummary'].textContent);
  assert.ok(elems['log'].textContent.includes('✔ 10318'), 'log lists found sets');
  console.log('direct mode (ok path):', elems['autoSummary'].textContent);

  // ---------- direct mode: blocked (CORS) ----------
  global.fetch = (url) => url.includes('lego.com/en-us/search')
    ? Promise.reject(new TypeError('Failed to fetch'))
    : realFetch(url);
  elems['log'].textContent = '';
  elems['autoBtn'].disabled = false;
  elems['autoBtn'].listeners.click[0]();
  await new Promise(r => setTimeout(r, 150));
  assert.ok(!elems['corsHint'].classList.contains('hidden'), 'CORS hint on block');
  console.log('direct mode (blocked path) shows CORS hint ✅');

  // ---------- paste validation ----------
  elems['paste'].value = JSON.stringify({ '10318': 'https://www.lego.com/cdn/p.png', '99999': null });
  elems['paste'].listeners.input[0]();
  assert.ok(elems['dlPaste'].disabled === false, 'download enabled');
  assert.ok(/2 เซ็ต/.test(elems['pasteStatus'].textContent), 'status sets');
  assert.ok(/เจอ URL 1/.test(elems['pasteStatus'].textContent), 'status urls');
  elems['paste'].value = 'not json';
  elems['paste'].listeners.input[0]();
  assert.ok(/ไม่ถูกต้อง/.test(elems['pasteStatus'].textContent), 'invalid flagged');
  console.log('paste validation ok');

  // deepFindImage direct sanity: nested object without exact code key but with setNumber
  const u3 = deepFindImage({ a: [{ b: { setNumber: '10318', images: ['https://www.lego.com/cdn/deep.webp'] } }] }, '10318', 0);
  assert.ok(u3 && u3.endsWith('.webp'), 'deep nested find, got ' + u3);
  console.log('deepFindImage ok:', u3);

  console.log('\nALL SYNC TESTS PASSED ✅');
  process.exit(0);
})().catch(e => { console.error('TEST FAILED ❌', e); process.exit(1); });
