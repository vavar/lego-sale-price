/* sync.js — LEGO.com image-URL extractor helper.
   Runs in the user's browser (their residential IP isn't blocked).
   Two modes:
   1. Direct fetch to LEGO Search API (may fail due to CORS).
   2. Generates a console snippet to run on lego.com; result comes back
      via clipboard -> pasted into the textarea -> downloaded as JSON.
*/
(function () {
  'use strict';

  var CSV_PATH = 'data/lego-sale_2026-09-24-27.csv';
  var ITEMS = [];          // all set numbers
  var MISSING = [];        // sets with no local image
  var target = [];         // currently selected scope
  var results = {};        // item -> url|null

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

  // ---------- load inventory ----------
  fetch(CSV_PATH)
    .then(function (r) { return r.text(); })
    .then(function (text) {
      var lines = text.replace(/\r/g, '').split('\n').slice(1).filter(Boolean);
      ITEMS = lines.map(function (l) { return l.split(',')[0]; });
      // missing = no row check done via HEAD on img/ (page host) — do lazily via parallel HEADs
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
    var custom = ($('customSets').value || '').split(/[\s,]+/).filter(Boolean);
    return custom;
  }

  document.querySelectorAll('input[name="scope"]').forEach(function (r) {
    r.addEventListener('change', function () {
      $('customSets').style.display = r.value === 'custom' && r.checked ? '' : 'none';
      buildSnippet();
    });
  });
  $('customSets').addEventListener('input', buildSnippet);

  // ---------- mode 1: direct fetch ----------
  function apiProbe(item) {
    var url = 'https://searchapi.lego.com/api/search?text=' + encodeURIComponent(item) +
      '&country=TH&locale=en-TH';
    return fetch(url, { headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        // try common shapes
        var hits = (data && (data.results || data.products || data.items)) || [];
        var found = null;
        for (var i = 0; i < hits.length; i++) {
          var h = hits[i];
          var code = String(h.productCode || h.itemNumber || h.id || '').replace(/^0+/, '');
          if (code === String(item)) {
            found = h.imageUrl || h.image || h.thumbnailUrl || (h.images && h.images[0]) || null;
            break;
          }
        }
        return found;
      })
      .catch(function () { return 'CORS'; });
  }

  $('autoBtn').addEventListener('click', function () {
    target = currentScope();
    if (!target.length) { alert('ยังไม่มีรายการเซ็ตในขอบเขตที่เลือก'); return; }
    results = {};
    var btn = this;
    btn.disabled = true;
    $('pbarWrap').classList.remove('hidden');
    $('corsHint').classList.add('hidden');
    $('autoResult').classList.add('hidden');
    $('log').textContent = '';
    log('เริ่มดึง ' + target.length + ' เซ็ตผ่าน LEGO Search API…');

    var done = 0, blocked = false;
    var queue = target.slice();
    var CONC = 4;

    function next() {
      if (!queue.length) return Promise.resolve();
      var item = queue.shift();
      return apiProbe(item).then(function (url) {
        done++;
        if (url === 'CORS') blocked = true;
        else {
          results[item] = url;
          if (url) log('✔ ' + item);
        }
        $('pbar').style.width = Math.round(done / target.length * 100) + '%';
        if (blocked) return Promise.resolve(); // stop hammering once blocked
        return next();
      });
    }
    var workers = [];
    for (var i = 0; i < CONC; i++) workers.push(next());
    Promise.all(workers).then(function () {
      btn.disabled = false;
      if (blocked) {
        log('ถูกบล็อก (CORS/403) — สลับไปใช้ snippet ขั้นที่ 3');
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

  // ---------- mode 2: console snippet ----------
  function snippetSource() {
    var list = currentScope();
    return '// LEGO image extractor — paste in Console on www.lego.com\n' +
      '(async () => {\n' +
      '  const items = ' + JSON.stringify(list) + ';\n' +
      '  const out = {};\n' +
      '  for (const it of items) {\n' +
      '    try {\n' +
      '      const r = await fetch("https://searchapi.lego.com/api/search?text=" + it + "&country=TH&locale=en-TH", {headers:{Accept:"application/json"}});\n' +
      '      const d = await r.json();\n' +
      '      const hits = d.results || d.products || d.items || [];\n' +
      '      let u = null;\n' +
      '      for (const h of hits) {\n' +
      '        const code = String(h.productCode ?? h.itemNumber ?? h.id ?? "").replace(/^0+/, "");\n' +
      '        if (code === String(it)) { u = h.imageUrl ?? h.image ?? h.thumbnailUrl ?? (h.images && h.images[0]) ?? null; break; }\n' +
      '      }\n' +
      '      out[it] = u;\n' +
      '    } catch (e) { out[it] = null; }\n' +
      '    await new Promise(r2 => setTimeout(r2, 250));\n' +
      '  }\n' +
      '  const json = JSON.stringify(out);\n' +
      '  try { await navigator.clipboard.writeText(json); console.log("COPIED to clipboard ✔", out); }\n' +
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

  // ---------- mode 2b: paste result -> validate -> download ----------
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
