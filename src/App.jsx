import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase, isSupabaseReady } from './lib/supabase'
import { streamChat } from './lib/gemini'
import Sidebar from './Sidebar'
import ChatMessage from './ChatMessage'

export default function App() {
  const [dbReady, setDbReady] = useState(false)
  const [conversations, setConversations] = useState([])
  const [activeConvoId, setActiveConvoId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)

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
  }, [])

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
        const { data: convo } = await supabase
          .from('conversations')
          .insert({ title })
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
        await supabase.from('messages').insert({
          conversation_id: convoId,
          role: 'user',
          content: text,
        })
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
        await supabase.from('messages').insert({
          conversation_id: convoId,
          role: 'model',
          content: fullResponse,
        })
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
  }, [input, isStreaming, messages, activeConvoId, dbReady])

  async function deleteConversation(convoId) {
    if (dbReady) {
      await supabase.from('messages').delete().eq('conversation_id', convoId)
      await supabase.from('conversations').delete().eq('id', convoId)
    }
    setConversations(prev => prev.filter(c => c.id !== convoId))
    if (activeConvoId === convoId) startNewChat()
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
        <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white flex-shrink-0">
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
    </div>
  )
}
