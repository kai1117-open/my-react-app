// Supabase クライアント (シングルトン)
// 環境変数: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
// Vite は VITE_ プレフィックスのみフロントに公開する
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

// 環境変数未設定時でもアプリがクラッシュしないよう、ダミーで初期化する
// (実際のリクエストはログイン画面側で isSupabaseConfigured を見てガードする)
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      storageKey: 'couple-app:supabase-auth',
    },
  },
)
