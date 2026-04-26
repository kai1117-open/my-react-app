import { useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

// 二人で共有する共通アカウントでログインする画面。
// セッションは Supabase クライアントが localStorage に自動保存するため、
// 一度ログインすれば以降は自動でセッションが復元される (実質ログイン1回)。
export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!isSupabaseConfigured) {
    return (
      <div className="login-shell">
        <div className="login-card">
          <h1>セットアップ未完了</h1>
          <p className="login-error">
            環境変数 <code>VITE_SUPABASE_URL</code> と <code>VITE_SUPABASE_ANON_KEY</code> が未設定です。
            <br />
            Amplify Console で設定し、再デプロイしてください。
          </p>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setSubmitting(false)
    if (err) {
      setError(err.message || 'ログインに失敗しました')
    }
  }

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>couple-app</h1>
        <p className="login-sub">二人で共有しているアカウントでログイン</p>

        <label className="login-label">
          メールアドレス
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="login-label">
          パスワード
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && <div className="login-error">{error}</div>}

        <button type="submit" className="login-submit" disabled={submitting}>
          {submitting ? 'ログイン中…' : 'ログイン'}
        </button>
      </form>
    </div>
  )
}
