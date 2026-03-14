import { useState, useMemo, useRef } from 'react'
import { addUserBook, deleteUserBook, deleteUserBooks } from './lib/supabase'

export default function LibraryView({ user, userBooks, setUserBooks, onClose }) {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('date_read')
  const [showAddForm, setShowAddForm] = useState(false)
  const [addTitle, setAddTitle] = useState('')
  const [addAuthor, setAddAuthor] = useState('')
  const [addRating, setAddRating] = useState(0)
  const [addDate, setAddDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false)
  const searchRef = useRef(null)

  const filtered = useMemo(() => {
    let books = [...userBooks]
    if (search.trim()) {
      const q = search.toLowerCase()
      books = books.filter(b =>
        b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)
      )
    }
    books.sort((a, b) => {
      if (sortBy === 'date_read') {
        const da = a.date_read || ''
        const db = b.date_read || ''
        return db.localeCompare(da)
      }
      if (sortBy === 'title') return a.title.localeCompare(b.title)
      if (sortBy === 'author') return a.author.localeCompare(b.author)
      if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0)
      return 0
    })
    return books
  }, [userBooks, search, sortBy])

  async function handleAdd(e) {
    e.preventDefault()
    if (!addTitle.trim() || !addAuthor.trim()) return
    setSaving(true)
    try {
      const book = await addUserBook(user.id, {
        title: addTitle.trim(),
        author: addAuthor.trim(),
        rating: addRating || null,
        date_read: addDate || null,
      })
      setUserBooks(prev => [book, ...prev])
      setAddTitle('')
      setAddAuthor('')
      setAddRating(0)
      setAddDate('')
      setShowAddForm(false)
    } catch (err) {
      console.error('Failed to add book:', err)
    }
    setSaving(false)
  }

  async function handleDelete(bookId) {
    try {
      await deleteUserBook(bookId)
      setUserBooks(prev => prev.filter(b => b.id !== bookId))
      setDeleteConfirm(null)
    } catch (err) {
      console.error('Failed to delete book:', err)
    }
  }

  async function handleDeleteAll() {
    try {
      await deleteUserBooks(user.id)
      setUserBooks([])
      setDeleteAllConfirm(false)
    } catch (err) {
      console.error('Failed to delete all books:', err)
    }
  }

  function StarRating({ rating, interactive, onChange }) {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            onClick={() => interactive && onChange?.(star === rating ? 0 : star)}
            className={`${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-transform`}
          >
            <svg
              className={`w-4 h-4 ${star <= (rating || 0) ? 'text-amber-500' : 'text-gray-200'}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#f2f2f2]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="font-sans font-semibold text-lg">My Library</h2>
          <span className="text-sm text-gray-400 font-sans">{userBooks.length} books</span>
        </div>
        <div className="flex items-center gap-4">
          {deleteAllConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-600 font-sans">Delete all books?</span>
              <button
                onClick={handleDeleteAll}
                className="text-xs font-sans text-white bg-red-600 hover:bg-red-700 px-2 py-1 rounded-md transition-colors"
              >
                Yes, delete
              </button>
              <button
                onClick={() => setDeleteAllConfirm(false)}
                className="text-xs font-sans text-gray-500 hover:text-gray-700 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            userBooks.length > 0 && (
              <button
                onClick={() => setDeleteAllConfirm(true)}
                className="text-xs font-sans text-red-500 hover:text-red-600 transition-colors"
              >
                Delete All
              </button>
            )
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Search + Sort + Add */}
      <div className="px-4 py-3 bg-white border-b border-gray-100 flex-shrink-0">
        <div className="max-w-2xl mx-auto flex flex-col sm:flex-row gap-2">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by title or author..."
              className="w-full pl-9 pr-3 py-2 text-base md:text-sm font-sans bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-300"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="text-base md:text-sm font-sans bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-300"
            >
              <option value="date_read">Date Read</option>
              <option value="title">Title</option>
              <option value="author">Author</option>
              <option value="rating">Rating</option>
            </select>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 text-white text-sm font-sans rounded-lg hover:bg-amber-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Book
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable book list */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-3">
          {/* Add Book Form */}
          {showAddForm && (
            <form onSubmit={handleAdd} className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <input
                  type="text"
                  value={addTitle}
                  onChange={e => setAddTitle(e.target.value)}
                  placeholder="Title"
                  required
                  className="text-base md:text-sm font-sans border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-300"
                  autoFocus
                />
                <input
                  type="text"
                  value={addAuthor}
                  onChange={e => setAddAuthor(e.target.value)}
                  placeholder="Author"
                  required
                  className="text-base md:text-sm font-sans border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-gray-300"
                />
              </div>
              <div className="flex items-center gap-4 mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-sans">Rating:</span>
                  <StarRating rating={addRating} interactive onChange={setAddRating} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-sans">Date read:</span>
                  <input
                    type="date"
                    value={addDate}
                    onChange={e => setAddDate(e.target.value)}
                    className="text-base md:text-sm font-sans border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-gray-300"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving || !addTitle.trim() || !addAuthor.trim()}
                  className="px-4 py-1.5 bg-amber-600 text-white text-sm font-sans rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddForm(false); setAddTitle(''); setAddAuthor(''); setAddRating(0); setAddDate('') }}
                  className="px-4 py-1.5 text-gray-500 text-sm font-sans rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Empty state */}
          {filtered.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-400 font-sans text-sm">
                {search ? 'No books match your search.' : 'No books yet. Add one or import from Goodreads.'}
              </p>
            </div>
          )}

          {/* Book list */}
          <div className="space-y-1">
            {filtered.map(book => (
              <div
                key={book.id}
                className="group bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3 hover:border-gray-200 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-sans text-sm font-medium text-gray-800 truncate">{book.title}</p>
                  <p className="font-sans text-xs text-gray-400 truncate">{book.author}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {book.rating > 0 && (
                    <StarRating rating={book.rating} />
                  )}
                  {book.date_read && (
                    <span className="text-xs text-gray-400 font-sans hidden sm:block">
                      {new Date(book.date_read).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </span>
                  )}
                  {deleteConfirm === book.id ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleDelete(book.id)}
                        className="text-xs text-red-600 hover:text-red-700 font-sans px-1"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="text-xs text-gray-400 hover:text-gray-500 font-sans px-1"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(book.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-100 transition-all"
                    >
                      <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
