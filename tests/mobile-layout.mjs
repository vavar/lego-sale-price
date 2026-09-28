// Mobile view test: card list layout (img left, details right) + 2-column grid toggle.
import { chromium } from 'playwright-core'
import assert from 'assert'

const base = process.env.BASE || 'http://localhost:4173/lego-sale-price/'
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] })

const page = await browser.newPage({ viewport: { width: 390, height: 844 } }) // iPhone-ish
const errs = []
page.on('pageerror', e => errs.push(e.message))

await page.goto(base, { waitUntil: 'networkidle', timeout: 60000 })
await page.waitForTimeout(2500)

// toggle visible
assert.ok(await page.locator('.viewtoggle').isVisible(), 'toggle visible on mobile')
console.log('toggle visible ✓')

// list mode: image left (96px), details right, no horizontal scroll
const cardBox = await page.locator('tbody tr').first().boundingBox()
console.log('card width:', cardBox.width, '(viewport 390)')
assert.ok(cardBox.width <= 391, 'card fits viewport, no h-scroll')
const imgBox = await page.locator('td.imgcell').first().boundingBox()
console.log('thumb size:', imgBox.width, 'x', imgBox.height)
assert.ok(imgBox.width > 80, 'big thumbnail (96px)')
assert.ok(imgBox.x < cardBox.x + 30, 'image on the LEFT of card')
const itemBox = await page.locator('td.item').first().boundingBox()
assert.ok(itemBox.x > imgBox.x + imgBox.width - 5, 'details on the RIGHT of image')

// switch to grid mode
await page.getByText('2 คอลัมน์', { exact: false }).click()
await page.waitForTimeout(800)
const gridCards = await page.locator('tbody tr').count()
assert.strictEqual(gridCards, 870, 'grid renders all rows')
const c1 = await page.locator('tbody tr').nth(0).boundingBox()
const c2 = await page.locator('tbody tr').nth(1).boundingBox()
console.log('card1 x:', c1.x, '| card2 x:', c2.x)
assert.ok(Math.abs(c1.y - c2.y) < 30, 'two cards side-by-side (same row)')
assert.ok(c2.x > c1.x, 'second card to the right')
const gimg = await page.locator('.card-grid td.imgcell img').first()
const gb = await gimg.boundingBox()
console.log('grid image:', Math.round(gb.width), 'x', Math.round(gb.height))
assert.ok(gb.width > 130, 'grid image is big (full card width)')

// persistence: reload keeps grid
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(2000)
const stillGrid = await page.locator('.card-grid').count()
assert.ok(stillGrid > 0, 'grid mode persisted after reload')
console.log('grid persisted after reload ✓')

// back to list
await page.getByRole('button', { name: '☰ รายการ' }).click()
await page.waitForTimeout(500)
const listWrap = await page.locator('.card-list').count()
assert.ok(listWrap > 0, 'back to list mode')

// desktop unaffected: toggle also visible but table stays a table at desktop width
const dpage = await browser.newPage({ viewport: { width: 1280, height: 900 } })
await dpage.goto(base, { waitUntil: 'networkidle' })
await dpage.waitForTimeout(1500)
const tbl = await dpage.locator('table').first().boundingBox()
console.log('desktop table width:', tbl.width)
assert.ok(tbl.width > 900, 'desktop keeps wide table')

assert.deepStrictEqual(errs, [], 'no JS errors: ' + errs.join(' | '))
await browser.close()
console.log('\nMOBILE LAYOUT TESTS PASSED ✅')
