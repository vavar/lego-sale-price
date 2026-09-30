const { chromium } = require('playwright-core')
;(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  const page = await browser.newPage({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await page.goto('http://localhost:4174/lego-sale-price/', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.querySelectorAll('tbody tr').length > 0, null, { timeout: 20000 })
  await page.waitForTimeout(1200)
  await page.click('.seg button:nth-child(2)') // switch to 2-col grid
  await page.waitForTimeout(400)
  const out = await page.evaluate(() => {
    const check = tr => {
      const full = tr.querySelector('.full')
      if (!full || getComputedStyle(full).display === 'none') return null
      const cs = getComputedStyle(full)
      return { text: full.innerText.replace(/\n/g, ''), strike: cs.textDecorationLine }
    }
    const promo = [...document.querySelectorAll('.card-grid tbody tr.promo')][0]
    const pct = [...document.querySelectorAll('.card-grid tbody tr')].find(tr => !tr.classList.contains('promo'))
    const ov = document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
    return { promoRow: check(promo), pctRow: check(pct), overflow: ov }
  })
  console.log(JSON.stringify(out, null, 2))
  await browser.close()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
