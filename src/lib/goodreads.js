// Parse Goodreads CSV export into our book format
// Goodreads CSV columns: Book Id, Title, Author, Author l-f, Additional Authors,
// ISBN, ISBN13, My Rating, Average Rating, Publisher, Binding, Number of Pages,
// Year Published, Original Publication Year, Date Read, Date Added,
// Bookshelves, Bookshelves with positions, Exclusive Shelf, My Review,
// Spoiler, Private Notes, Read Count, Owned Copies

export function parseGoodreadsCSV(csvText) {
  const lines = parseCSVLines(csvText)
  if (lines.length < 2) return []

  const headers = lines[0].map(h => h.trim())
  const books = []

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i]
    if (row.length < headers.length) continue

    const obj = {}
    headers.forEach((h, idx) => {
      obj[h] = (row[idx] || '').trim()
    })

    // Only import books from the "read" shelf
    const shelf = obj['Exclusive Shelf'] || ''
    if (shelf.toLowerCase() !== 'read') continue

    // Clean ISBN — Goodreads wraps in ="..." 
    let isbn = obj['ISBN13'] || obj['ISBN'] || ''
    isbn = isbn.replace(/^="?/, '').replace(/"$/, '').trim()

    // Parse date — Goodreads uses YYYY/MM/DD format
    let dateRead = null
    const rawDate = obj['Date Read'] || ''
    if (rawDate) {
      const parsed = new Date(rawDate)
      if (!isNaN(parsed.getTime())) {
        dateRead = parsed.toISOString().split('T')[0]
      }
    }

    const rating = parseInt(obj['My Rating']) || 0

    books.push({
      title: obj['Title'] || '',
      author: obj['Author'] || '',
      isbn: isbn || null,
      rating: rating > 0 ? rating : null,
      date_read: dateRead,
      shelves: obj['Bookshelves'] || null,
      review: obj['My Review'] || null,
    })
  }

  return books.filter(b => b.title && b.author)
}

// Proper CSV parser that handles quoted fields with commas, newlines, etc.
function parseCSVLines(text) {
  const rows = []
  let current = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"'
        i++ // skip escaped quote
      } else if (ch === '"') {
        inQuotes = false
      } else {
        field += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        current.push(field)
        field = ''
      } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        current.push(field)
        field = ''
        if (current.some(f => f.trim())) rows.push(current)
        current = []
        if (ch === '\r') i++ // skip \n after \r
      } else {
        field += ch
      }
    }
  }

  // Last field/row
  if (field || current.length) {
    current.push(field)
    if (current.some(f => f.trim())) rows.push(current)
  }

  return rows
}
