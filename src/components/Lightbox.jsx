import React, { useEffect, useRef, useState } from 'react'
import { Modal, Button } from '@heroui/react'

const BASE = import.meta.env.BASE_URL

export default function Lightbox({ list, idx, onClose, onNavigate }) {
  const r = list[idx]
  const imgRef = useRef(null)
  const [showHint, setShowHint] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const s = useRef({
    scale: 1, tx: 0, ty: 0,
    pinchStart: 0, pinchBase: 1,
    dragging: false, lastTap: 0, lastTapXY: null,
    swipe: null, moved: false, lastPt: null,
  }).current

  const show = (i) => {
    onNavigate((i + list.length) % list.length)
    setShowHint(true)
  }

  function apply(animate) {
    const el = imgRef.current
    if (!el) return
    el.style.transition = animate ? 'transform .18s ease-out' : 'none'
    el.style.transform = `translate(${s.tx}px,${s.ty}px) scale(${s.scale})`
  }

  function clampPan() {
    const el = imgRef.current
    if (!el) return
    const w = el.clientWidth * s.scale, h = el.clientHeight * s.scale
    const mx = Math.max(0, (w - el.clientWidth) / 2 + 24)
    const my = Math.max(0, (h - el.clientHeight) / 2 + 24)
    s.tx = Math.min(mx, Math.max(-mx, s.tx))
    s.ty = Math.min(my, Math.max(-my, s.ty))
  }

  // reset transform per image + preload hi-res, swap when ready
  useEffect(() => {
    s.scale = 1; s.tx = 0; s.ty = 0
    apply(false)
    setShowHint(true)
    const hires = `https://cdn.rebrickable.com/media/sets/${encodeURIComponent(r.item)}-1.jpg`
    const hd = new Image()
    hd.onload = () => setReloadKey(k => k + 1)
    hd.src = hires
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx])

  const dist2 = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)

  function doubleTapZoom(e) {
    const now = Date.now()
    if (s.lastTap && now - s.lastTap < 300 &&
        Math.hypot(e.clientX - s.lastTapXY[0], e.clientY - s.lastTapXY[1]) < 40) {
      if (s.scale > 1.05) { s.scale = 1; s.tx = 0; s.ty = 0 }
      else {
        const rect = imgRef.current.getBoundingClientRect()
        const cx = e.clientX - (rect.left + rect.width / 2)
        const cy = e.clientY - (rect.top + rect.height / 2)
        s.scale = 2.5
        s.tx = -cx * (s.scale - 1); s.ty = -cy * (s.scale - 1)
        clampPan()
      }
      apply(true)
      s.lastTap = 0
    } else { s.lastTap = now; s.lastTapXY = [e.clientX, e.clientY] }
  }

  // keyboard
  useEffect(() => {
    const fn = e => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') show(idx - 1)
      else if (e.key === 'ArrowRight') show(idx + 1)
    }
    document.addEventListener('keydown', fn)
    return () => document.removeEventListener('keydown', fn)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx])

  if (!r) return null
  const price = Number(r.price_thb).toLocaleString('th-TH')
  const sale = r.sale_price_thb ? Number(r.sale_price_thb).toLocaleString('th-TH') : null
  const caption = r.discount_pct
    ? `Set ${r.item} · ลด ${r.discount_pct}% · ${sale} บาท (จาก ${price})`
    : r.promo
      ? `Set ${r.item} · ${r.promo} · ${price} บาท`
      : `Set ${r.item} · ${price} บาท`

  return (
    <Modal.Backdrop isOpen onOpenChange={open => { if (!open) onClose() }}>
      <Modal.Container size="cover" className="bg-transparent shadow-none">
        <div className="lb-stage">
          <Button
            isIconOnly variant="secondary" className="lb-btn lb-prev rounded-full"
            onPress={() => show(idx - 1)} aria-label="ก่อนหน้า"
          >‹</Button>

          <img
            ref={imgRef}
            key={`${r.item}-${reloadKey}`}
            className="lb-img"
            src={`${BASE}img/${encodeURIComponent(r.item)}.webp`}
            alt={r.item}
            onTouchStart={e => {
              if (e.touches.length === 2) { s.pinchStart = dist2(e.touches); s.pinchBase = s.scale; s.dragging = false }
              else if (e.touches.length === 1) {
                s.dragging = s.scale > 1.05
                s.swipe = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() }
                s.moved = false
              }
            }}
            onTouchMove={e => {
              if (e.touches.length === 2 && s.pinchStart) {
                s.scale = Math.min(6, Math.max(1, s.pinchBase * dist2(e.touches) / s.pinchStart))
                if (s.scale <= 1.01) { s.tx = 0; s.ty = 0 }
                apply(false); e.preventDefault()
              } else if (e.touches.length === 1 && s.dragging) {
                const t = e.touches[0]
                const prev = s.lastPt || s.swipe
                s.tx += t.clientX - prev.x; s.ty += t.clientY - prev.y
                s.lastPt = { x: t.clientX, y: t.clientY }; s.moved = true
                clampPan(); apply(false); e.preventDefault()
              } else if (e.touches.length === 1 && !s.dragging && s.swipe) {
                if (Math.hypot(e.touches[0].clientX - s.swipe.x, e.touches[0].clientY - s.swipe.y) > 12) s.moved = true
              }
            }}
            onTouchEnd={e => {
              if (e.touches.length === 0) {
                s.pinchStart = 0; s.lastPt = null; s.dragging = false
                const sw = s.swipe; s.swipe = null
                if (sw) {
                  const ch = e.changedTouches[0]
                  const dx = (ch ? ch.clientX : sw.x) - sw.x
                  const dy = (ch ? ch.clientY : sw.y) - sw.y
                  const moved = s.moved || Math.hypot(dx, dy) > 12
                  if (!moved) doubleTapZoom({ clientX: ch ? ch.clientX : sw.x, clientY: ch ? ch.clientY : sw.y })
                  else if (s.scale <= 1.01 && Date.now() - sw.t < 600 && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
                    if (dx < 0) show(idx + 1); else show(idx - 1)
                  }
                }
              } else if (e.touches.length === 1 && s.pinchStart) {
                s.pinchStart = 0
                s.dragging = s.scale > 1.05
                s.swipe = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() }
                s.moved = true; s.lastPt = null
              }
            }}
            onDoubleClick={e => doubleTapZoom(e)}
            onMouseDown={e => { if (s.scale > 1.05) { s.dragging = true; s.lastPt = { x: e.clientX, y: e.clientY }; e.preventDefault() } }}
            onMouseMove={e => {
              if (!s.dragging || s.scale <= 1.05) return
              s.tx += e.clientX - (s.lastPt ? s.lastPt.x : e.clientX)
              s.ty += e.clientY - (s.lastPt ? s.lastPt.y : e.clientY)
              s.lastPt = { x: e.clientX, y: e.clientY }
              clampPan(); apply(false)
            }}
            onMouseUp={() => { s.dragging = false; s.lastPt = null }}
            onWheel={e => {
              s.scale = Math.min(6, Math.max(1, s.scale * (e.deltaY < 0 ? 1.15 : 0.87)))
              if (s.scale <= 1.01) { s.tx = 0; s.ty = 0 }
              clampPan(); apply(true)
            }}
          />

          <Button
            isIconOnly variant="secondary" className="lb-btn lb-next rounded-full"
            onPress={() => show(idx + 1)} aria-label="ถัดไป"
          >›</Button>

          <div className="lb-hint" style={{ display: showHint ? '' : 'none' }}>
            pinch เพื่อซูม · แตะ 2 ครั้งเพื่อซูม · ปัดซ้าย/ขวาเพื่อดูเซ็ตอื่น
          </div>
          <div className="lb-counter">{idx + 1}/{list.length}</div>
          <div className="lb-caption">{caption}</div>
        </div>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
