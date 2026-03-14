import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase, isSupabaseReady, signInWithGoogle, signOut, getUserBooks, importBooks } from './lib/supabase'
import { streamChat } from './lib/gemini'
import { parseGoodreadsCSV } from './lib/goodreads'
import Sidebar from './Sidebar'
import ChatMessage from './ChatMessage'
import ImportModal from './ImportModal'

export default function App() {
  // App state: 'loading' | 'landing' | 'demo' | 'onboarding' | 'chat'
  const [appState, setAppState] = useState('loading')
  const [dbReady, setDbReady] = useState(false)
  const [user, setUser] = useState(null)
  const [userBooks, setUserBooks] = useState([])
  const [conversations, setConversations] = useState([])
  const [activeConvoId, setActiveConvoId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)

  // Onboarding state
  const [onboardingStep, setOnboardingStep] = useState('upload') // 'upload' | 'importing' | 'done'
  const [importResult, setImportResult] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [importError, setImportError] = useState(null)

  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)
  const menuRef = useRef(null)
  const fileRef = useRef(null)

  // ── Auth + initial routing ──────────────────────────────────
  useEffect(() => {
    let mounted = true

    async function init() {
      const ready = await isSupabaseReady()
      if (!mounted) return
      setDbReady(ready)

      const { data: { session } } = await supabase.auth.getSession()
      if (!mounted) return
      const currentUser = session?.user ?? null
      setUser(currentUser)

      if (currentUser && ready) {
        const books = await getUserBooks(currentUser.id)
        if (!mounted) return
        setUserBooks(books)
        if (books.length > 0) {
          // Load conversations
          const { data } = await supabase
            .from('conversations')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
          if (data) setConversations(data)
          setAppState('chat')
        } else {
          setAppState('onboarding')
        }
      } else {
        setAppState('landing')
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return
      const currentUser = session?.user ?? null
      setUser(currentUser)

      if (currentUser && dbReady) {
        const books = await getUserBooks(currentUser.id)
        if (!mounted) return
        setUserBooks(books)
        if (books.length > 0) {
          const { data } = await supabase
            .from('conversations')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
          if (data) setConversations(data)
          setAppState('chat')
        } else {
          setAppState('onboarding')
        }
      } else if (!currentUser) {
        setUserBooks([])
        setConversations([])
        setMessages([])
        setActiveConvoId(null)
        setAppState('landing')
      }
    })

    return () => { mounted = false; subscription.unsubscribe() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowUserMenu(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ── Conversation helpers ────────────────────────────────────
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

  async function deleteConversation(convoId) {
    if (dbReady) {
      await supabase.from('messages').delete().eq('conversation_id', convoId)
      await supabase.from('conversations').delete().eq('id', convoId)
    }
    setConversations(prev => prev.filter(c => c.id !== convoId))
    if (activeConvoId === convoId) startNewChat()
  }

  // ── Chat submit ─────────────────────────────────────────────
  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault()
    const text = input.trim()
    if (!text || isStreaming) return

    setInput('')
    setIsStreaming(true)

    const userMsg = { role: 'user', content: text, id: 'temp-user-' + Date.now() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)

    const isDemo = appState === 'demo'
    let convoId = activeConvoId

    try {
      // Create conversation if needed (logged-in only)
      if (!isDemo && !convoId && dbReady && user) {
        const title = text.length > 60 ? text.slice(0, 57) + '...' : text
        const { data: convo } = await supabase
          .from('conversations')
          .insert({ title, user_id: user.id })
          .select()
          .single()
        if (convo) {
          convoId = convo.id
          setActiveConvoId(convoId)
          setConversations(prev => [convo, ...prev])
        }
      }

      // Save user message (logged-in only)
      if (!isDemo && convoId && dbReady) {
        await supabase.from('messages').insert({
          conversation_id: convoId,
          role: 'user',
          content: text,
          user_id: user?.id || null,
        })
      }

      // Placeholder for AI response
      const aiMsgId = 'temp-ai-' + Date.now()
      setMessages(prev => [...prev, { role: 'model', content: '', id: aiMsgId }])

      // Stream from Gemini
      const geminiMessages = newMessages.map(m => ({ role: m.role, content: m.content }))
      const streamOpts = (!isDemo && userBooks.length > 0)
        ? { userBooks, userName: user?.user_metadata?.full_name }
        : {}

      const fullResponse = await streamChat(geminiMessages, (partial) => {
        setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, content: partial } : m))
      }, streamOpts)

      // Save AI response (logged-in only)
      if (!isDemo && convoId && dbReady) {
        await supabase.from('messages').insert({
          conversation_id: convoId,
          role: 'model',
          content: fullResponse,
          user_id: user?.id || null,
        })
      }
    } catch (err) {
      console.error('Chat error:', err)
      setMessages(prev => {
        const withoutEmpty = prev.filter(m => !(m.role === 'model' && !m.content))
        return [...withoutEmpty, { role: 'model', content: 'Sorry, something went wrong. Please try again.', id: 'error-' + Date.now() }]
      })
    }

    setIsStreaming(false)
  }, [input, isStreaming, messages, activeConvoId, dbReady, user, appState, userBooks])

  // ── Auth actions ────────────────────────────────────────────
  async function handleSignIn() {
    try { await signInWithGoogle() } catch (err) { console.error('Sign-in failed:', err) }
  }

  async function handleSignOut() {
    setShowUserMenu(false)
    await signOut()
  }

  // ── Onboarding import ───────────────────────────────────────
  async function handleOnboardingFile(file) {
    if (!file || !file.name.endsWith('.csv')) {
      setImportError('Please upload a CSV file from Goodreads.')
      return
    }
    setImportError(null)
    setOnboardingStep('importing')

    try {
      const text = await file.text()
      const books = parseGoodreadsCSV(text)
      if (books.length === 0) {
        setImportError('No read books found. Make sure you exported from Goodreads and have books on your "read" shelf.')
        setOnboardingStep('upload')
        return
      }
      const res = await importBooks(user.id, books)
      setImportResult(res)
      const updatedBooks = await getUserBooks(user.id)
      setUserBooks(updatedBooks)
      setOnboardingStep('done')
    } catch (err) {
      console.error('Import error:', err)
      setImportError('Failed to import. Please try again.')
      setOnboardingStep('upload')
    }
  }

  function handleOnboardingDrop(e) {
    e.preventDefault()
    setDragging(false)
    handleOnboardingFile(e.dataTransfer?.files?.[0])
  }

  function transitionToChat(prompt) {
    setAppState('chat')
    if (prompt) {
      setInput(prompt)
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }

  // ── Header ──────────────────────────────────────────────────
  function renderHeader() {
    const showBack = appState === 'demo'
    const showSignUp = appState === 'demo'
    const showHamburger = appState === 'chat'
    const showAvatar = !!user && (appState === 'chat' || appState === 'onboarding')

    return (
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          {showBack && (
            <button
              onClick={() => { setAppState('landing'); setMessages([]) }}
              className="p-1.5 -ml-1 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 text-sm font-sans flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              Back
            </button>
          )}
          {showHamburger && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-1.5 -ml-1 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
          )}
          <div className="flex items-center gap-2">
            <img src="/logo.jpg" alt="Book Brain" className="w-7 h-7 rounded-md" />
            <h1 className="font-sans font-semibold text-lg tracking-wide">Book Brain</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {showSignUp && (
            <button
              onClick={handleSignIn}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-sm font-sans hover:bg-amber-700 transition-colors"
            >
              Sign Up Free
            </button>
          )}
          {showAvatar && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {user.user_metadata?.avatar_url ? (
                  <img src={user.user_metadata.avatar_url} alt="" className="w-7 h-7 rounded-full" referrerPolicy="no-referrer" />
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
                    <p className="text-sm font-medium text-gray-800 truncate">{user.user_metadata?.full_name || 'User'}</p>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  </div>
                  <button
                    onClick={() => { setShowUserMenu(false); setShowImportModal(true) }}
                    className="w-full text-left px-3 py-2 text-sm font-sans text-gray-600 hover:bg-gray-50 flex items-center gap-2"
                  >
                    
                    Import Goodreads
                    {userBooks.length > 0 && <span className="ml-auto text-xs text-gray-400">{userBooks.length} books</span>}
                  </button>
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-3 py-2 text-sm font-sans text-gray-600 hover:bg-gray-50 flex items-center gap-2"
                  >
                     Sign Out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>
    )
  }

  // ── Chat input bar ──────────────────────────────────────────
  function renderInput() {
    const hasText = input.trim().length > 0
    return (
      <div className="flex-shrink-0 bg-[#f2f2f2] px-4 pb-4 pt-2">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto relative bg-white rounded-full shadow-sm border border-gray-200">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
            placeholder="Ask about books..."
            rows={1}
            className="w-full resize-none bg-transparent rounded-full pl-5 pr-14 py-3.5 text-base font-sans focus:outline-none overflow-hidden"
            disabled={isStreaming}
          />
          <button
            type="submit"
            disabled={!hasText || isStreaming}
            className={`absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full transition-all ${
              hasText && !isStreaming
                ? 'bg-amber-600 text-white hover:bg-amber-700 scale-100'
                : 'bg-gray-100 text-gray-300 scale-90'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
            </svg>
          </button>
        </form>
        <p className="text-center text-xs text-gray-400 mt-2 font-sans">
          Powered by Gemini · Built by <a href="https://timothybuck.me" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-500">Timothy Buck</a>
        </p>
      </div>
    )
  }

  // ── Loading ─────────────────────────────────────────────────
  if (appState === 'loading') {
    return (
      <div className="h-dvh flex items-center justify-center bg-[#f2f2f2]">
        <div className="text-center">
          <img src="/logo.jpg" alt="Book Brain" className="w-14 h-14 rounded-xl mx-auto mb-3 animate-pulse" />
          <p className="font-sans text-sm text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  // ── Landing page ────────────────────────────────────────────
  if (appState === 'landing') {
    return (
      <div className="h-dvh flex flex-col bg-[#f2f2f2]">
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            <img src="/logo.jpg" alt="Book Brain" className="w-20 h-20 rounded-2xl mx-auto mb-6" />
            <h1 className="font-sans font-semibold text-3xl md:text-4xl tracking-wide mb-4">Book Brain</h1>
            <p className="font-sans text-gray-500 text-base md:text-lg leading-relaxed mb-8">
              Your AI-powered reading companion. Import your Goodreads library and get personalized book recommendations powered by your actual reading history.
            </p>

            {/* Primary CTA */}
            <button
              onClick={handleSignIn}
              className="w-full flex items-center justify-center gap-3 px-6 py-3 rounded-xl bg-amber-600 text-white font-sans text-base hover:bg-amber-700 transition-colors mb-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Get Started with Google
            </button>

            {/* Secondary CTA */}
            <button
              onClick={() => setAppState('demo')}
              className="w-full px-6 py-3 rounded-xl border border-gray-300 text-gray-600 font-sans text-base hover:bg-white hover:border-gray-400 transition-colors mb-6"
            >
              Try it with Timothy's 560-book library →
            </button>

            {/* Tertiary CTA */}
            <button
              onClick={handleSignIn}
              className="text-sm font-sans text-gray-400 hover:text-amber-600 transition-colors underline underline-offset-2"
            >
              Already have an account? Log in
            </button>
          </div>
        </div>
        <p className="text-center text-xs text-gray-400 pb-4 font-sans">
          Built by <a href="https://timothybuck.me" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-500">Timothy Buck</a>
        </p>
      </div>
    )
  }

  // ── Onboarding (logged in, no books yet) ────────────────────
  if (appState === 'onboarding') {
    return (
      <div className="h-dvh flex flex-col bg-[#f2f2f2]">
        {renderHeader()}
        <div className="flex-1 flex items-center justify-center px-4 overflow-y-auto">
          <div className="max-w-lg w-full py-8">
            {onboardingStep === 'upload' && (
              <div className="text-center">
                
                <h2 className="font-sans font-semibold text-2xl md:text-3xl tracking-wide mb-2">Let's set up your library</h2>
                <p className="font-sans text-gray-500 text-sm md:text-base leading-relaxed mb-6 max-w-md mx-auto">
                  Import your Goodreads reading history so Book Brain can give you personalized recommendations.
                </p>

                <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4 text-left">
                  <h3 className="font-sans font-bold text-gray-800 text-sm mb-3">How to export from Goodreads:</h3>
                  <ol className="font-sans text-sm text-gray-600 space-y-2 list-decimal list-inside mb-5">
                    <li>
                      Go to{' '}
                      <a href="https://www.goodreads.com/review/import" target="_blank" rel="noopener noreferrer" className="text-amber-600 underline hover:text-amber-700">
                        goodreads.com/review/import
                      </a>
                    </li>
                    <li>Click <strong>"Export Library"</strong> at the top</li>
                    <li>Wait for the file to generate, then download it</li>
                    <li>Upload the CSV file below</li>
                  </ol>

                  <div
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                      dragging ? 'border-amber-400 bg-amber-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleOnboardingDrop}
                    onClick={() => fileRef.current?.click()}
                  >
                    <input ref={fileRef} type="file" accept=".csv" onChange={(e) => handleOnboardingFile(e.target.files?.[0])} className="hidden" />
                    
                    <p className="font-sans text-sm text-gray-500">
                      Drop your Goodreads CSV here or <span className="text-amber-600 underline">browse</span>
                    </p>
                  </div>

                  {importError && (
                    <p className="mt-3 text-sm text-red-600 font-sans">{importError}</p>
                  )}
                </div>
              </div>
            )}

            {onboardingStep === 'importing' && (
              <div className="text-center">
                
                <h2 className="font-sans font-semibold text-2xl tracking-wide mb-2">Importing your books...</h2>
                <p className="font-sans text-gray-500 text-sm">This might take a moment.</p>
              </div>
            )}

            {onboardingStep === 'done' && (
              <div className="text-center">
                
                <h2 className="font-sans font-semibold text-2xl md:text-3xl tracking-wide mb-2">
                  {importResult?.imported || 0} books imported!
                </h2>
                {importResult?.skipped > 0 && (
                  <p className="font-sans text-sm text-gray-400 mb-2">{importResult.skipped} duplicates skipped</p>
                )}
                <p className="font-sans text-gray-500 text-sm md:text-base leading-relaxed mb-8 max-w-md mx-auto">
                  Your library is ready. Book Brain now knows your reading history and can give you personalized recommendations. Try asking:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
                  {[
                    "What should I read next?",
                    "What are my reading patterns?",
                    "Suggest something outside my comfort zone",
                    "What's my most-read genre?",
                    "Find me a short, powerful book",
                    "What are my blind spots as a reader?",
                  ].map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => transitionToChat(prompt)}
                      className="text-left px-4 py-3 bg-white rounded-xl border border-gray-200 hover:border-amber-400 hover:shadow-sm transition-all text-sm font-sans text-gray-600 leading-snug"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Demo mode ───────────────────────────────────────────────
  if (appState === 'demo') {
    const hasMessages = messages.length > 0

    return (
      <div className="h-dvh flex flex-col bg-[#f2f2f2]">
        {renderHeader()}

        <div className="flex-1 overflow-y-auto">
          {!hasMessages ? (
            <div className="max-w-2xl mx-auto px-4 pt-12 md:pt-20">
              <div className="text-center mb-10">
                <img src="/logo.jpg" alt="Book Brain" className="w-16 h-16 rounded-xl mb-4 mx-auto" />
                <h2 className="font-sans font-semibold text-2xl md:text-3xl tracking-wide mb-3">Timothy's Library</h2>
                <p className="text-gray-500 font-sans text-sm md:text-base leading-relaxed max-w-md mx-auto">
                  Explore 560 books from 10 years of reading. Ask for recommendations, discover patterns, or find your next read.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
                {[
                  "I have similar taste to Timothy — what should I read next?",
                  "What are the best fantasy series here?",
                  "Recommend something short and profound",
                  "What poetry would you suggest?",
                ].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => { setInput(prompt); setTimeout(() => textareaRef.current?.focus(), 50) }}
                    className="text-left px-4 py-3 bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all text-sm font-sans text-gray-600 leading-snug"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto px-4 py-6 space-y-1">
              {messages.map((msg, i) => (
                <ChatMessage key={msg.id || i} message={msg} isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'model'} />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {renderInput()}
      </div>
    )
  }

  // ── Logged-in chat ──────────────────────────────────────────
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
        {renderHeader()}

        <div className="flex-1 overflow-y-auto">
          {!hasMessages ? (
            <div className="max-w-2xl mx-auto px-4 pt-12 md:pt-20">
              <div className="text-center mb-10">
                <img src="/logo.jpg" alt="Book Brain" className="w-16 h-16 rounded-xl mb-4 mx-auto" />
                <h2 className="font-sans font-semibold text-2xl md:text-3xl tracking-wide mb-3">
                  {userBooks.length > 0
                    ? `Your ${userBooks.length}-Book Library`
                    : 'Book Brain'}
                </h2>
                <p className="text-gray-500 font-sans text-sm md:text-base leading-relaxed max-w-md mx-auto">
                  {userBooks.length > 0
                    ? 'Ask me anything about your reading history, or get personalized recommendations.'
                    : 'AI-powered recommendations from 10 years of reading — 560 books and counting.'}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
                {(userBooks.length > 0 ? [
                  "What should I read next?",
                  "What are my reading patterns?",
                  "Suggest something outside my comfort zone",
                  "What's my most-read genre?",
                ] : [
                  "I have similar taste to Timothy — what should I read next?",
                  "What are the best fantasy series here?",
                  "Recommend something short and profound",
                  "What poetry would you suggest?",
                ]).map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => { setInput(prompt); setTimeout(() => textareaRef.current?.focus(), 50) }}
                    className="text-left px-4 py-3 bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all text-sm font-sans text-gray-600 leading-snug"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto px-4 py-6 space-y-1">
              {messages.map((msg, i) => (
                <ChatMessage key={msg.id || i} message={msg} isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'model'} />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {renderInput()}
      </div>

      {/* Re-import modal (from user menu) */}
      {showImportModal && user && (
        <ImportModal
          userId={user.id}
          onClose={() => setShowImportModal(false)}
          onImportComplete={(res) => {
            getUserBooks(user.id).then(books => setUserBooks(books))
          }}
        />
      )}
    </div>
  )
}
