import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://shwdahlvrjgcnzmlygaa.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNod2RhaGx2cmpnY256bWx5Z2FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1Mjk5NTMsImV4cCI6MjA5NzEwNTk1M30.Ce02yM5fwSvZH-GW5HX3l8Zap2O8QlVg2Gow8jJyXYA'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession: true,
    storageKey: 'nautitrack-auth',
    storage: window.localStorage,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  }
})