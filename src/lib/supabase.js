import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pqeprfqzeygsaxdlwjio.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxZXByZnF6ZXlnc2F4ZGx3amlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMDU0MjgsImV4cCI6MjA4ODU4MTQyOH0.LS6xl8veRymsd6l79BmhprjA5hs_qlW9m6ioBVcKVe4'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Check if tables are available
let _available = null
export async function isSupabaseReady() {
  if (_available !== null) return _available
  try {
    const { error } = await supabase.from('conversations').select('id').limit(1)
    _available = !error
  } catch {
    _available = false
  }
  if (!_available) console.warn('Supabase tables not ready. Run supabase-schema.sql in your Supabase SQL Editor to enable chat persistence.')
  return _available
}

// Auth helpers
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  })
  if (error) {
    console.error('Google sign-in error:', error)
    // If Google auth isn't configured, show a helpful message
    if (error.message?.includes('provider') || error.message?.includes('not enabled')) {
      throw new Error('Google sign-in is not configured yet. Please set up Google OAuth in Supabase.')
    }
    throw error
  }
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) console.error('Sign-out error:', error)
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// User books helpers
export async function getUserBooks(userId) {
  const { data, error } = await supabase
    .from('user_books')
    .select('*')
    .eq('user_id', userId)
    .order('date_read', { ascending: false, nullsFirst: false })
  if (error) {
    console.error('Error fetching user books:', error)
    return []
  }
  return data || []
}

export async function importBooks(userId, books) {
  // Batch upsert — use title+author as the conflict key
  // We'll insert one at a time to handle conflicts gracefully
  let imported = 0
  let skipped = 0

  for (const book of books) {
    const { error } = await supabase
      .from('user_books')
      .upsert(
        {
          user_id: userId,
          title: book.title,
          author: book.author,
          isbn: book.isbn || null,
          rating: book.rating || null,
          date_read: book.date_read || null,
          shelves: book.shelves || null,
          review: book.review || null,
        },
        {
          onConflict: 'user_id,title,author',
          ignoreDuplicates: true,
        }
      )

    if (error) {
      // Likely a duplicate — that's fine
      skipped++
    } else {
      imported++
    }
  }

  return { imported, skipped, total: books.length }
}

export async function deleteUserBooks(userId) {
  const { error } = await supabase
    .from('user_books')
    .delete()
    .eq('user_id', userId)
  return !error
}

export async function addUserBook(userId, book) {
  const { data, error } = await supabase
    .from('user_books')
    .insert({
      user_id: userId,
      title: book.title,
      author: book.author,
      rating: book.rating || null,
      date_read: book.date_read || null,
      isbn: book.isbn || null,
      shelves: book.shelves || null,
      review: book.review || null,
    })
    .select()
    .single()
  if (error) {
    console.error('Error adding book:', error)
    throw error
  }
  return data
}

export async function deleteUserBook(bookId) {
  const { error } = await supabase
    .from('user_books')
    .delete()
    .eq('id', bookId)
  if (error) {
    console.error('Error deleting book:', error)
    throw error
  }
  return true
}
