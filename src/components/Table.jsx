import React, { useEffect, useRef, useState } from 'react'

const PROMO_LABEL = { 'Buy 1 Get 1': 'ซื้อ1แถม1', 'Buy 2 Free 1': 'ซื้อ2แถม1' }
const BASE = import.meta.env.BASE_URL
export const CARD_SIZE_KEY = 'cardSize' // 'list' | 'grid'

function fmt(n) {
  return n == null ? '' : Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

function highlight(text, q) {
  const t = esc(text)
  if (!q) return t
  const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi')
  try { return t.replace(re, '<mark>$1</mark>') } catch { return t }
}

function Thumb({ item }) {
  const ref = useRef(null)
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Load everything, but staggered after first paint so the table renders
    // instantly and images fill in quietly (browser caches + parallelizes).
    const t = setTimeout(() => { el.src = el.dataset.src }, 200 + Math.random() * 1800)
    return () => clearTimeout(t)
  }, [])
  return (
    <span className="thumbwrap">
      {!loaded && !failed && <span className="thumb-skeleton" aria-hidden="true" />}
      <img
        ref={ref}
        data-src={`${BASE}img/${encodeURIComponent(item)}.webp`}
        alt={item} title="แตะเพื่อดูรูปใหญ่"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        style={{ opacity: loaded || failed ? 1 : 0, transition: 'opacity .3s' }}
      />
      {failed && <span className="thumb-fallback">🧱</span>}
    </span>
  )
}

export default function Table({ rows, loading, onOpen, cardSize = 'list' }) {
  if (loading) return null
  return (
    <div className={`tablewrap card-${cardSize}`}>
      <table>
        <thead>
          <tr>
            <th></th><th>เซ็ต</th><th>ชื่อ</th>
            <th className="num">ราคาเต็ม</th><th>ลด</th>
            <th className="num">ราคาลด</th><th className="num">ประหยัด</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const save = r.discount_pct && r.sale_price_thb
              ? Number(r.price_thb) - Number(r.sale_price_thb) : null
            const rowClass = r.promo ? 'promo' : (Number(r.price_thb) === Number(r.sale_price_thb) ? 'full' : 'pct')
            return (
              <tr key={r.item} className={rowClass}>
                <td className="imgcell" onClick={() => onOpen(i)}>
                  <Thumb item={r.item} />
                </td>
                <td className="item">
                  <a className="itemlink" href={`https://www.lego.com/en-th/search?q=${encodeURIComponent(r.item)}`}
                     target="_blank" rel="noopener" title={`เปิด LEGO.com ค้นหา ${r.item}`}>
                    {r.item}
                  </a>
                  <CopyButton item={r.item} />
                </td>
                <td className="desc">
                  <span dangerouslySetInnerHTML={{ __html: highlight(r.description, '') }} />
                  {r.promo && <span className="badge">{PROMO_LABEL[r.promo] || r.promo}</span>}
                </td>
                <td className="num full">{fmt(r.price_thb)}</td>
                <td className="disc">{r.discount_pct ? r.discount_pct + '%' : '—'}</td>
                <td className="num sale">{fmt(r.sale_price_thb)}</td>
                <td className="num save">{save ? fmt(save) : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function CopyButton({ item }) {
  const [state, setState] = useState('idle') // idle | ok | fail
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(item)
      setState('ok')
    } catch {
      setState('fail')
    }
    setTimeout(() => setState('idle'), 1200)
  }
  return (
    <button className="copy" onClick={copy} title="คัดลอกรหัสเซ็ต">
      {state === 'ok' ? '✅' : state === 'fail' ? '❌' : '📋'}
    </button>
  )
}
