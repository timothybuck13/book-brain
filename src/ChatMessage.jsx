import { useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }
  }, [text])

  return (
    <div className="relative inline-block">
      <button
        onClick={handleCopy}
        className={`copy-btn${copied ? ' copied' : ''}`}
        aria-label={copied ? 'Copied to clipboard' : 'Copy message'}
        title={copied ? 'Copied!' : 'Copy'}
      >
        {copied ? (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
          </svg>
        )}
      </button>
      {copied && (
        <span
          className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 text-[10px] font-sans font-medium bg-gray-900 text-white rounded-md whitespace-nowrap pointer-events-none z-10 shadow-lg animate-fade-in-up"
          role="status"
          aria-live="polite"
        >
          Copied!
        </span>
      )}
    </div>
  )
}

function CodeBlock({ inline, className, children }) {
  const [copied, setCopied] = useState(false)
  const codeText = String(children).replace(/\n$/, '')

  const lang = (className || '').match(/language-([\w-]+)/)?.[1] || ''
  const langLabel = {
    js: 'javascript', javascript: 'javascript',
    ts: 'typescript', typescript: 'typescript',
    jsx: 'jsx', tsx: 'tsx',
    py: 'python', python: 'python',
    rb: 'ruby', ruby: 'ruby',
    go: 'go', rust: 'rust', rs: 'rust',
    php: 'php', java: 'java', c: 'c', cpp: 'c++', 'c++': 'c++',
    cs: 'c#', csharp: 'c#',
    sh: 'shell', bash: 'shell', zsh: 'shell', shell: 'shell',
    sql: 'sql', json: 'json', yaml: 'yaml', yml: 'yaml',
    html: 'html', css: 'css',
    md: 'markdown', markdown: 'markdown',
  }[lang.toLowerCase()] || lang

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(codeText)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = codeText
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }
  }, [codeText])

  if (inline) {
    return (
      <code className={className}>
        {children}
      </code>
    )
  }

  return (
    <div className="code-block-wrapper group/code">
      {langLabel && (
        <span className="code-lang-badge" aria-hidden="true">{langLabel}</span>
      )}
      <button
        onClick={handleCopy}
        className={`code-copy-btn ${copied ? 'copied' : ''}`}
        aria-label={copied ? 'Code copied' : 'Copy code'}
        title={copied ? 'Copied!' : 'Copy code'}
      >
        {copied ? (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
          </svg>
        )}
        <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy'}</span>
      </button>
      {copied && (
        <span
          className="absolute top-0 right-2 -translate-y-full px-2 py-0.5 text-[10px] font-sans font-medium bg-gray-900 text-white rounded-md whitespace-nowrap pointer-events-none z-10 shadow-lg animate-fade-in-up"
          role="status"
          aria-live="polite"
        >
          Copied!
        </span>
      )}
      <pre className={langLabel ? 'has-lang' : ''}>
        <code className={className}>{children}</code>
      </pre>
    </div>
  )
}

function ChatImage({ src, alt }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <img
      src={src}
      alt={alt || ''}
      loading="lazy"
      decoding="async"
      onLoad={() => setLoaded(true)}
      className={`chat-md-img${loaded ? ' loaded' : ''}`}
    />
  )
}

export default function ChatMessage({ message, isStreaming }) {
  const isUser = message.role === 'user'

  // Format timestamp for hover display
  const timeLabel = message.created_at
    ? new Date(message.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    : null

  if (isUser) {
    return (
      <div className="group/msg flex justify-end mb-4 animate-message-in">
        <div className="flex items-end gap-2">
          {timeLabel && (
            <span className="msg-timestamp opacity-0 group-hover/msg:opacity-100 transition-opacity duration-200 text-[11px] font-sans text-gray-400 whitespace-nowrap pb-1.5 select-none">
              {timeLabel}
            </span>
          )}
          <div className="max-w-[85%] bg-[#1a1a1a] text-white rounded-2xl rounded-br-md px-4 py-2.5 font-sans text-sm leading-relaxed chat-bubble-hover whitespace-pre-wrap break-words">
            {message.content}
          </div>
        </div>
      </div>
    )
  }

  const hasContent = !!message.content

  return (
    <div className="group/msg flex justify-start mb-4 animate-message-in">
      <div className="max-w-[30rem]">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Book Brain</span>
          {timeLabel && !isStreaming && (
            <span className="msg-timestamp opacity-0 group-hover/msg:opacity-100 transition-opacity duration-200 text-[11px] font-sans text-gray-400 whitespace-nowrap select-none">
              {timeLabel}
            </span>
          )}
          {hasContent && !isStreaming && (
            <span className="opacity-0 group-hover/msg:opacity-100 hover-action transition-opacity duration-150">
              <CopyButton text={message.content} />
            </span>
          )}
        </div>
        <div className="bg-white rounded-2xl rounded-tl-md px-4 py-3 font-sans text-sm leading-relaxed text-gray-800 shadow-sm border border-gray-100 chat-bubble-hover break-words">
          {hasContent ? (
            <div className="prose-chat">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer">
                      {children}
                    </a>
                  ),
                  table: ({ children }) => (
                    <div className="table-wrapper">
                      <table>{children}</table>
                    </div>
                  ),
                  code: CodeBlock,
                  img: ChatImage,
                }}
              >
                {message.content}
              </ReactMarkdown>
              {isStreaming && <span className="streaming-cursor" aria-hidden="true" />}
            </div>
          ) : isStreaming ? (
            <div className="flex items-end gap-1.5 py-1 h-6" aria-label="Book Brain is thinking…" role="status">
              <span className="typing-dot w-2 h-2 bg-amber-500 rounded-full" />
              <span className="typing-dot w-2 h-2 bg-amber-500 rounded-full" />
              <span className="typing-dot w-2 h-2 bg-amber-500 rounded-full" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
