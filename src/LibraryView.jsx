import { useState, useMemo, useRef, useEffect } from 'react'
import { addUserBook, deleteUserBook, deleteUserBooks } from './lib/supabase'

function AnimatedCount({ value, duration = 600 }) {
  const [display, setDisplay] = useState(0)
  const prevValue = useRef(0)

  useEffect(() => {
    const from = prevValue.current
    const to = value
    if (from === to) return
    const start = performance.now()
    let raf
    function tick(now) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(from + (to - from) * eased))
      if (progress < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        prevValue.current = to
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  return <>{display}</>
}

function HighlightText({ text, query }) {
  if (!query || !query.trim()) return <>{text}</>
  const q = query.trim()
  // Escape regex special chars
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(regex)
  if (parts.length === 1) return <>{text}</>
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark key={i} className="search-highlight">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

export default function LibraryView({ user, userBooks, setUserBooks, onClose, showToast }) {
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
  const [recentlyAdded, setRecentlyAdded] = useState(new Set())
  const [deletingIds, setDeletingIds] = useState(new Set())
  const [showScrollTop, setShowScrollTop] = useState(false)
  const searchRef = useRef(null)
  const scrollContainerRef = useRef(null)

  // Auto-focus search input when library opens for quick keyboard access
  useEffect(() => {
    searchRef.current?.focus()
  }, [])

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

  function handleScroll(e) {
    const el = e.target
    setShowScrollTop(el.scrollTop > 300)
  }

  function scrollToTop() {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

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
      showToast?.('Book added to library')
      // Highlight the new row briefly
      setRecentlyAdded(prev => new Set(prev).add(book.id))
      setTimeout(() => {
        // Scroll the new book into view
        const el = document.getElementById(`book-row-${book.id}`)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 50)
      setTimeout(() => {
        setRecentlyAdded(prev => {
          const next = new Set(prev)
          next.delete(book.id)
          return next
        })
      }, 2200)
    } catch (err) {
      console.error('Failed to add book:', err)
      showToast?.('Failed to add book', 'error')
    }
    setSaving(false)
  }

  async function handleDelete(bookId) {
    try {
      await deleteUserBook(bookId)
      setDeleteConfirm(null)
      // Animate out, then remove from state
      setDeletingIds(prev => new Set(prev).add(bookId))
      setTimeout(() => {
        setUserBooks(prev => prev.filter(b => b.id !== bookId))
        setDeletingIds(prev => {
          const next = new Set(prev)
          next.delete(bookId)
          return next
        })
        showToast?.('Book removed')
      }, 320)
    } catch (err) {
      console.error('Failed to delete book:', err)
      showToast?.('Failed to delete book', 'error')
    }
  }

  async function handleDeleteAll() {
    try {
      await deleteUserBooks(user.id)
      setUserBooks([])
      setDeleteAllConfirm(false)
      showToast?.('All books deleted')
    } catch (err) {
      console.error('Failed to delete all books:', err)
      showToast?.('Failed to delete books', 'error')
    }
  }

  function StarRating({ rating, interactive, onChange }) {
    const [hoverRating, setHoverRating] = useState(0)
    const displayRating = interactive && hoverRating > 0 ? hoverRating : (rating || 0)

    function getStarColor(star) {
      if (star <= displayRating) {
        // Hovered but not yet selected — lighter amber preview
        if (interactive && hoverRating > 0 && star > (rating || 0)) return 'text-amber-400 opacity-70'
        return 'text-amber-500'
      }
      return 'text-gray-200'
    }

    return (
      <div
        className="flex gap-0.5"
        onMouseLeave={() => interactive && setHoverRating(0)}
        role={interactive ? 'radiogroup' : 'img'}
        aria-label={interactive ? 'Rate this book' : `${rating || 0} out of 5 stars`}
      >
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            onClick={() => interactive && onChange?.(star === rating ? 0 : star)}
            onMouseEnter={() => interactive && setHoverRating(star)}
            className={`${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-all duration-150`}
            role={interactive ? 'radio' : undefined}
            aria-checked={interactive ? star === rating : undefined}
            aria-label={interactive ? `${star} star${star > 1 ? 's' : ''}` : undefined}
            tabIndex={interactive ? 0 : -1}
          >
            <svg
              className={`w-4 h-4 transition-colors duration-150 ${getStarColor(star)}`}
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
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white/80 backdrop-blur-sm supports-[backdrop-filter]:bg-white/80 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="font-sans font-semibold text-lg">My Library</h2>
          <span className="text-sm text-gray-400 font-sans"><AnimatedCount value={userBooks.length} /> books</span>
        </div>
        <div className="flex items-center">
          
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close library"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Search + Actions */}
      <div className="px-4 py-3 bg-white/80 backdrop-blur-sm supports-[backdrop-filter]:bg-white/80 border-b border-gray-100 flex-shrink-0">
        <div className="max-w-2xl mx-auto space-y-2">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by title or author..."
              className="w-full pl-9 pr-8 py-2 text-base md:text-sm font-sans bg-gray-50 border border-gray-200 rounded-lg focus:outline-none input-focus"
            />
            {search && (
              <button
                onClick={() => { setSearch(''); searchRef.current?.focus() }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-all search-clear-btn"
                aria-label="Clear search"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <div className="flex items-center">
            {search.trim() && filtered.length > 0 && (
              <span className="text-xs font-sans text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full mr-2 search-results-badge">
                {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
              </span>
            )}
            {deleteAllConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600 font-sans">Delete all?</span>
                <button
                  onClick={handleDeleteAll}
                  className="text-xs font-sans text-white bg-red-600 hover:bg-red-700 px-2 py-1 rounded-md transition-colors"
                >
                  Yes
                </button>
                <button
                  onClick={() => setDeleteAllConfirm(false)}
                  className="text-xs font-sans text-gray-500 hover:text-gray-700 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors"
                >
                  No
                </button>
              </div>
            ) : (
              userBooks.length > 0 && (
                <button
                  onClick={() => setDeleteAllConfirm(true)}
                  className="text-xs font-sans text-red-500 hover:text-red-600 transition-colors whitespace-nowrap"
                >
                  Delete All
                </button>
              )
            )}
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="text-base md:text-sm font-sans bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none input-focus"
              >
                <option value="date_read">Date Read</option>
                <option value="title">Title</option>
                <option value="author">Author</option>
                <option value="rating">Rating</option>
              </select>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 text-white text-sm font-sans rounded-lg hover:bg-amber-700 btn-press"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Book
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable book list */}
      <div className="flex-1 overflow-y-auto relative" ref={scrollContainerRef} onScroll={handleScroll}>
        <div className="max-w-2xl mx-auto px-4 py-3">
          {/* Add Book Form */}
          {showAddForm && (
            <form onSubmit={handleAdd} className="add-book-form bg-white rounded-xl border border-gray-200 p-4 mb-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <input
                  type="text"
                  value={addTitle}
                  onChange={e => setAddTitle(e.target.value)}
                  placeholder="Title"
                  required
                  className="text-base md:text-sm font-sans border border-gray-200 rounded-lg px-3 py-2 focus:outline-none input-focus"
                  autoFocus
                />
                <input
                  type="text"
                  value={addAuthor}
                  onChange={e => setAddAuthor(e.target.value)}
                  placeholder="Author"
                  required
                  className="text-base md:text-sm font-sans border border-gray-200 rounded-lg px-3 py-2 focus:outline-none input-focus"
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
                    className="text-base md:text-sm font-sans border border-gray-200 rounded-lg px-2 py-1 focus:outline-none input-focus"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving || !addTitle.trim() || !addAuthor.trim()}
                  className="px-4 py-1.5 bg-amber-600 text-white text-sm font-sans rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {saving && (
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
                      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                  )}
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
            <div className="text-center py-16 px-4 animate-fade-in">
              {search ? (
                <>
                  <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center empty-icon-float">
                    <svg className="w-7 h-7 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                  </div>
                  <p className="text-gray-500 font-sans text-sm font-medium mb-1">No matches found</p>
                  <p className="text-gray-400 font-sans text-xs">Try a different title or author name.</p>
                </>
              ) : (
                <>
                  <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center empty-icon-float">
                    <svg className="w-7 h-7 text-amber-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                    </svg>
                  </div>
                  <p className="text-gray-500 font-sans text-sm font-medium mb-1">Your library is empty</p>
                  <p className="text-gray-400 font-sans text-xs mb-4">Add books manually or import your Goodreads history to get started.</p>
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white text-sm font-sans rounded-lg hover:bg-amber-700 btn-press"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Your First Book
                  </button>
                </>
              )}
            </div>
          )}

          {/* Book list */}
          <div className="space-y-1">
            {filtered.map((book, i) => (
              <div
                key={book.id}
                id={`book-row-${book.id}`}
                className={`group bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3 card-hover book-row-enter${recentlyAdded.has(book.id) ? ' book-just-added' : ''}${deletingIds.has(book.id) ? ' book-row-exit' : ''}`}
                style={{ animationDelay: `${Math.min(i * 30, 600)}ms` }}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-sans text-sm font-medium text-gray-800 truncate"><HighlightText text={book.title} query={search} /></p>
                  <p className="font-sans text-xs text-gray-400 truncate"><HighlightText text={book.author} query={search} /></p>
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
                      className="opacity-0 group-hover:opacity-100 hover-action p-1 rounded hover:bg-gray-100 transition-all"
                      aria-label={`Delete ${book.title}`}
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
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className="absolute bottom-6 right-6 scroll-to-bottom flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-500 text-xs font-sans rounded-full shadow-lg border border-gray-200 hover:bg-gray-50 hover:text-gray-700"
            aria-label="Scroll to top"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
            </svg>
            Top
          </button>
        )}
      </div>
    </div>
  )
}
