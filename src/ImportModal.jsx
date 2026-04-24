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
              
              <p className="font-sans text-sm text-gray-500">
                Drop your Goodreads CSV here or <span className="text-amber-600 underline">browse</span>
              </p>
            </div>

            {error && (
              <p className="mt-3 text-sm text-red-600 font-sans">{error}</p>
            )}
          </>
        ) : status === 'parsing' ? (
          <div className="py-8 text-center">
            
            <p className="font-sans text-sm text-gray-500">Reading your library...</p>
          </div>
        ) : status === 'importing' ? (
          <div className="py-8 text-center">
            
            <p className="font-sans text-sm text-gray-500">
              Importing {progress?.parsed || 0} books...
            </p>
          </div>
        ) : status === 'done' ? (
          <div className="py-8 text-center">
            
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
              className="mt-4 px-6 py-2 bg-amber-600 text-white rounded-xl font-sans text-sm hover:bg-amber-700 transition-colors"
            >
              Start Chatting
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
