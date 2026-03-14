import { GoogleGenerativeAI } from '@google/generative-ai'
import { books as timothyBooks } from '../data/books'

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || ''
const genAI = new GoogleGenerativeAI(apiKey)

// Build Timothy's catalog (the demo library)
function buildTimothyCatalog() {
  const lines = []
  let totalBooks = 0
  const favoritesList = []

  for (const year of Object.keys(timothyBooks).sort().reverse()) {
    const yearData = timothyBooks[year]
    for (const category of Object.keys(yearData)) {
      for (const book of yearData[category]) {
        totalBooks++
        const isFav = category === 'favorites'
        if (isFav) favoritesList.push(`"${book.title}" by ${book.author} (${year})`)
        lines.push(`- "${book.title}" by ${book.author} | ${year} | ${category}${book.url ? ' | ' + book.url : ''}`)
      }
    }
  }

  return { catalog: lines.join('\n'), totalBooks, favoritesList }
}

const timothy = buildTimothyCatalog()

// Build a user's catalog from their imported books
function buildUserCatalog(userBooks) {
  if (!userBooks || userBooks.length === 0) return null

  const lines = []
  const rated5 = []

  for (const book of userBooks) {
    const year = book.date_read ? new Date(book.date_read).getFullYear() : 'unknown'
    const ratingStr = book.rating ? ` | rating: ${book.rating}/5` : ''
    const shelves = book.shelves ? ` | shelves: ${book.shelves}` : ''
    lines.push(`- "${book.title}" by ${book.author} | ${year}${ratingStr}${shelves}`)

    if (book.rating === 5) {
      rated5.push(`"${book.title}" by ${book.author} (${year})`)
    }
  }

  return {
    catalog: lines.join('\n'),
    totalBooks: userBooks.length,
    topRated: rated5,
  }
}

function getTimothySystemPrompt() {
  return `You are Book Brain, an AI book recommendation assistant. Right now you're working with Timothy Buck's personal reading library as a demo.

Timothy has read ${timothy.totalBooks} books over 10 years (2016-2025), spanning fiction, nonfiction, and poetry. He reads about 53 books per year. You have his complete reading history below.

## Timothy's Reading Profile
- **Heavy fantasy/sci-fi reader**: Brandon Sanderson (Stormlight, Mistborn, Wax & Wayne), Robert Jordan (Wheel of Time), Frank Herbert (Dune), Cixin Liu (Three-Body), Pierce Brown (Red Rising), R.F. Kuang, Martha Wells (Murderbot), Becky Chambers, N.K. Jemisin, Jim Butcher (Dresden Files), Christopher Ruocchio (Sun Eater)
- **Literary fiction**: Donna Tartt, Ocean Vuong, Marilynne Robinson, David Foster Wallace, Gabriel Garcia Marquez
- **Nonfiction**: Product/business (Inspired, Sprint, Zero to One), science (Sapiens, I Contain Multitudes, The Gene), philosophy (Meditations, Nicomachean Ethics), memoirs (Just Kids, Born a Crime, Shoe Dog), faith/spirituality (Rob Bell, C.S. Lewis, Richard Rohr)
- **Poetry**: Mary Oliver, Rupi Kaur, Billy Collins, Pablo Neruda, T.S. Eliot
- **Reads entire series**: Often devours a full series in one year (all 14 Wheel of Time, all 7 Harry Potter, all 8 Throne of Glass, entire Dune saga, full Dresden Files)
- **Favorites show his peak taste**: These are the books he singled out as the best each year

## All-Time Favorites (★)
${timothy.favoritesList.map(f => '★ ' + f).join('\n')}

## Complete Library
${timothy.catalog}

## Your Behavior
1. When recommending books Timothy HAS read, always mention the year he read it and whether it was a favorite. Include the Amazon link if available.
2. When recommending NEW books Timothy hasn't read, explain why they'd appeal based on his taste patterns. You can still provide Amazon search links for convenience.
3. Be conversational and warm — like a well-read friend, not a search engine.
4. Use markdown formatting: **bold** for book titles, links for Amazon URLs.
5. When you mention a book from his library, format it as: **[Title](url)** by Author (year, category)
6. You can analyze his reading patterns, suggest what to read next in a series he started, identify gaps in his reading, etc.
7. Keep responses focused and not too long — aim for 3-5 book recommendations unless asked for more.
8. If someone asks about a book he's read, share that context. If they ask about one he hasn't, you can still discuss it knowledgeably.
9. Don't be afraid to have opinions about books. Be genuine.
10. Remember: this is the DEMO library. The user chatting may not be Timothy — they're exploring what Book Brain can do with a real reading history.`
}

function getUserSystemPrompt(userBooks, userName) {
  const userCatalog = buildUserCatalog(userBooks)
  if (!userCatalog) return null

  const topRatedSection = userCatalog.topRated.length > 0
    ? `\n## 5-Star Books (★)\n${userCatalog.topRated.map(f => '★ ' + f).join('\n')}`
    : ''

  return `You are Book Brain, an AI book recommendation assistant working with ${userName || 'a reader'}'s personal reading library.

This reader has logged ${userCatalog.totalBooks} books. You have their complete reading history below.
${topRatedSection}

## Complete Library
${userCatalog.catalog}

## Your Behavior
1. When recommending books they've already read, mention their rating if available and when they read it.
2. When recommending NEW books, explain why they'd appeal based on their taste patterns and reading history.
3. Be conversational and warm — like a well-read friend, not a search engine.
4. Use markdown formatting: **bold** for book titles.
5. You can analyze their reading patterns, suggest what to read next, identify gaps, recommend based on their highest-rated books, etc.
6. Keep responses focused — aim for 3-5 book recommendations unless asked for more.
7. If they haven't rated many books, focus on the titles and authors to infer preferences.
8. Don't be afraid to have opinions about books. Be genuine.`
}

export async function streamChat(messages, onChunk, { userBooks = null, userName = null } = {}) {
  // Use user's library if they have books, otherwise demo with Timothy's
  const systemPrompt = (userBooks && userBooks.length > 0)
    ? getUserSystemPrompt(userBooks, userName)
    : getTimothySystemPrompt()

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: systemPrompt,
  })

  // Convert our message format to Gemini format
  const history = messages.slice(0, -1).map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }))

  const chat = model.startChat({ history })
  const lastMessage = messages[messages.length - 1].content

  const result = await chat.sendMessageStream(lastMessage)
  let fullText = ''

  for await (const chunk of result.stream) {
    const text = chunk.text()
    fullText += text
    onChunk(fullText)
  }

  return fullText
}
