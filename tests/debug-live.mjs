import { chromium } from 'playwright-core'

const base = process.env.BASE || 'http://localhost:4174/lego-sale-price/'
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
const errs = []
page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 400)) })
page.on('requestfailed', r => errs.push('REQFAIL: ' + r.url().slice(0, 120) + ' ' + (r.failure()?.errorText ?? '')))

const resp = await page.goto(base, { waitUntil: 'networkidle', timeout: 60000 }).catch(e => { errs.push('goto: ' + e.message); return null })
console.log('HTTP:', resp ? resp.status() : 'n/a')
await page.waitForTimeout(3000)

const info = await page.evaluate(() => ({
  title: document.title,
  rootExists: !!document.getElementById('root'),
  rootChildren: document.getElementById('root') ? document.getElementById('root').children.length : -1,
  rootHtml: document.getElementById('root') ? document.getElementById('root').innerHTML.slice(0, 200) : null,
  bodyClass: document.body.className,
  rows: document.querySelectorAll('tbody tr').length,
}))
console.log(JSON.stringify(info, null, 1))
console.log('errors:', errs.length ? errs.slice(0, 8) : 'none')
await browser.close()
