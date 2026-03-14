import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pqeprfqzeygsaxdlwjio.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxZXByZnF6ZXlnc2F4ZGx3amlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMDU0MjgsImV4cCI6MjA4ODU4MTQyOH0.LS6xl8veRymsd6l79BmhprjA5hs_qlW9m6ioBVcKVe4'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Check if tables are available
let _available = null
export async function isSupabaseReady() {
  if (_available !== null) return _available
  const { error } = await supabase.from('conversations').select('id').limit(1)
  _available = !error
  if (!_available) console.warn('Supabase tables not ready. Run supabase-schema.sql in your Supabase SQL Editor to enable chat persistence.')
  return _available
}
