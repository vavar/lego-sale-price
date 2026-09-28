// Minimal RFC-4180-ish CSV parser (handles quoted fields with commas/quotes).
export function parseCSV(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  const out = []
  let row = [], field = '', inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQ = false
      } else field += c
    } else if (c === '"') inQ = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n') { row.push(field); out.push(row); row = []; field = '' }
    else if (c !== '\r') field += c
  }
  if (field !== '' || row.length) { row.push(field); out.push(row) }
  return out
}
