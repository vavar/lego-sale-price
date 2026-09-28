// Browser smoke test for the Vite/React build on vite preview (port 4173).
// Uses system Chromium via playwright-core (no browser download).
import { chromium } from 'playwright-core'
import assert from 'assert'

const URL = 'http://[::1]:4173/lego-sale-price/'

const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const errors = []
page.on('pageerror', e => errors.push(String(e)))
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })

await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(2500)

const rows = page.locator('tbody tr')
let n = await rows.count()
console.log('rows rendered:', n)
assert.strictEqual(n, 870, '870 rows, got ' + n)

// search narrows
await page.fill("input[type='search']", 'batman')
await page.waitForTimeout(600)
n = await rows.count()
console.log("search 'batman':", n)
assert.ok(n > 0 && n < 870, 'search narrows')

await page.fill("input[type='search']", '')
await page.waitForTimeout(600)
assert.strictEqual(await rows.count(), 870, 'clear restores 870')

// chip filter
await page.getByText('ซื้อ 1 แถม 1', { exact: true }).click()
await page.waitForTimeout(500)
n = await rows.count()
console.log('B1G1 filter:', n)
assert.ok(n > 30 && n < 50, 'b1g1 count ' + n)
await page.getByText('ทั้งหมด', { exact: true }).click()
await page.waitForTimeout(400)

// lightbox open/close
await page.locator('td.imgcell').first().click()
await page.waitForTimeout(1200)
const lb = page.locator('.lb-img').first()
assert.ok(await lb.isVisible(), 'lightbox image visible')
const caption = await page.locator('.lb-caption').innerText()
console.log('lightbox caption:', caption.slice(0, 80))
assert.ok(caption.includes('Set'))
await page.keyboard.press('Escape')
await page.waitForTimeout(500)
assert.ok(!(await lb.isVisible()), 'lightbox closed')

// sale picker hidden while only one sale exists
const pickerVisible = await page.locator('.salepicker').first().isVisible().catch(() => false)
console.log('salepicker visible:', pickerVisible)

const realErrors = errors.filter(e => !e.includes('favicon'))
console.log('console/page errors:', realErrors.length ? realErrors.slice(0, 5) : 'none')
assert.strictEqual(realErrors.length, 0, 'no JS errors: ' + realErrors.slice(0, 3).join(' | '))

await browser.close()
console.log('\nALL BROWSER TESTS PASSED ✅')
