import React, { useEffect, useRef, useState } from 'react'

const PROMO_LABEL = { 'Buy 1 Get 1': 'ซื้อ1แถม1', 'Buy 2 Free 1': 'ซื้อ2แถม1' }
const BASE = import.meta.env.BASE_URL
export const CARD_SIZE_KEY = 'cardSize' // 'list' | 'grid'

function fmt(n) {
  const num = Number(n)
  if (!Number.isFinite(num)) return ''
  // drop ".00" on whole baht amounts — less noise, narrower cells on mobile
  return num.toLocaleString('th-TH', Number.isInteger(num)
    ? { maximumFractionDigits: 0 }
    : { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// safe numeric parse — sale_price_thb can hold promo text (e.g. "Buy 2 Free 1")
function toNum(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
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
        width="84" height="84"
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
            <th scope="col"></th><th scope="col">เซ็ต</th><th scope="col">ชื่อ</th>
            <th scope="col" className="num">ราคาเต็ม</th><th scope="col">ลด</th>
            <th scope="col" className="num">ราคาลด</th><th scope="col" className="num">ประหยัด</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const price = toNum(r.price_thb)
            const sale = toNum(r.sale_price_thb)
            const save = sale != null && price != null ? price - sale : null
            const promoText = r.promo ? (PROMO_LABEL[r.promo] || r.promo) : null
            const rowClass = r.promo ? 'promo' : (sale != null && price != null && sale === price ? 'full' : 'pct')
            return (
              <tr key={r.item} className={rowClass}>
                <td className="imgcell"
                    onClick={() => onOpen(i)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(i) } }}
                    role="button" tabIndex={0}
                    aria-label={`ดูรูปใหญ่ เซ็ต ${r.item}`}>
                  <Thumb item={r.item} />
                </td>
                <td className="item">
                  <a className="itemlink" href={`https://shopee.co.th/search?keyword=lego%20${encodeURIComponent(r.item)}`}
                     target="_blank" rel="noopener" title={`ค้นหา "${r.item}" บน Shopee`}>
                    {r.item}
                  </a>
                  <CopyButton item={r.item} />
                </td>
                <td className="desc">
                  <span dangerouslySetInnerHTML={{ __html: highlight(r.description, '') }} />
                </td>
                <td className="num full">{price != null ? fmt(price) : '—'}</td>
                <td className="disc">{r.discount_pct ? r.discount_pct + '%' : '—'}</td>
                <td className={'num sale' + (sale == null ? ' promo-text' : '')}>
                  {sale != null ? fmt(sale) : (promoText || '—')}
                  {r.discount_pct ? <span className="pill">−{r.discount_pct}%</span> : null}
                </td>
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
    <button className="copy" onClick={copy} title="คัดลอกรหัสเซ็ต" aria-label={`คัดลอกรหัสเซ็ต ${item}`}>
      {state === 'ok' ? '✅' : state === 'fail' ? '❌' : '📋'}
    </button>
  )
}
