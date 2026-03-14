import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function ChatMessage({ message, isStreaming }) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[85%] bg-amber-600 text-white rounded-2xl rounded-br-md px-4 py-2.5 font-serif text-sm leading-relaxed">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[85%]">
        <div className="flex items-center gap-2 mb-1">
          
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Book Brain</span>
        </div>
        <div className="bg-white rounded-2xl rounded-tl-md px-4 py-3 font-serif text-sm leading-relaxed text-gray-800 shadow-sm border border-gray-100">
          {message.content ? (
            <div className="prose-chat">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer">
                      {children}
                    </a>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          ) : isStreaming ? (
            <div className="flex gap-1 py-1">
              <span className="typing-dot w-1.5 h-1.5 bg-gray-400 rounded-full" />
              <span className="typing-dot w-1.5 h-1.5 bg-gray-400 rounded-full" />
              <span className="typing-dot w-1.5 h-1.5 bg-gray-400 rounded-full" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
