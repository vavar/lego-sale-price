/* sync.js — LEGO.com image-URL extractor helper.
   Source: the search page itself (https://www.lego.com/en-us/search?q={set}),
   extracting the official image URL from the embedded __NEXT_DATA__ JSON.

   Runs in the user's browser (their residential IP isn't blocked).
   Two modes:
   1. Direct fetch to the search page (may fail due to CORS).
   2. Console snippet to run on lego.com (same-origin, always works);
      result comes back via clipboard -> pasted here -> downloaded as JSON.

   parseForImage()/deepFindImage() are shared verbatim with the snippet
   (injected via Function.prototype.toString), so tests cover both paths.
*/
(function () {
  'use strict';

  var CSV_PATH = 'data/lego-sale_2026-09-24-27.csv';
  var SEARCH_BASE = 'https://www.lego.com/en-us/search?q=';
  var ITEMS = [];
  var MISSING = [];
  var results = {};

  var $ = function (id) { return document.getElementById(id); };
  function log(msg) {
    var el = $('log');
    el.textContent += msg + '\n';
    el.scrollTop = el.scrollHeight;
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function download(obj) {
    var blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'lego-images.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  // ---------- extraction logic (shared with snippet — keep self-contained) ----------
  function deepFindImage(node, item, depth) {
    if (depth > 12 || node == null) return null;
    if (Array.isArray(node)) {
      for (var i = 0; i < node.length; i++) {
        var r = deepFindImage(node[i], item, depth + 1);
        if (r) return r;
      }
      return null;
    }
    if (typeof node !== 'object') return null;
    var codeKeys = ['productCode', 'itemNumber', 'setNumber', 'sku', 'productNo'];
    var has = false;
    for (var k = 0; k < codeKeys.length; k++) {
      var v0 = node[codeKeys[k]];
      if (String(v0 == null ? '' : v0).replace(/^0+/, '') === String(item)) { has = true; break; }
    }
    if (has) {
      for (var key in node) {
        if (!/image|thumb|picture/i.test(key)) continue;
        var v = node[key];
        if (typeof v === 'string' && v.indexOf('lego.com/cdn') !== -1) return v;
        if (v && typeof v === 'object') {
          var s = JSON.stringify(v);
          var m2 = s && s.match(/https:\/\/www\.lego\.com\/cdn\/[^"]+?\.(?:png|jpe?g|webp)/);
          if (m2) return m2[0];
        }
      }
    }
    for (var key2 in node) {
      var r2 = deepFindImage(node[key2], item, depth + 1);
      if (r2) return r2;
    }
    return null;
  }

  function parseForImage(html, item) {
    var m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (m) {
      try {
        var u = deepFindImage(JSON.parse(m[1]), item, 0);
        if (u) return u;
      } catch (e) { /* fall through */ }
    }
    // fallback: nearest CDN image URL after an occurrence of the set number
    var re = /https:\/\/www\.lego\.com\/cdn\/[^"'\\\s)]+?\.(?:png|jpe?g|webp)/g;
    var urls = [], mm;
    while ((mm = re.exec(html)) !== null) urls.push({ i: mm.index, u: mm[0] });
    if (!urls.length) return null;
    var pos = html.indexOf('"' + item + '"');
    if (pos === -1) pos = html.indexOf(item);
    while (pos !== -1) {
      for (var k = 0; k < urls.length; k++) {
        if (urls[k].i > pos && urls[k].i - pos < 3000) return urls[k].u;
      }
      pos = html.indexOf(item, pos + 1);
    }
    return urls.length === 1 ? urls[0].u : null;
  }

  // ---------- inventory ----------
  fetch(CSV_PATH)
    .then(function (r) { return r.text(); })
    .then(function (text) {
      var lines = text.replace(/\r/g, '').split('\n').slice(1).filter(Boolean);
      ITEMS = lines.map(function (l) { return l.split(',')[0]; });
      return Promise.all(ITEMS.map(function (item) {
        return fetch('img/' + encodeURIComponent(item) + '.jpg', { method: 'HEAD' })
          .then(function (r) { return r.ok ? null : item; })
          .catch(function () { return item; });
      }));
    })
    .then(function (missing) {
      MISSING = missing.filter(Boolean);
      $('missCount').textContent = MISSING.length;
      $('allCount').textContent = ITEMS.length;
      $('stats').textContent = 'พร้อมใช้งาน · เซ็ตทั้งหมด ' + ITEMS.length + ' · ยังไม่มีรูป ' + MISSING.length;
      buildSnippet();
    })
    .catch(function (e) {
      $('stats').textContent = 'โหลดรายการเซ็ตไม่สำเร็จ: ' + e.message;
    });

  function currentScope() {
    var v = document.querySelector('input[name="scope"]:checked').value;
    if (v === 'missing') return MISSING;
    if (v === 'all') return ITEMS;
    return ($('customSets').value || '').split(/[\s,]+/).filter(Boolean);
  }

  document.querySelectorAll('input[name="scope"]').forEach(function (r) {
    r.addEventListener('change', function () {
      $('customSets').style.display = r.value === 'custom' && r.checked ? '' : 'none';
      buildSnippet();
    });
  });
  $('customSets').addEventListener('input', buildSnippet);

  // ---------- mode 1: direct fetch from this page (cross-origin; best effort) ----------
  function pageProbe(item) {
    return fetch(SEARCH_BASE + encodeURIComponent(item), { headers: { Accept: 'text/html' } })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function (html) { return parseForImage(html, item); })
      .catch(function () { return 'CORS'; });
  }

  $('autoBtn').addEventListener('click', function () {
    var target = currentScope();
    if (!target.length) { alert('ยังไม่มีรายการเซ็ตในขอบเขตที่เลือก'); return; }
    results = {};
    var btn = this;
    btn.disabled = true;
    $('pbarWrap').classList.remove('hidden');
    $('corsHint').classList.add('hidden');
    $('autoResult').classList.add('hidden');
    $('log').textContent = '';
    log('เริ่มดึงหน้า search ของ lego.com จำนวน ' + target.length + ' เซ็ต…');

    var done = 0, blocked = false;
    var queue = target.slice();
    var CONC = 3;

    function next() {
      if (!queue.length || blocked) return Promise.resolve();
      var item = queue.shift();
      return pageProbe(item).then(function (url) {
        done++;
        if (url === 'CORS') blocked = true;
        else {
          results[item] = url;
          if (url) log('✔ ' + item);
        }
        $('pbar').style.width = Math.round(done / target.length * 100) + '%';
        return next();
      });
    }
    var workers = [];
    for (var i = 0; i < CONC; i++) workers.push(next());
    Promise.all(workers).then(function () {
      btn.disabled = false;
      if (blocked) {
        log('ถูกบล็อก (CORS) — เบราว์เซอร์อ่านหน้า lego.com ข้ามโดเมนไม่ได้ ใช้ snippet ขั้นที่ 3 (รันบน lego.com เอง เดินแน่นอน)');
        $('corsHint').classList.remove('hidden');
      } else {
        var found = Object.values(results).filter(Boolean).length;
        log('เสร็จ: เจอรูป ' + found + '/' + target.length);
        $('autoSummary').textContent = 'เจอ URL รูป ' + found + ' จาก ' + target.length + ' เซ็ต';
        $('autoResult').classList.remove('hidden');
        $('dlAuto').onclick = function () { download(results); };
      }
    });
  });

  // ---------- mode 2: console snippet (same-origin on lego.com) ----------
  function snippetSource() {
    var list = currentScope();
    return '// LEGO.com image extractor — search-page version\n' +
      '// Paste in Console (F12) on any www.lego.com page, press Enter.\n' +
      deepFindImage.toString() + '\n\n' +
      parseForImage.toString() + '\n\n' +
      '(async () => {\n' +
      '  const items = ' + JSON.stringify(list) + ';\n' +
      '  const out = {};\n' +
      '  for (const it of items) {\n' +
      '    try {\n' +
      '      const r = await fetch("' + SEARCH_BASE + '" + it, { headers: { Accept: "text/html" } });\n' +
      '      const html = await r.text();\n' +
      '      out[it] = parseForImage(html, it);\n' +
      '      console.log(out[it] ? "✔ " + it : "… " + it);\n' +
      '    } catch (e) { out[it] = null; console.log("✖ " + it, e.message); }\n' +
      '    await new Promise(r2 => setTimeout(r2, 400));\n' +
      '  }\n' +
      '  const json = JSON.stringify(out);\n' +
      '  try { await navigator.clipboard.writeText(json); console.log("COPIED to clipboard ✔ — paste it back in sync.html", out); }\n' +
      '  catch (e) { console.log("COPY FAILED — copy manually:", json); }\n' +
      '})();';
  }

  function buildSnippet() {
    var s = snippetSource();
    $('snipBox').textContent = s;
    $('copySnip').onclick = function () {
      var btn = this;
      var finish = function (ok) {
        btn.textContent = ok ? '✅ คัดลอกแล้ว — วางใน Console ของ lego.com' : '❌ คัดลอกไม่ได้ — เลือกข้อความในกล่องเอง';
        setTimeout(function () { btn.textContent = '📋 คัดลอก snippet'; }, 2500);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(s).then(function () { finish(true); }, function () { finish(false); });
      } else finish(false);
    };
  }

  // ---------- paste result -> validate -> download ----------
  $('paste').addEventListener('input', validatePaste);
  $('paste').addEventListener('drop', function (ev) {
    ev.preventDefault();
    var f = ev.dataTransfer.files && ev.dataTransfer.files[0];
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () { $('paste').value = rd.result; validatePaste(); };
    rd.readAsText(f);
  });
  $('paste').addEventListener('dragover', function (ev) { ev.preventDefault(); });

  function validatePaste() {
    var box = $('pasteResult'), tbl = $('resTbl');
    box.classList.add('hidden');
    $('dlPaste').disabled = true;
    $('pasteStatus').textContent = '';
    var raw = $('paste').value.trim();
    if (!raw) return;
    var data;
    try { data = JSON.parse(raw); } catch (e) {
      $('pasteStatus').textContent = '❌ JSON ไม่ถูกต้อง: ' + e.message;
      return;
    }
    if (typeof data !== 'object' || Array.isArray(data) || data === null) {
      $('pasteStatus').textContent = '❌ ต้องเป็น object เช่น {"10310":"https://..."}';
      return;
    }
    var rows = Object.keys(data).sort();
    var good = rows.filter(function (k) { return typeof data[k] === 'string' && data[k].startsWith('http'); });
    $('pasteStatus').textContent = '✅ ' + rows.length + ' เซ็ต · เจอ URL ' + good.length + ' · ไม่เจอ ' + (rows.length - good.length);
    $('dlPaste').disabled = rows.length === 0;
    $('dlPaste').onclick = function () { download(data); };

    tbl.innerHTML = '<tr><th>เซ็ต</th><th>สถานะ</th><th>URL</th></tr>';
    rows.forEach(function (k) {
      var v = data[k];
      var okk = typeof v === 'string' && v.startsWith('http');
      var tr = document.createElement('tr');
      tr.innerHTML = '<td>' + esc(k) + '</td>' +
        '<td class="' + (okk ? 'ok' : 'miss') + '">' + (okk ? 'เจอ' : 'ไม่เจอ') + '</td>' +
        '<td style="word-break:break-all">' + (okk ? esc(v) : '—') + '</td>';
      tbl.appendChild(tr);
    });
    box.classList.remove('hidden');
  }
})();
