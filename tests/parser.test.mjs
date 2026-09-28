// Unit tests for the CSV parser + extraction pipeline (no DOM needed).
import { parseCSV } from '../src/lib/csv.js'
import assert from 'assert'
import fs from 'fs'

// --- parser edge cases ---
const grid = parseCSV('a,b,c\n1,"x, y",3\n4,"say ""hi""",6\r\n7,8,9')
assert.deepStrictEqual(grid[0], ['a', 'b', 'c'])
assert.deepStrictEqual(grid[1], ['1', 'x, y', '3'])
assert.deepStrictEqual(grid[2], ['4', 'say "hi"', '6'])
assert.deepStrictEqual(grid[3], ['7', '8', '9'])
// BOM
assert.deepStrictEqual(parseCSV('\ufeffx\n1')[0], ['x'])

// --- real dataset pipeline: count, math-check, unique items ---
const text = fs.readFileSync('public/data/sales/2026-09-24-27.csv', 'utf8')
const rows = parseCSV(text)
const header = rows.shift()
const idx = {}
header.forEach((h, i) => { idx[h.trim()] = i })
const items = rows.filter(g => g.length > 1 && g[idx.item]).map(g => ({
  item: g[idx.item], price: g[idx.price_thb], disc: g[idx.discount_pct], sale: g[idx.sale_price_thb],
}))
assert.strictEqual(items.length, 870, 'row count 870, got ' + items.length)
const unique = new Set(items.map(r => r.item))
assert.strictEqual(unique.size, 870, 'unique items 870')
for (const r of items) {
  if (r.disc && r.sale) {
    const expected = Math.round(Number(r.price) * (100 - Number(r.disc))) / 100
    assert.ok(Math.abs(expected - Number(r.sale)) <= 0.51,
      `math ${r.item}: ${r.price}x${r.disc}% = ${expected} != ${r.sale}`)
  }
}
// manifest
const manifest = JSON.parse(fs.readFileSync('public/data/sales.json', 'utf8'))
assert.ok(Array.isArray(manifest) && manifest.length >= 1)
assert.ok(fs.existsSync('public/' + manifest[0].file), 'manifest file exists')

console.log('ALL PARSER/DATA TESTS PASSED ✅', { rows: items.length })
