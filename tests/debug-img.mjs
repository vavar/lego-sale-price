import { chromium } from 'playwright-core'

const base = process.env.BASE || 'https://vavar.github.io/lego-sale-price/'
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 250)) })
page.on('requestfailed', r => errs.push('REQFAIL: ' + r.url().slice(0, 140)))

await page.goto(base, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(4000)

const imgs = await page.evaluate(() => {
  const list = [...document.querySelectorAll('td.imgcell img')]
  return {
    total: list.length,
    withSrc: list.filter(i => i.src && i.src.startsWith('http')).length,
    withDataSrc: list.filter(i => i.getAttribute('data-src')).length,
    loaded: list.filter(i => i.complete && i.naturalWidth > 0).length,
    sample: list.slice(0, 3).map(i => ({ src: i.src, dsrc: i.getAttribute('data-src'), complete: i.complete, w: i.naturalWidth })),
  }
})
console.log(JSON.stringify(imgs, null, 1))
console.log('errors:', errs.length ? errs.slice(0, 6) : 'none')
await browser.close()
