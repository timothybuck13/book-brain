import { useState } from 'react'

export default function Sidebar({ conversations, activeConvoId, onSelect, onNew, onDelete, isOpen, onClose }) {
  const [confirmDelete, setConfirmDelete] = useState(null)

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 md:hidden" onClick={onClose} />
      )}

      <aside className={`
        fixed md:static inset-y-0 left-0 z-50
        w-72 bg-white border-r border-gray-200 flex flex-col
        transform transition-transform duration-200 ease-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}>
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="font-sans font-semibold text-sm text-gray-500 uppercase tracking-wider">History</h2>
        </div>

        {/* Conversations list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {conversations.length === 0 ? (
            <p className="text-center text-gray-400 text-xs font-sans py-8 px-4">
              No conversations yet. Start chatting!
            </p>
          ) : (
            conversations.map((convo) => (
              <div
                key={convo.id}
                className={`group flex items-center gap-1 rounded-lg transition-colors cursor-pointer ${
                  activeConvoId === convo.id
                    ? 'bg-amber-50 text-amber-800'
                    : 'hover:bg-gray-50 text-gray-600'
                }`}
              >
                <button
                  onClick={() => onSelect(convo.id)}
                  className="flex-1 text-left px-3 py-2.5 text-sm font-sans truncate min-w-0"
                >
                  {convo.title || 'Untitled'}
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
                    className="opacity-0 group-hover:opacity-100 p-1.5 mr-1 text-gray-300 hover:text-red-400 transition-all flex-shrink-0"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* New Chat button at bottom */}
        <div className="p-3 border-t border-gray-200">
          <button
            onClick={onNew}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-sans hover:bg-amber-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Chat
          </button>
        </div>
      </aside>
    </>
  )
}
