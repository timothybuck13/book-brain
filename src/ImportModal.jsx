import { useState, useRef } from 'react'
import { parseGoodreadsCSV } from './lib/goodreads'
import { importBooks } from './lib/supabase'

export default function ImportModal({ userId, onClose, onImportComplete }) {
  const [dragging, setDragging] = useState(false)
  const [status, setStatus] = useState('idle') // idle | parsing | importing | done | error
  const [progress, setProgress] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  async function handleFile(file) {
    if (!file || !file.name.endsWith('.csv')) {
      setError('Please upload a CSV file from Goodreads.')
      setStatus('error')
      return
    }

    setStatus('parsing')
    setError(null)

    try {
      const text = await file.text()
      const books = parseGoodreadsCSV(text)

      if (books.length === 0) {
        setError('No read books found in the CSV. Make sure you exported from Goodreads and have books on your "read" shelf.')
        setStatus('error')
        return
      }

      setProgress({ parsed: books.length, imported: 0 })
      setStatus('importing')

      const res = await importBooks(userId, books)
      setResult(res)
      setStatus('done')
      
      if (onImportComplete) onImportComplete(res)
    } catch (err) {
      console.error('Import error:', err)
      setError('Failed to import books. Please try again.')
      setStatus('error')
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer?.files?.[0]
    if (file) handleFile(file)
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-backdrop" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl animate-modal"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-sans font-semibold text-xl tracking-wide">Import from Goodreads</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {status === 'idle' || status === 'error' ? (
          <>
            <div className="mb-4">
              <p className="font-sans text-sm text-gray-600 leading-relaxed">
                Export your Goodreads library as a CSV file, then upload it here. We'll import all the books you've read.
              </p>
              <div className="mt-3 bg-amber-50 rounded-lg p-3">
                <p className="font-sans text-xs text-amber-800 leading-relaxed">
                  <strong>How to export:</strong> Go to{' '}
                  <a
                    href="https://www.goodreads.com/review/import"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:no-underline"
                  >
                    goodreads.com/review/import
                  </a>
                  {' '}→ click "Export Library" → download the CSV file.
                </p>
              </div>
            </div>

            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                dragging ? 'border-amber-400 bg-amber-50' : 'border-gray-200 hover:border-gray-300'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="mx-auto mb-3 w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <p className="font-sans text-sm text-gray-500">
                Drop your Goodreads CSV here or <span className="text-amber-600 underline">browse</span>
              </p>
            </div>

            {error && (
              <div className="mt-3 flex items-start gap-2 px-3 py-2.5 bg-red-50 rounded-lg">
                <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <p className="text-sm text-red-700 font-sans leading-snug">{error}</p>
              </div>
            )}
          </>
        ) : status === 'parsing' ? (
          <div className="py-6">
            <p className="font-sans text-sm text-gray-500 text-center mb-4">Reading your library...</p>
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className={`skeleton-book-row animate-fade-in-up stagger-${i}`}>
                  <div className="skeleton skeleton-cover" />
                  <div className="skeleton-lines">
                    <div className="skeleton skeleton-text-lg" style={{ width: `${75 - i * 10}%` }} />
                    <div className="skeleton skeleton-text" style={{ width: `${55 - i * 8}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : status === 'importing' ? (
          <div className="py-6">
            <p className="font-sans text-sm text-gray-500 text-center mb-4">
              Importing {progress?.parsed || 0} books...
            </p>
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className={`skeleton-book-row animate-fade-in-up stagger-${i}`}>
                  <div className="skeleton skeleton-cover" />
                  <div className="skeleton-lines">
                    <div className="skeleton skeleton-text-lg" style={{ width: `${80 - i * 12}%` }} />
                    <div className="skeleton skeleton-text" style={{ width: `${60 - i * 8}%` }} />
                  </div>
                  <div className="w-10 h-3 skeleton skeleton-text flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>
        ) : status === 'done' ? (
          <div className="py-8 text-center animate-fade-in">
            <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-green-50 flex items-center justify-center animate-fade-in-scale">
              <svg className="w-7 h-7 text-green-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="font-sans text-lg text-gray-800 mb-1">
              Imported {result?.imported || 0} books!
            </p>
            {result?.skipped > 0 && (
              <p className="font-sans text-sm text-gray-500">
                {result.skipped} already in your library (skipped)
              </p>
            )}
            <button
              onClick={onClose}
              className="mt-4 px-6 py-2 bg-amber-600 text-white rounded-xl font-sans text-sm hover:bg-amber-700 btn-press"
            >
              Start Chatting
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
