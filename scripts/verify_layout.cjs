const { chromium } = require('playwright-core')
;(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  await page.goto('http://localhost:4173/lego-sale-price/', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.querySelectorAll('tbody tr').length > 0, null, { timeout: 20000 })
  await page.waitForTimeout(1500)

  const metrics = await page.evaluate(() => {
    const pick = sel => {
      const el = document.querySelector(sel)
      if (!el) return null
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), fs: cs.fontSize, fw: cs.fontWeight, color: cs.color, display: cs.display, text: (el.innerText || '').slice(0, 40) }
    }
    // first rows of each flavour
    const promoTr = document.querySelector('tbody tr.promo')       // B1G1: no sale number
    const pctTr = [...document.querySelectorAll('tbody tr')].find(tr => tr.querySelector('.pill'))
    const b2f1Tr = [...document.querySelectorAll('tbody tr')].find(tr => tr.querySelector('.sale.promo-text'))
    const cardInfo = tr => tr ? {
      img: pick.call(null, null) || null,
      thumb: (() => { const t = tr.querySelector('.thumbwrap'); const r = t.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } })(),
      item: (() => { const t = tr.querySelector('.item'); const r = t.getBoundingClientRect(); const cs = getComputedStyle(t); return { x: Math.round(r.x), y: Math.round(r.y), fs: cs.fontSize, text: t.innerText.slice(0, 30) } })(),
      desc: (() => { const t = tr.querySelector('.desc'); const r = t.getBoundingClientRect(); return { y: Math.round(r.y), visible: r.height > 0 } })(),
      sale: (() => { const t = tr.querySelector('.sale'); const r = t.getBoundingClientRect(); const cs = getComputedStyle(t); return { x: Math.round(r.x), y: Math.round(r.y), fs: cs.fontSize, fw: cs.fontWeight, color: cs.color, text: t.innerText.slice(0, 30) } })(),
      hiddenCells: ['full', 'disc', 'save'].filter(c => { const t = tr.querySelector('.' + c); return !t || getComputedStyle(t).display === 'none' }),
      badge: (() => { const t = tr.querySelector('.badge'); if (!t) return null; const r = t.getBoundingClientRect(); return { text: t.innerText, y: Math.round(r.y), visible: r.height > 0 } })(),
      pill: (() => { const t = tr.querySelector('.pill'); if (!t) return null; const r = t.getBoundingClientRect(); return { text: t.innerText, visible: r.height > 0 } })(),
    } : null
    return {
      promoB1G1: cardInfo(promoTr),
      pctRow: cardInfo(pctTr),
      b2f1: cardInfo(b2f1Tr),
      copyBtn: (() => { const b = document.querySelector('button.copy'); const r = b.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) } })(),
    }
  })
  console.log(JSON.stringify(metrics, null, 2))

  // grid mode check
  await page.click('.seg button:nth-child(2)')
  await page.waitForTimeout(600)
  const grid = await page.evaluate(() => {
    const tr = document.querySelector('.card-grid tbody tr')
    const r = tr.getBoundingClientRect()
    const img = tr.querySelector('.thumbwrap').getBoundingClientRect()
    const full = tr.querySelector('.full')
    const sale = tr.querySelector('.sale')
    const fr = full.getBoundingClientRect(); const sr = sale.getBoundingClientRect()
    const csSale = getComputedStyle(sale); const csFull = getComputedStyle(full)
    return {
      cardW: Math.round(r.width), imgW: Math.round(img.width), imgH: Math.round(img.height),
      imgOnTop: img.y < Math.round(r.y) + 20,
      fullVisible: fr.height > 0, fullText: full.innerText, fullStrike: csFull.textDecorationLine,
      saleVisible: sr.height > 0, saleText: sale.innerText, saleBelowFull: sr.y > fr.y,
      saleFw: csSale.fontWeight,
    }
  })
  console.log('GRID:', JSON.stringify(grid, null, 2))
  await browser.close()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
