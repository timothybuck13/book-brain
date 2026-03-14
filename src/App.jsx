import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase, isSupabaseReady, signInWithGoogle, signOut, getUserBooks } from './lib/supabase'
import { streamChat } from './lib/gemini'
import Sidebar from './Sidebar'
import ChatMessage from './ChatMessage'
import ImportModal from './ImportModal'

export default function App() {
  const [dbReady, setDbReady] = useState(false)
  const [user, setUser] = useState(null)
  const [conversations, setConversations] = useState([])
  const [activeConvoId, setActiveConvoId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [userBookCount, setUserBookCount] = useState(0)
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)
  const menuRef = useRef(null)

  // Auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Load user's book count when signed in
  useEffect(() => {
    if (user) {
      getUserBooks(user.id).then(books => setUserBookCount(books.length))
    } else {
      setUserBookCount(0)
    }
  }, [user])

  // Check Supabase and load conversations
  useEffect(() => {
    ;(async () => {
      const ready = await isSupabaseReady()
      setDbReady(ready)
      if (ready) {
        const { data } = await supabase
          .from('conversations')
          .select('*')
          .order('created_at', { ascending: false })
        if (data) setConversations(data)
      }
    })()
  }, [user])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px'
    }
  }, [input])

  // Close user menu on outside click
  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function selectConversation(convoId) {
    setActiveConvoId(convoId)
    setSidebarOpen(false)
    if (dbReady) {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convoId)
        .order('created_at', { ascending: true })
      if (data) setMessages(data.map(m => ({ role: m.role, content: m.content, id: m.id })))
    }
  }

  function startNewChat() {
    setActiveConvoId(null)
    setMessages([])
    setInput('')
    setSidebarOpen(false)
    setTimeout(() => textareaRef.current?.focus(), 100)
  }

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault()
    const text = input.trim()
    if (!text || isStreaming) return

    setInput('')
    setIsStreaming(true)

    const userMsg = { role: 'user', content: text, id: 'temp-user-' + Date.now() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)

    let convoId = activeConvoId

    try {
      // Create conversation if needed
      if (!convoId && dbReady) {
        const title = text.length > 60 ? text.slice(0, 57) + '...' : text
        const insertData = { title }
        if (user) insertData.user_id = user.id
        const { data: convo } = await supabase
          .from('conversations')
          .insert(insertData)
          .select()
          .single()
        if (convo) {
          convoId = convo.id
          setActiveConvoId(convoId)
          setConversations(prev => [convo, ...prev])
        }
      }

      // Save user message
      if (convoId && dbReady) {
        const msgData = {
          conversation_id: convoId,
          role: 'user',
          content: text,
        }
        if (user) msgData.user_id = user.id
        await supabase.from('messages').insert(msgData)
      }

      // Add placeholder for AI response
      const aiMsgId = 'temp-ai-' + Date.now()
      setMessages(prev => [...prev, { role: 'model', content: '', id: aiMsgId }])

      // Stream from Gemini
      const geminiMessages = newMessages.map(m => ({
        role: m.role,
        content: m.content,
      }))

      const fullResponse = await streamChat(geminiMessages, (partial) => {
        setMessages(prev =>
          prev.map(m => m.id === aiMsgId ? { ...m, content: partial } : m)
        )
      })

      // Save AI response
      if (convoId && dbReady) {
        const aiData = {
          conversation_id: convoId,
          role: 'model',
          content: fullResponse,
        }
        if (user) aiData.user_id = user.id
        await supabase.from('messages').insert(aiData)
      }
    } catch (err) {
      console.error('Chat error:', err)
      const errorId = 'error-' + Date.now()
      setMessages(prev => {
        const withoutEmpty = prev.filter(m => !(m.role === 'model' && !m.content))
        return [...withoutEmpty, { role: 'model', content: 'Sorry, something went wrong. Please try again.', id: errorId }]
      })
    }

    setIsStreaming(false)
  }, [input, isStreaming, messages, activeConvoId, dbReady, user])

  async function deleteConversation(convoId) {
    if (dbReady) {
      await supabase.from('messages').delete().eq('conversation_id', convoId)
      await supabase.from('conversations').delete().eq('id', convoId)
    }
    setConversations(prev => prev.filter(c => c.id !== convoId))
    if (activeConvoId === convoId) startNewChat()
  }

  async function handleSignIn() {
    try {
      await signInWithGoogle()
    } catch (err) {
      console.error('Sign-in failed:', err)
    }
  }

  async function handleSignOut() {
    setShowUserMenu(false)
    await signOut()
    setUser(null)
    setConversations([])
    setMessages([])
    setActiveConvoId(null)
    // Reload anonymous conversations
    if (dbReady) {
      const { data } = await supabase
        .from('conversations')
        .select('*')
        .order('created_at', { ascending: false })
      if (data) setConversations(data)
    }
  }

  const hasMessages = messages.length > 0

  return (
    <div className="h-dvh flex bg-[#f2f2f2]">
      <Sidebar
        conversations={conversations}
        activeConvoId={activeConvoId}
        onSelect={selectConversation}
        onNew={startNewChat}
        onDelete={deleteConversation}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-1.5 -ml-1 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <img src="/logo.jpg" alt="Book Brain" className="w-7 h-7 rounded-md" />
              <h1 className="font-display text-lg tracking-wide">Book Brain</h1>
            </div>
          </div>

          {/* Auth section */}
          <div className="flex items-center gap-2">
            {user ? (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  {user.user_metadata?.avatar_url ? (
                    <img
                      src={user.user_metadata.avatar_url}
                      alt=""
                      className="w-7 h-7 rounded-full"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-xs font-bold">
                      {(user.user_metadata?.full_name || user.email || '?')[0].toUpperCase()}
                    </div>
                  )}
                  <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50">
                    <div className="px-3 py-2 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {user.user_metadata?.full_name || 'User'}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{user.email}</p>
                    </div>
                    <button
                      onClick={() => { setShowUserMenu(false); setShowImport(true) }}
                      className="w-full text-left px-3 py-2 text-sm font-serif text-gray-600 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <span>📂</span>
                      Import Goodreads
                      {userBookCount > 0 && (
                        <span className="ml-auto text-xs text-gray-400">{userBookCount} books</span>
                      )}
                    </button>
                    <button
                      onClick={handleSignOut}
                      className="w-full text-left px-3 py-2 text-sm font-serif text-gray-600 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <span>👋</span>
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={handleSignIn}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-sm font-serif text-gray-600"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign In
              </button>
            )}
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {!hasMessages ? (
            <div className="max-w-2xl mx-auto px-4 pt-12 md:pt-20">
              <div className="text-center mb-10">
                <img src="/logo.jpg" alt="Book Brain" className="w-16 h-16 rounded-xl mb-4 mx-auto" />
                <h2 className="font-display text-2xl md:text-3xl tracking-wide mb-3">Book Brain</h2>
                <p className="text-gray-500 font-serif text-sm md:text-base leading-relaxed max-w-md mx-auto">
                  AI-powered recommendations from 10 years of reading — 560 books and counting.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
                {[
                  "What should I read if I loved Dune?",
                  "What are the best fantasy series here?",
                  "Recommend something short and profound",
                  "What poetry would you suggest?",
                ].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => { setInput(prompt); setTimeout(() => textareaRef.current?.focus(), 50) }}
                    className="text-left px-4 py-3 bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all text-sm font-serif text-gray-600 leading-snug"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto px-4 py-6 space-y-1">
              {messages.map((msg, i) => (
                <ChatMessage
                  key={msg.id || i}
                  message={msg}
                  isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'model'}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="flex-shrink-0 border-t border-gray-200 bg-white px-4 py-3">
          <form onSubmit={handleSubmit} className="max-w-2xl mx-auto flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
              placeholder="Ask about books..."
              rows={1}
              className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-serif focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-colors bg-gray-50"
              disabled={isStreaming}
            />
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
              </svg>
            </button>
          </form>
          <p className="text-center text-xs text-gray-400 mt-2 font-serif">
            Powered by Gemini · Built by <a href="https://timothybuck.me" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-500">Timothy Buck</a>
          </p>
        </div>
      </div>

      {/* Import Modal */}
      {showImport && user && (
        <ImportModal
          userId={user.id}
          onClose={() => setShowImport(false)}
          onImportComplete={(res) => {
            setUserBookCount(prev => prev + (res.imported || 0))
          }}
        />
      )}
    </div>
  )
}
