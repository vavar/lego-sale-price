const { chromium } = require('playwright-core')

const BASE = 'http://localhost:4173/lego-sale-price/'

;(async () => {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const ctx = await browser.newContext({
    viewport: { width: 360, height: 740 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push('pageerror: ' + e.message))
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()) })

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForFunction(() => document.querySelectorAll('tbody tr').length > 0, null, { timeout: 20000 })
  await page.waitForTimeout(2500) // let staggered thumbs load

  // === assertions ===
  const bodyText = await page.evaluate(() => document.body.innerText)
  const nan = /NaN|undefined|Infinity/.test(bodyText)
  const overflow = await page.evaluate(() => {
    const bad = []
    const docW = document.documentElement.clientWidth
    document.querySelectorAll('tbody tr, td, th, .controls, .viewtoggle').forEach(el => {
      if (el.scrollWidth > docW + 2) bad.push(el.tagName + '.' + el.className + ' sw=' + el.scrollWidth + ' doc=' + docW)
    }
    )
    const horizScroll = document.documentElement.scrollWidth > docW + 2
    return { bad: bad.slice(0, 10), horizScroll }
  })

  console.log('NaN/undefined present:', nan)
  console.log('horizontal scroll:', overflow.horizScroll)
  console.log('overflow elements:', overflow.bad.length ? overflow.bad.join(' | ') : 'none')

  // === screenshots ===
  await page.screenshot({ path: 'shots/mobile-list.png', fullPage: false })
  await page.click('.seg button:nth-child(2)')
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'shots/mobile-grid.png', fullPage: false })

  // grid at 320px — worst case
  await page.setViewportSize({ width: 320, height: 700 })
  await page.waitForTimeout(400)
  const ov320 = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2)
  console.log('overflow @320px:', ov320)

  console.log('JS errors:', errors.length ? errors.join(' | ') : 'none')
  await browser.close()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
