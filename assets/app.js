/* LEGO sale price search — vanilla JS, no build step */
(function () {
  'use strict';

  var CSV_PATH = 'data/lego-sale_2026-09-24-27.csv';

  var PROMO_LABEL = {
    'Buy 1 Get 1': 'ซื้อ1แถม1',
    'Buy 2 Free 1': 'ซื้อ2แถม1'
  };
  var PROMO_KEYS = Object.keys(PROMO_LABEL);

  var rows = [];          // parsed dataset
  var filter = 'all';     // all | pct | b1g1 | b2f1 | full
  var q = '';

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  // ---- CSV parser (handles quoted fields with commas) ----
  function parseCSV(text) {
    var out = [], row = [], field = '', inQ = false, i, c;
    // strip UTF-8 BOM
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    for (i = 0; i < text.length; i++) {
      c = text[i];
      if (inQ) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQ = false;
        } else field += c;
      } else if (c === '"') inQ = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); out.push(row); row = []; field = ''; }
      else if (c !== '\r') field += c;
    }
    if (field !== '' || row.length) { row.push(field); out.push(row); }
    return out;
  }

  function fmt(n) {
    return n == null ? '' : Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function highlight(text) {
    if (!q) return esc(text);
    var t = esc(text);
    try {
      // escape regex chars in query
      var re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      t = t.replace(re, '<mark>$1</mark>');
    } catch (e) { /* ignore */ }
    return t;
  }

  function promoOf(r) { return r.promo || null; }

  function rowClass(r) {
    if (promoOf(r)) return 'promo';
    if (Number(r.price_thb) === Number(r.sale_price_thb)) return 'full';
    return 'pct';
  }

  function buildRow(r) {
    var tr = document.createElement('tr');
    tr.className = rowClass(r);
    var disc = r.discount_pct ? r.discount_pct + '%' : '—';
    var promoBadge = promoOf(r) ? '<span class="badge">' + esc(PROMO_LABEL[r.promo] || r.promo) + '</span>' : '';
    var save = (r.discount_pct && r.sale_price_thb)
      ? Number(r.price_thb) - Number(r.sale_price_thb) : null;
    var desc = highlight(r.description) + promoBadge +
      (r.needs_review === '1' ? ' <span class="badge warn">⚠ ตรวจสอบ</span>' : '');
    var imgUrl = 'img/' + encodeURIComponent(r.item) + '.webp';
    var hiRes = 'https://cdn.rebrickable.com/media/sets/' + encodeURIComponent(r.item) + '-1.jpg';
    r._img = imgUrl;
    r._hires = hiRes;
    var legoUrl = 'https://www.lego.com/en-th/search?q=' + encodeURIComponent(r.item);
    tr.innerHTML =
      '<td class="imgcell"><img data-src="' + imgUrl + '" data-item="' + esc(r.item) +
      '" data-hires="' + hiRes + '" alt="' + esc(r.item) + '" loading="lazy" title="แตะเพื่อดูรูปใหญ่"></td>' +
      '<td class="item"><a class="itemlink" href="' + legoUrl + '" target="_blank" rel="noopener" ' +
      'title="เปิด LEGO.com ค้นหา ' + esc(r.item) + '">' + highlight(r.item) + '</a>' +
      '<button class="copy" data-item="' + esc(r.item) + '" title="คัดลอกรหัสเซ็ต">📋</button></td>' +
      '<td class="desc">' + desc + '</td>' +
      '<td class="num">' + fmt(r.price_thb) + '</td>' +
      '<td class="disc">' + disc + '</td>' +
      '<td class="num sale">' + fmt(r.sale_price_thb) + '</td>' +
      '<td class="num save">' + (save ? fmt(save) : '—') + '</td>';
    return tr;
  }

  var io = null;
  function lazyImages() {
    var imgs = $('tbody').querySelectorAll('img[data-src]');
    if (typeof IntersectionObserver === 'undefined') {
      // fallback (tests / very old browsers): load everything
      imgs.forEach(function (im) { im.src = im.getAttribute('data-src'); });
      return;
    }
    if (!io) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.src = en.target.getAttribute('data-src');
            en.target.removeAttribute('data-src');
            io.unobserve(en.target);
          }
        });
      }, { rootMargin: '300px' });
    }
    imgs.forEach(function (im) { io.observe(im); });
  }

  function apply() {
    var minDisc = Number($('minDisc').value || 0);
    var onlyReview = $('onlyReview').checked;
    var sort = $('sort').value;

    var list = rows.filter(function (r) {
      if (onlyReview && r.needs_review !== '1') return false;
      if (minDisc > 0 && !(Number(r.discount_pct || 0) >= minDisc)) return false;

      if (filter === 'pct' && !r.discount_pct) return false;
      if (filter === 'b1g1' && r.promo !== 'Buy 1 Get 1') return false;
      if (filter === 'b2f1' && r.promo !== 'Buy 2 Free 1') return false;
      if (filter === 'full' && (r.discount_pct || r.promo)) return false;

      if (q) {
        var hay = (r.item + ' ' + r.description).toLowerCase();
        var words = q.toLowerCase().split(/\s+/).filter(Boolean);
        for (var i = 0; i < words.length; i++) if (hay.indexOf(words[i]) === -1) return false;
      }
      return true;
    });

    var sorters = {
      'item':       function (a, b) { return a.item.localeCompare(b.item, undefined, { numeric: true }); },
      'disc-desc':  function (a, b) { return (Number(b.discount_pct) || 0) - (Number(a.discount_pct) || 0) || a.item.localeCompare(b.item, undefined, { numeric: true }); },
      'save-desc':  function (a, b) { return (Number(b.price_thb) - Number(b.sale_price_thb)) - (Number(a.price_thb) - Number(a.sale_price_thb)); },
      'price-desc': function (a, b) { return Number(b.price_thb) - Number(a.price_thb); },
      'price-asc':  function (a, b) { return Number(a.price_thb) - Number(b.price_thb); }
    };
    list.sort(sorters[sort] || sorters.item);

    var tbody = $('tbody');
    tbody.innerHTML = '';
    var frag = document.createDocumentFragment();
    list.forEach(function (r) { frag.appendChild(buildRow(r)); });
    tbody.appendChild(frag);
    lazyImages();
    if (window.__lb) window.__lb.list = list; // lightbox navigation follows current filter/sort

    var pctCount = rows.filter(function (r) { return !!r.discount_pct; }).length;
    var promoCount = rows.filter(function (r) { return promoOf(r); }).length;
    var stats =
      'แสดง ' + list.length.toLocaleString('th-TH') + ' / ' + rows.length.toLocaleString('th-TH') +
      ' รายการ · ลด % ' + pctCount.toLocaleString('th-TH') +
      ' · โปรโมชัน ' + promoCount.toLocaleString('th-TH');

    if (q) stats += ' · คำค้น: "' + q + '"';
    $('stats').textContent = stats;
  }

  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  function init() {
    var chips = document.querySelectorAll('#chips button');
    chips.forEach(function (btn) {
      btn.addEventListener('click', function () {
        chips.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        filter = btn.getAttribute('data-chip');
        apply();
      });
    });

    var debounce;
    $('q').addEventListener('input', function () {
      clearTimeout(debounce);
      debounce = setTimeout(function () { q = $('q').value.trim(); apply(); }, 120);
    });
    ['minDisc', 'sort', 'onlyReview'].forEach(function (id) {
      $(id).addEventListener('change', apply);
    });

    // copy-set-number buttons (event delegation: table re-renders on every filter)
    $('tbody').addEventListener('click', function (ev) {
      var btn = ev.target.closest ? ev.target.closest('button.copy') : null;
      if (!btn) return;
      var item = btn.getAttribute('data-item');
      var done = function (ok) {
        btn.textContent = ok ? '✅' : '❌';
        setTimeout(function () { btn.textContent = '📋'; }, 1200);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(item).then(function () { done(true); }, function () { done(fallbackCopy(item)); });
      } else {
        done(fallbackCopy(item));
      }
    });

    fetch(CSV_PATH)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status + ' loading ' + CSV_PATH);
        return res.text();
      })
      .then(function (text) {
        var grid = parseCSV(text);
        var header = grid.shift();
        var idx = {};
        header.forEach(function (h, i) { idx[h.trim()] = i; });
        rows = grid.filter(function (g) { return g.length > 1 && g[idx.item]; })
          .map(function (g) {
            return {
              item: g[idx.item], description: g[idx.description],
              price_thb: g[idx.price_thb], discount_pct: g[idx.discount_pct],
              sale_price_thb: g[idx.sale_price_thb], promo: g[idx.promo],
              needs_review: g[idx.needs_review]
            };
          });
        $('tbl').classList.remove('hidden');
        apply();
      })
      .catch(function (err) {
        $('error').textContent = 'โหลดข้อมูลไม่สำเร็จ: ' + err.message;
        $('error').classList.remove('hidden');
      });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
