import { useState, useEffect, useRef } from 'react'

function relativeTime(dateStr) {
  if (!dateStr) return ''
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffSec = Math.round((now - then) / 1000)
  if (diffSec < 60) return 'Just now'
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.round(diffHr / 24)
  if (diffDay === 1) return 'Yesterday'
  if (diffDay < 7) return `${diffDay}d ago`
  const diffWeek = Math.round(diffDay / 7)
  if (diffWeek < 5) return `${diffWeek}w ago`
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getTimeGroup(dateStr) {
  if (!dateStr) return 'Earlier'
  const now = new Date()
  const then = new Date(dateStr)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterdayStart = new Date(todayStart)
  yesterdayStart.setDate(yesterdayStart.getDate() - 1)
  const weekStart = new Date(todayStart)
  weekStart.setDate(weekStart.getDate() - 6)

  if (then >= todayStart) return 'Today'
  if (then >= yesterdayStart) return 'Yesterday'
  if (then >= weekStart) return 'This Week'
  return 'Earlier'
}

function groupConversations(conversations) {
  const groups = []
  const order = ['Today', 'Yesterday', 'This Week', 'Earlier']
  const grouped = {}
  for (const convo of conversations) {
    const group = getTimeGroup(convo.created_at)
    if (!grouped[group]) grouped[group] = []
    grouped[group].push(convo)
  }
  for (const label of order) {
    if (grouped[label]?.length > 0) {
      groups.push({ label, conversations: grouped[label] })
    }
  }
  return groups
}

export default function Sidebar({ conversations, activeConvoId, onSelect, onNew, onDelete, isOpen, onClose }) {
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [, setTick] = useState(0)
  const [scrolled, setScrolled] = useState(false)
  const scrollContainerRef = React.useRef(null)

  function handleScroll(e) {
    setScrolled(e.target.scrollTop > 12)
  }

  // Refresh relative timestamps every 60s
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000)
    return () => clearInterval(id)
  }, [])

  const groups = groupConversations(conversations)
  const flatConvos = groups.flatMap(g => g.conversations)

  // Keyboard navigation: ↑/↓ to move, Enter/Space to select, Esc to cancel
  function handleListKeyDown(e) {
    if (flatConvos.length === 0) return
    const currentIdx = flatConvos.findIndex(c => c.id === activeConvoId)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const next = flatConvos[Math.min(currentIdx + 1, flatConvos.length - 1)]
      if (next) { onSelect(next.id); setConfirmDelete(null); setTimeout(() => document.getElementById(`convo-${next.id}`)?.focus(), 0) }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const idx = currentIdx < 0 ? flatConvos.length : currentIdx
      const prev = flatConvos[Math.max(idx - 1, 0)]
      if (prev) { onSelect(prev.id); setConfirmDelete(null); setTimeout(() => document.getElementById(`convo-${prev.id}`)?.focus(), 0) }
    }
  }

  // Close sidebar on Escape key, or cancel delete confirmation first
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key !== 'Escape') return
      if (confirmDelete) {
        e.preventDefault()
        setConfirmDelete(null)
        return
      }
      if (isOpen) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, confirmDelete])

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 md:hidden" onClick={onClose} aria-hidden="true" />
      )}

      <aside
        role="navigation"
        aria-label="Conversation history"
        className={`
        fixed md:static inset-y-0 left-0 z-50
        w-72 bg-white border-r border-gray-200 flex flex-col
        transform transition-transform duration-200 ease-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}>
        {/* Header */}
        <div className={`px-4 py-3 border-b border-gray-200 bg-white relative z-10 header-elevation${scrolled ? ' scrolled' : ''}`}>
          <h2 className="font-sans font-semibold text-sm text-gray-500 uppercase tracking-wider">History</h2>
        </div>

        {/* Conversations list */}
        <div
          className="flex-1 overflow-y-auto overscroll-contain relative"
          role="listbox"
          aria-label="Conversations"
          tabIndex={flatConvos.length > 0 ? 0 : -1}
          onKeyDown={handleListKeyDown}
          onScroll={handleScroll}
          ref={scrollContainerRef}
        >
          {/* Top scroll shadow */}
          <div className={`chat-scroll-shadow-top ${scrolled ? 'visible' : ''}`} aria-hidden="true" style={{ background: 'linear-gradient(to bottom, white, transparent)' }} />
          <div className="p-2 space-y-0.5">
          {conversations.length === 0 ? (
            <div className="text-center py-10 px-4 animate-fade-in">
              <div className="mx-auto mb-3 w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center">
                <svg className="w-5.5 h-5.5 text-amber-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                </svg>
              </div>
              <p className="text-gray-500 font-sans text-xs font-medium mb-0.5">No conversations yet</p>
              <p className="text-gray-400 font-sans text-[11px] leading-relaxed">Start a chat to get<br />personalized recommendations.</p>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.label}>
                <div className="sidebar-group-header px-3 pt-3 pb-1 first:pt-1">
                  <span className="text-[10px] font-sans font-semibold text-gray-400 uppercase tracking-widest">{group.label}</span>
                </div>
                {group.conversations.map((convo) => (
              <div
                key={convo.id}
                className={`group flex items-center gap-1 rounded-lg cursor-pointer sidebar-row relative ${
                  activeConvoId === convo.id
                    ? 'bg-amber-50 text-amber-800 sidebar-active'
                    : 'hover:bg-gray-50 text-gray-600'
                }`}
              >
                <button
                  id={`convo-${convo.id}`}
                  onClick={() => onSelect(convo.id)}
                  className="flex-1 text-left px-3 py-2.5 min-w-0"
                  aria-current={activeConvoId === convo.id ? 'page' : undefined}
                  title={convo.title || 'Untitled'}
                  tabIndex={activeConvoId === convo.id ? 0 : -1}
                >
                  <span className="block text-sm font-sans truncate">{convo.title || 'Untitled'}</span>
                  {convo.created_at && (
                    <span className="block text-[11px] font-sans text-gray-400 mt-0.5">{relativeTime(convo.created_at)}</span>
                  )}
                </button>
                {confirmDelete === convo.id ? (
                  <div className="flex items-center gap-1 pr-2 flex-shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); onDelete(convo.id); setConfirmDelete(null) }}
                      className="text-xs text-red-600 hover:text-red-700 px-1.5 py-0.5 rounded bg-red-50 hover:bg-red-100"
                    >
                      Delete
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete(null) }}
                      className="text-xs text-gray-400 hover:text-gray-600 px-1"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(convo.id) }}
                    className="opacity-0 group-hover:opacity-100 hover-action p-1.5 mr-1 text-gray-300 hover:text-red-400 transition-all flex-shrink-0"
                    aria-label={`Delete conversation: ${convo.title || 'Untitled'}`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                )}
              </div>
                ))}
              </div>
            ))
          )}
        </div>
        </div>

        {/* New Chat button at bottom */}
        <div className="p-3 border-t border-gray-200">
          <button
            onClick={onNew}
            className="new-chat-btn w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-sans hover:bg-amber-700 btn-press"
            title="New Chat (⌘N)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Chat
            <kbd className="hidden md:inline-flex ml-auto items-center gap-0.5 text-[10px] font-sans text-amber-200/70 bg-amber-700/40 px-1.5 py-0.5 rounded">⌘N</kbd>
          </button>
        </div>
      </aside>
    </>
  )
}
