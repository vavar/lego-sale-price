// Smoke test: load assets/app.js against a minimal DOM stub, drive filter/sort/search paths.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = '/home/vavar/projects/lego-sale-price';

// ---- minimal DOM stub ----
const created = []; // rows appended into the document fragment

function el(id) {
  return {
    id, value: id === 'minDisc' ? '0' : (id === 'sort' ? 'item' : ''),
    checked: false, textContent: '', innerHTML: '',
    listeners: {},
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); },
    classList: {
      _s: new Set(),
      remove(c) { this._s.delete(c); },
      add(c) { this._s.add(c); },
      contains(c) { return this._s.has(c); }
    },
    getAttribute() { return id; }
  };
}
const ids = ['q', 'minDisc', 'sort', 'onlyReview', 'stats', 'error', 'tbody', 'tbl'];
const elems = Object.fromEntries(ids.map(i => [i, el(i)]));
elems['tbody'].appendChild = () => {}; // real DOM has it; rows already captured via fragment
elems['tbody'].querySelectorAll = () => []; // lazyImages() target; no real imgs in stub
const chipBtns = ['all', 'pct', 'b1g1', 'b2f1', 'full'].map(c => {
  const b = el('chip-' + c);
  b.getAttribute = () => c;
  return b;
});

let fetchText;
global.fetch = () => Promise.resolve({ ok: true, text: () => Promise.resolve(fetchText) });

global.window = global; // app.js checks window.__lb (lightbox not loaded here)

global.document = {
  getElementById: (id) => elems[id],
  querySelectorAll: (sel) => sel === '#chips button' ? chipBtns : [],
  createElement: () => ({ className: '', innerHTML: '' }), // row node; filled via buildRow's innerHTML set before append
  addEventListener: (t, fn) => { if (t === 'DOMContentLoaded') global.__init = fn; },
  createDocumentFragment: () => ({ appendChild: (n) => created.push(n) })
};
// row nodes capture their HTML at build time via tr.innerHTML assignment
const origCreate = global.document.createElement;
global.document.createElement = () => {
  const n = { className: '', _html: '' };
  Object.defineProperty(n, 'innerHTML', { set(v) { n._html = v; }, get() { return n._html; } });
  return n;
};
// apply() resets tbody.innerHTML = '' -> clear captured rows
Object.defineProperty(elems['tbody'], 'innerHTML', {
  set() { created.length = 0; },
  get() { return ''; }
});

// ---- load app.js ----
const src = fs.readFileSync(path.join(ROOT, 'assets/app.js'), 'utf8');
eval(src);

// ---- tests ----
(async () => {
  fetchText = fs.readFileSync(path.join(ROOT, 'data/lego-sale_2026-09-24-27.csv'), 'utf8');

  global.__init();
  await new Promise(r => setTimeout(r, 50)); // fetch chain is not returned by init()
  if (elems['error'].textContent) console.log('ERROR ELEM:', elems['error'].textContent);

  assert.ok(created.length === 875, 'expected 875 rows, got ' + created.length);
  console.log('rows rendered:', created.length);

  const stats = elems['stats'].textContent;
  assert.ok(/875/.test(stats), 'stats should mention 875');
  console.log('stats:', stats);
  assert.ok(/<td class="item">/.test(created[0]._html), 'row has item td');
  assert.ok(/data-src="img\/[^"]+\.jpg"/.test(created[0]._html), 'row uses local repo image');
  assert.ok(/data-hires="https:\/\/cdn\.rebrickable\.com\/media\/sets\/[^"]+-1\.jpg"/.test(created[0]._html), 'row keeps hi-res CDN url');
  assert.ok(/href="https:\/\/www\.lego\.com\/en-th\/search\?q=[^"]+"/.test(created[0]._html), 'row links to LEGO.com search');
  assert.ok(/<button class="copy" data-item="[^"]+"/.test(created[0]._html), 'row has copy button');
  assert.ok(elems['tbl'].classList.contains('hidden') === false, 'table unhidden');

  // --- search ---
  const inputFn = elems['q'].listeners.input[0];
  elems['q'].value = 'batman';
  inputFn();
  await new Promise(r => setTimeout(r, 200)); // past debounce
  console.log('search "batman":', created.length, 'rows');
  assert.ok(created.length > 0 && created.length < 875, 'batman filter should narrow');
  assert.ok(created.every(r => /batman/i.test(r._html)), 'all hits mention batman');

  elems['q'].value = '';
  inputFn();
  await new Promise(r => setTimeout(r, 200));
  assert.ok(created.length === 875, 'clear restores 875');

  // --- chip: Buy 1 Get 1 ---
  chipBtns.find(b => b.id === 'chip-b1g1').listeners.click[0]();
  console.log('Buy1Get1:', created.length, 'rows');
  assert.ok(created.length === 41, 'b1g1 should be 41, got ' + created.length);
  assert.ok(created.every(r => /ซื้อ1แถม1/.test(r._html)), 'b1g1 badge present');
  chipBtns.find(b => b.id === 'chip-all').listeners.click[0]();
  assert.ok(created.length === 875);

  // --- min discount 50 (data has 69 rows @50% + 47 rows @70% = 116) ---
  elems['minDisc'].value = '50';
  elems['minDisc'].listeners.change.forEach(f => f());
  console.log('>=50%:', created.length, 'rows');
  assert.ok(created.length === 116, '>=50% should be 116, got ' + created.length);
  assert.ok(created.every(r => /(\b|[^\d])(50|70)%/.test(r._html)), 'all rows >= 50%');
  elems['minDisc'].value = '0';
  elems['minDisc'].listeners.change.forEach(f => f());
  assert.ok(created.length === 875);

  // --- sort by %discount desc ---
  elems['sort'].value = 'disc-desc';
  elems['sort'].listeners.change.forEach(f => f());
  assert.ok(/70%/.test(created[0]._html), 'top row should be 70%');
  console.log('top by disc-desc:', created[0]._html.match(/<td class="item"><a class="itemlink"[^>]*>([^<]+)/)[1]);
  elems['sort'].value = 'item';
  elems['sort'].listeners.change.forEach(f => f());

  // --- only needs_review ---
  elems['onlyReview'].checked = true;
  elems['onlyReview'].listeners.change.forEach(f => f());
  assert.ok(created.length === 5, 'needs_review rows = 5, got ' + created.length);
  assert.ok(created.every(r => /ตรวจสอบ/.test(r._html)), 'review badge shown');
  console.log('needs_review rows:', created.length);
  elems['onlyReview'].checked = false;
  elems['onlyReview'].listeners.change.forEach(f => f());
  assert.ok(created.length === 875);

  console.log('\nALL TESTS PASSED ✅');
  process.exit(0);
})().catch(e => { console.error('TEST FAILED ❌', e.message); process.exit(1); });
