/* Lightbox with swipe navigation, double-tap zoom and pinch-zoom.
   vanilla JS; images come from the table rows (img/ local + CDN hi-res). */
(function () {
  'use strict';

  var lb = {
    el: null, img: null, caption: null, hint: null, counter: null,
    list: [], idx: -1,
    scale: 1, tx: 0, ty: 0, minScale: 1,
    pinchStart: null, pinchBase: null,
    lastTap: 0, lastTapXY: null,
    swipeStart: null, dragging: false, moved: false,
    hiresTimer: null
  };
  window.__lb = lb; // exposed for tests

  function fmtPrice(r) {
    if (!r) return '';
    var s = 'Set ' + r.item;
    if (r.discount_pct) {
      s += ' · ลด ' + r.discount_pct + '%' +
        ' · ' + Number(r.sale_price_thb).toLocaleString('th-TH') + ' บาท' +
        ' (จาก ' + Number(r.price_thb).toLocaleString('th-TH') + ')';
    } else if (r.promo) {
      s += ' · ' + r.promo + ' · ' + Number(r.price_thb).toLocaleString('th-TH') + ' บาท';
    } else {
      s += ' · ' + Number(r.price_thb).toLocaleString('th-TH') + ' บาท';
    }
    return s;
  }

  function applyTransform(animate) {
    lb.img.style.transition = animate ? 'transform .18s ease-out' : 'none';
    lb.img.style.transform = 'translate(' + lb.tx + 'px,' + lb.ty + 'px) scale(' + lb.scale + ')';
  }

  function clampPan() {
    var w = lb.img.clientWidth * lb.scale, h = lb.img.clientHeight * lb.scale;
    var maxX = Math.max(0, (w - lb.img.clientWidth) / 2 + 24);
    var maxY = Math.max(0, (h - lb.img.clientHeight) / 2 + 24);
    lb.tx = Math.min(maxX, Math.max(-maxX, lb.tx));
    lb.ty = Math.min(maxY, Math.max(-maxY, lb.ty));
  }

  function hiresCache() {
    var r = lb.list[lb.idx];
    if (!r || !r._hires) {
      if (lb.hiresTimer) { clearTimeout(lb.hiresTimer); lb.hiresTimer = null; }
      return;
    }
    if (lb.hiresTimer) clearTimeout(lb.hiresTimer);
    lb.hiresTimer = setTimeout(function () {
      var im = new Image();
      im.src = r._hires;
    }, 150);
  }

  function show(idx) {
    if (!lb.list.length) return;
    lb.idx = (idx + lb.list.length) % lb.list.length;
    var r = lb.list[lb.idx];

    lb.img.style.opacity = '.25';
    lb.img.onload = function () {
      lb.img.style.opacity = '1';
      lb.scale = 1; lb.tx = 0; lb.ty = 0;
      applyTransform(false);
      // swap in hi-res CDN image if available for this set
      var r = lb.list[lb.idx];
      if (r && r._hires && r._hires !== lb.img.src) {
        var hd = new Image();
        hd.onload = function () {
          if (lb.list[lb.idx] === r) { // user hasn't navigated away meanwhile
            lb.img.src = r._hires;
            lb.hint.style.display = 'none';
          }
        };
        hd.src = r._hires;
      }
    };
    lb.img.src = r._img;

    lb.caption.textContent = fmtPrice(r);
    lb.counter.textContent = (lb.idx + 1) + '/' + lb.list.length;
    lb.hint.style.display = '';
    hiresCache();
  }

  function open(idx) {
    lb.el.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    lb.scale = 1; lb.tx = 0; lb.ty = 0;
    show(idx);
  }

  function close() {
    lb.el.classList.add('hidden');
    document.body.style.overflow = '';
    if (lb.hiresTimer) { clearTimeout(lb.hiresTimer); lb.hiresTimer = null; }
  }

  function dist2(t) {
    var dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY;
    return Math.hypot(dx, dy);
  }

  function onTap(e) {
    var now = Date.now();
    if (lb.lastTap && now - lb.lastTap < 300 &&
        Math.hypot(e.clientX - lb.lastTapXY[0], e.clientY - lb.lastTapXY[1]) < 40) {
      // double tap: toggle 1x <-> 2.5x at tap point
      if (lb.scale > 1.05) {
        lb.scale = 1; lb.tx = 0; lb.ty = 0;
      } else {
        var rect = lb.img.getBoundingClientRect();
        var cx = e.clientX - (rect.left + rect.width / 2);
        var cy = e.clientY - (rect.top + rect.height / 2);
        lb.scale = 2.5;
        lb.tx = -cx * (lb.scale - 1);
        lb.ty = -cy * (lb.scale - 1);
        clampPan();
      }
      applyTransform(true);
      lb.lastTap = 0;
    } else {
      lb.lastTap = now;
      lb.lastTapXY = [e.clientX, e.clientY];
    }
  }

  function init() {
    var el = document.getElementById('lb');
    lb.el = el;
    lb.img = el.querySelector('.lb-img');
    lb.caption = el.querySelector('.lb-caption');
    lb.hint = el.querySelector('.lb-hint');
    lb.counter = el.querySelector('.lb-counter');

    lb.img.addEventListener('load', function () {
      lb.hint.style.display = 'none';
    });
    // still show a usable state if the image errors (offline, CDN change)
    lb.img.addEventListener('error', function () { lb.hint.style.display = 'none'; });

    // open from table (event delegation)
    document.getElementById('tbody').addEventListener('click', function (ev) {
      var im = ev.target.closest ? ev.target.closest('img[data-item]') : null;
      if (!im) return;
      var item = im.getAttribute('data-item');
      var idx = -1;
      for (var i = 0; i < lb.list.length; i++) {
        if (lb.list[i].item === item) { idx = i; break; }
      }
      if (idx >= 0) open(idx);
    });

    el.querySelector('.lb-close').addEventListener('click', close);
    el.querySelector('.lb-prev').addEventListener('click', function () { show(lb.idx - 1); });
    el.querySelector('.lb-next').addEventListener('click', function () { show(lb.idx + 1); });
    el.addEventListener('click', function (ev) { if (ev.target === el) close(); });
    document.addEventListener('keydown', function (ev) {
      if (lb.el.classList.contains('hidden')) return;
      if (ev.key === 'Escape') close();
      else if (ev.key === 'ArrowLeft') show(lb.idx - 1);
      else if (ev.key === 'ArrowRight') show(lb.idx + 1);
    });

    // ---- gestures on the image ----
    var img = lb.img;

    img.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) {
        lb.pinchStart = dist2(e.touches);
        lb.pinchBase = lb.scale;
        lb.dragging = false;
      } else if (e.touches.length === 1) {
        lb.dragging = lb.scale > 1.05;
        lb.swipeStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
        lb.moved = false;
      }
    }, { passive: true });

    img.addEventListener('touchmove', function (e) {
      if (e.touches.length === 2 && lb.pinchStart) {
        var ratio = dist2(e.touches) / lb.pinchStart;
        lb.scale = Math.min(6, Math.max(1, lb.pinchBase * ratio));
        if (lb.scale <= 1.01) { lb.tx = 0; lb.ty = 0; }
        applyTransform(false);
        e.preventDefault();
      } else if (e.touches.length === 1 && lb.dragging) {
        var t = e.touches[0];
        var prev = lb._lastPt || lb.swipeStart;
        lb.tx += t.clientX - prev.x;
        lb.ty += t.clientY - prev.y;
        lb._lastPt = { x: t.clientX, y: t.clientY };
        lb.moved = true;
        clampPan();
        applyTransform(false);
        e.preventDefault();
      } else if (e.touches.length === 1 && !lb.dragging) {
        var s = e.touches[0];
        if (Math.hypot(s.clientX - lb.swipeStart.x, s.clientY - lb.swipeStart.y) > 12) lb.moved = true;
      }
    }, { passive: false });

    img.addEventListener('touchend', function (e) {
      if (e.touches.length === 0) {
        lb.pinchStart = null; lb.pinchBase = null; lb._lastPt = null;
        var s = lb.swipeStart;
        lb.dragging = false;
        if (s) {
          var ch = e.changedTouches[0];
          var dx = (ch ? ch.clientX : s.x) - s.x;
          var dy = (ch ? ch.clientY : s.y) - s.y;
          var moved = lb.moved || Math.hypot(dx, dy) > 12;
          var dt = Date.now() - s.t;
          if (!moved) {
            // a tap: double-tap zoom toggle (works zoomed or not)
            onTap({ clientX: ch ? ch.clientX : s.x, clientY: ch ? ch.clientY : s.y });
          } else if (lb.scale <= 1.01 && dt < 600 && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
            // swipe between sets only when not zoomed
            if (dx < 0) show(lb.idx + 1); else show(lb.idx - 1);
          }
        }
        lb.swipeStart = null;
      } else if (e.touches.length === 1 && lb.pinchStart) {
        // two -> one fingers: restart drag baseline
        lb.pinchStart = null;
        lb.dragging = lb.scale > 1.05;
        lb.swipeStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
        lb.moved = true;
        lb._lastPt = null;
      }
    });

    // mouse: drag to pan when zoomed, dblclick to zoom
    img.addEventListener('dblclick', function (e) {
      onTap({ clientX: e.clientX, clientY: e.clientY });
    });
    img.addEventListener('mousedown', function (e) {
      if (lb.scale <= 1.05) return;
      lb.dragging = true;
      lb._lastPt = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    });
    window.addEventListener('mousemove', function (e) {
      if (!lb.dragging || lb.scale <= 1.05) return;
      lb.tx += e.clientX - (lb._lastPt ? lb._lastPt.x : e.clientX);
      lb.ty += e.clientY - (lb._lastPt ? lb._lastPt.y : e.clientY);
      lb._lastPt = { x: e.clientX, y: e.clientY };
      clampPan();
      applyTransform(false);
    });
    window.addEventListener('mouseup', function () { lb.dragging = false; lb._lastPt = null; });
    img.addEventListener('wheel', function (e) {
      if (!lb.el.classList.contains('hidden')) {
        e.preventDefault();
        lb.scale = Math.min(6, Math.max(1, lb.scale * (e.deltaY < 0 ? 1.15 : 0.87)));
        if (lb.scale <= 1.01) { lb.tx = 0; lb.ty = 0; }
        clampPan();
        applyTransform(true);
      }
    }, { passive: false });

    // block lightbox backdrop pinch-from-edge browser zoom weirdness
    el.addEventListener('touchmove', function (e) {
      if (e.touches.length >= 2) e.preventDefault();
    }, { passive: false });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
