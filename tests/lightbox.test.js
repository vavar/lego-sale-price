// Lightbox behaviour test: open from table, navigate, pinch-zoom, swipe, double-tap.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = '/home/vavar/projects/lego-sale-price';

function makeEl(tag) {
  const el = {
    tag, style: {}, listeners: {}, _qs: {},
    clientWidth: 400, clientHeight: 400,
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); }
    },
    addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); },
    removeEventListener() {},
    getAttribute() { return ''; }, setAttribute() {}, removeAttribute() {},
    querySelector(sel) { return this._qs[sel]; },
    getBoundingClientRect() { return { left: 100, top: 100, width: 400, height: 400 }; }
  };
  return el;
}

const lbEl = makeEl('div');
const imgEl = makeEl('img');
const capEl = makeEl('div'), hintEl = makeEl('div'), counterEl = makeEl('div');
const closeBtn = makeEl('button'), prevBtn = makeEl('button'), nextBtn = makeEl('button');
lbEl._qs = { '.lb-img': imgEl, '.lb-caption': capEl, '.lb-hint': hintEl,
             '.lb-counter': counterEl, '.lb-close': closeBtn, '.lb-prev': prevBtn, '.lb-next': nextBtn };
lbEl.classList.add('hidden');

const tbodyEl = makeEl('tbody');
const docListeners = {};
global.document = {
  getElementById: (id) => (id === 'lb' ? lbEl : id === 'tbody' ? tbodyEl : null),
  addEventListener: (t, fn) => { (docListeners[t] ||= []).push(fn); },
  body: { style: {} }
};
global.window = global;
global.addEventListener = () => {};   // window.addEventListener stub
global.Image = class { set src(v) { this._src = v; } get src() { return this._src; } };

// ---- load lightbox.js ----
eval(fs.readFileSync(path.join(ROOT, 'assets/lightbox.js'), 'utf8'));
docListeners['DOMContentLoaded'][0](); // run init()

const lb = global.window.__lb;
const rows = [
  { item: '75192', description: 'MILLENNIUM FALCON', price_thb: '43990', discount_pct: '20', sale_price_thb: '35192.00', promo: '', _img: 'img/75192.jpg', _hires: 'https://cdn.rebrickable.com/media/sets/75192-1.jpg' },
  { item: '10280', description: 'Flower Bouquet', price_thb: '2990', discount_pct: '', sale_price_thb: '', promo: 'Buy 1 Get 1', _img: 'img/10280.jpg', _hires: 'https://cdn.rebrickable.com/media/sets/10280-1.jpg' }
];
lb.list = rows;

// ---- 1. open from table click ----
const fakeImg = { getAttribute: (k) => (k === 'data-item' ? '10280' : null) };
tbodyEl.listeners.click[0]({ target: { closest: (sel) => (sel === 'img[data-item]' ? fakeImg : null) } });
assert.ok(!lbEl.classList.contains('hidden'), 'lightbox opens');
assert.strictEqual(imgEl.src, 'img/10280.jpg', 'shows local image');
assert.ok(/10280/.test(capEl.textContent), 'caption has set number');
assert.ok(/Buy 1 Get 1/.test(capEl.textContent), 'caption has promo');
assert.strictEqual(counterEl.textContent, '2/2', 'counter reflects position');
console.log('open from click:', capEl.textContent);

// ---- 2. next/prev navigation wraps ----
nextBtn.listeners.click[0]();
assert.strictEqual(counterEl.textContent, '1/1' === '' ? '' : '1/2', 'next wraps to first');
assert.strictEqual(imgEl.src, 'img/75192.jpg');
prevBtn.listeners.click[0]();
assert.strictEqual(counterEl.textContent, '2/2', 'prev wraps to last');
console.log('navigation wrap ok');

// ---- 3. pinch zoom ----
const t = (x, y) => ({ clientX: x, clientY: y });
const ts = imgEl.listeners.touchstart[0], tm = imgEl.listeners.touchmove[0], te = imgEl.listeners.touchend[0];
const noop = () => {};

ts({ touches: [t(200, 300), t(300, 300)], preventDefault: noop });   // dist 100
tm({ touches: [t(150, 300), t(350, 300)], preventDefault: noop });   // dist 200 -> scale 2
assert.ok(/scale\(2\b/.test(imgEl.style.transform), 'pinch scales to 2x, got ' + imgEl.style.transform);
console.log('pinch ->', imgEl.style.transform);

// pinch back down to 1
tm({ touches: [t(200, 300), t(300, 300)], preventDefault: noop });   // dist 100 -> back to 1
assert.ok(/scale\(1\)/.test(imgEl.style.transform), 'pinch in returns to 1x');
te({ touches: [t(250, 300)], changedTouches: [t(250, 300)], preventDefault: noop });
te({ touches: [], changedTouches: [t(250, 300)], preventDefault: noop });

// ---- 4. swipe left -> next image ----
ts({ touches: [t(250, 300)], preventDefault: noop });
tm({ touches: [t(150, 300)], preventDefault: noop });
te({ touches: [], changedTouches: [t(150, 300)], preventDefault: noop });
assert.strictEqual(counterEl.textContent, '1/2', 'swipe left advances');
console.log('swipe ->', counterEl.textContent);

// ---- 5. double tap zoom (reset scale to 1 first, as after image load) ----
lb.scale = 1; lb.tx = 0; lb.ty = 0;
ts({ touches: [t(250, 300)], preventDefault: noop });
te({ touches: [], changedTouches: [t(250, 300)], preventDefault: noop });   // tap 1
ts({ touches: [t(255, 305)], preventDefault: noop });
te({ touches: [], changedTouches: [t(255, 305)], preventDefault: noop });   // tap 2 -> zoom
assert.ok(/scale\(2\.5\)/.test(imgEl.style.transform), 'double tap zooms to 2.5x');
// double tap again (one pair) -> back to 1
ts({ touches: [t(250, 300)], preventDefault: noop });
te({ touches: [], changedTouches: [t(250, 300)], preventDefault: noop });
ts({ touches: [t(250, 300)], preventDefault: noop });
te({ touches: [], changedTouches: [t(250, 300)], preventDefault: noop });
assert.ok(/scale\(1\)/.test(imgEl.style.transform), 'double tap resets to 1x, got ' + imgEl.style.transform);
console.log('double-tap toggle ok');

// ---- 6. close ----
closeBtn.listeners.click[0]();
assert.ok(lbEl.classList.contains('hidden'), 'close hides lightbox');
assert.strictEqual(document.body.style.overflow, '');

console.log('\nALL LIGHTBOX TESTS PASSED ✅');
