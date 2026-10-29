import { createClient } from '@supabase/Supabase-js'
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHED_KEY
export const supabase = createClient(SupabaseUrl, supabaseKey)

