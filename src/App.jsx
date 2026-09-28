import React, { useEffect, useMemo, useState } from 'react'
import Table from './components/Table.jsx'
import Lightbox from './components/Lightbox.jsx'
import Controls from './components/Controls.jsx'
import { parseCSV } from './lib/csv.js'

const MANIFEST = import.meta.env.BASE_URL + 'data/sales.json'

export default function App() {
  const [sales, setSales] = useState([])
  const [saleId, setSaleId] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // filter/sort state lives here so both Controls and Table share it
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [minDisc, setMinDisc] = useState(0)
  const [sort, setSort] = useState('item')
  const [onlyReview, setOnlyReview] = useState(false)
  const [lightboxIdx, setLightboxIdx] = useState(-1)

  // load manifest once
  useEffect(() => {
    fetch(MANIFEST)
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json() })
      .then(m => {
        setSales(m)
        if (m.length) setSaleId(m[m.length - 1].id) // default: latest sale
      })
      .catch(e => setError('โหลดรายการงวดไม่สำเร็จ: ' + e.message))
  }, [])

  // load selected sale's CSV
  useEffect(() => {
    if (!saleId) return
    setLoading(true)
    setError(null)
    const sale = sales.find(s => s.id === saleId)
    fetch(import.meta.env.BASE_URL + sale.file)
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text() })
      .then(text => {
        const grid = parseCSV(text)
        const header = grid.shift()
        const idx = {}
        header.forEach((h, i) => { idx[h.trim()] = i })
        const list = grid.filter(g => g.length > 1 && g[idx.item]).map(g => ({
          item: g[idx.item],
          description: g[idx.description],
          price_thb: g[idx.price_thb],
          discount_pct: g[idx.discount_pct],
          sale_price_thb: g[idx.sale_price_thb],
          promo: g[idx.promo],
          needs_review: g[idx.needs_review],
        }))
        setRows(list)
        setLoading(false)
      })
      .catch(e => { setError('โหลดข้อมูลไม่สำเร็จ: ' + e.message); setLoading(false) })
  }, [saleId, sales])

  const filtered = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean)
    let list = rows.filter(r => {
      if (onlyReview && r.needs_review !== '1') return false
      if (minDisc > 0 && !(Number(r.discount_pct || 0) >= minDisc)) return false
      if (filter === 'pct' && !r.discount_pct) return false
      if (filter === 'b1g1' && r.promo !== 'Buy 1 Get 1') return false
      if (filter === 'b2f1' && r.promo !== 'Buy 2 Free 1') return false
      if (filter === 'full' && (r.discount_pct || r.promo)) return false
      if (words.length) {
        const hay = (r.item + ' ' + r.description).toLowerCase()
        if (!words.every(w => hay.includes(w))) return false
      }
      return true
    })
    const cmp = {
      'item': (a, b) => a.item.localeCompare(b.item, undefined, { numeric: true }),
      'disc-desc': (a, b) => (Number(b.discount_pct) || 0) - (Number(a.discount_pct) || 0),
      'save-desc': (a, b) => (Number(b.price_thb) - Number(b.sale_price_thb)) - (Number(a.price_thb) - Number(a.sale_price_thb)),
      'price-desc': (a, b) => Number(b.price_thb) - Number(a.price_thb),
      'price-asc': (a, b) => Number(a.price_thb) - Number(b.price_thb),
    }[sort]
    if (cmp) list = [...list].sort(cmp)
    return list
  }, [rows, q, filter, minDisc, sort, onlyReview])

  return (
    <div className="wrap">
      <header>
        <h1>🧱 LEGO <span className="accent">ราคาลด</span></h1>
        <p className="sub">
          {loading ? 'กำลังโหลดข้อมูล…' : `งวด: ${sales.find(s => s.id === saleId)?.label ?? ''} · แสดง ${filtered.length.toLocaleString('th-TH')} / ${rows.length.toLocaleString('th-TH')} รายการ`}
        </p>
      </header>

      {sales.length > 1 && (
        <div className="salepicker">
          <label htmlFor="sale">งวดโปรโมชัน: </label>
          <select id="sale" value={saleId ?? ''} onChange={e => setSaleId(e.target.value)}>
            {sales.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      )}

      <Controls
        q={q} setQ={setQ}
        filter={filter} setFilter={setFilter}
        minDisc={minDisc} setMinDisc={setMinDisc}
        sort={sort} setSort={setSort}
        onlyReview={onlyReview} setOnlyReview={setOnlyReview}
      />

      {error && <div className="error">{error}</div>}

      <Table rows={filtered} loading={loading} onOpen={setLightboxIdx} />

      <footer>
        ข้อมูลแกะจากใบปิดราคาหน้าร้าน ·{' '}
        <a href={import.meta.env.BASE_URL + (sales.find(s => s.id === saleId)?.file ?? '')}>ดาวน์โหลด CSV</a> ·{' '}
        <a href="https://github.com/vavar/lego-sale-price" target="_blank" rel="noopener">github.com/vavar/lego-sale-price</a>
      </footer>

      {lightboxIdx >= 0 && (
        <Lightbox list={filtered} idx={lightboxIdx} onClose={() => setLightboxIdx(-1)} onNavigate={setLightboxIdx} />
      )}
    </div>
  )
}
