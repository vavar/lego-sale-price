const { chromium } = require('playwright-core')
;(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--disable-dev-shm-usage'] })
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  await page.goto('http://localhost:4174/lego-sale-price/', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.querySelectorAll('tbody tr').length > 0, null, { timeout: 20000 })
  await page.waitForTimeout(800)

  const report = {}

  // --- 1. touch: no hover effect on touch device ---
  const firstTr = page.locator('tbody tr').first()
  await firstTr.scrollIntoViewIfNeeded()
  await firstTr.locator('td.imgcell').dispatchEvent('touchstart')
  await firstTr.locator('td.imgcell').dispatchEvent('touchend')
  await page.waitForTimeout(150)
  report.touchHoverBg = await firstTr.evaluate(el => getComputedStyle(el).backgroundColor)

  // --- 3. item link goes to Shopee with "lego <code>" query ---
  report.itemLink = await page.evaluate(() => {
    const a = document.querySelector('a.itemlink')
    return { href: a.href, ok: a.href.includes('shopee.co.th/search?keyword=lego%20') || a.href.includes('shopee.co.th/search?keyword=lego+') }
  })

  // --- 4. selects show text (not blank) ---
  report.selects = await page.evaluate(() =>
    [...document.querySelectorAll('[role="button"][aria-haspopup], .heroui-select__trigger, button[aria-expanded]')]
      .map(el => (el.innerText || '').trim()).filter(Boolean)
  )

  // --- 2. lightbox image centered ---
  await firstTr.locator('td.imgcell').click()
  await page.waitForSelector('.lb-img', { timeout: 10000 })
  await page.waitForTimeout(600)
  report.lightbox = await page.evaluate(() => {
    const img = document.querySelector('.lb-img').getBoundingClientRect()
    const c = document.querySelector('.lb-backdrop .modal__container')
    const cr = c.getBoundingClientRect()
    return {
      imgCenterY: Math.round(img.top + img.height / 2),
      viewportCenterY: Math.round(window.innerHeight / 2),
      offsetX: Math.round((img.left + img.width / 2) - window.innerWidth / 2),
      containerJustify: getComputedStyle(c).justifyContent,
      containerAlign: getComputedStyle(c).alignItems,
    }
  })
  await page.screenshot({ path: 'shots/lightbox-center.png' })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  report.lightboxClosed = await page.evaluate(() => !document.querySelector('.lb-img'))

  // horizontal overflow guard
  report.overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2)

  console.log(JSON.stringify(report, null, 2))
  await browser.close()
})().catch(e => { console.error('FAIL', e.message); process.exit(1) })
