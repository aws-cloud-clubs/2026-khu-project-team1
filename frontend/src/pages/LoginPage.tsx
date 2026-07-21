import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm rise">
        <div className="flex flex-col items-center mb-8">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent-dim)] text-[var(--accent)] ring-1 ring-[var(--accent)]/20 mb-4">
            <svg className="h-7 w-7" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M24 8 V26 A8 8 0 1 1 16 34" />
              <circle cx="24" cy="8" r="2.6" fill="currentColor" stroke="none" />
            </svg>
          </span>
          <h1 className="font-display text-2xl font-bold text-[var(--text)] tracking-tight">
            Webhook<span className="text-[var(--accent)]">Inspector</span>
          </h1>
          <p className="text-[var(--text-dim)] text-sm mt-1">웹훅을 실시간으로 수신하고 디버깅하세요</p>
        </div>

        <div className="bg-[var(--panel)] rounded-2xl p-8 border border-[var(--border)] shadow-lg shadow-slate-200/60">
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-dim)] uppercase tracking-wider mb-1.5">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--bg-soft)] text-[var(--text)] border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition placeholder:text-[var(--text-faint)]"
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-dim)] uppercase tracking-wider mb-1.5">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--bg-soft)] text-[var(--text)] border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition placeholder:text-[var(--text-faint)]"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <p className="text-[var(--rose)] text-sm bg-[var(--rose)]/10 border border-[var(--rose)]/30 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-[var(--accent)] hover:brightness-110 text-[var(--bg)] font-semibold transition disabled:opacity-50"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <div className="flex items-center my-6">
            <div className="flex-1 border-t border-[var(--border)]" />
            <span className="px-3 text-[var(--text-faint)] text-xs">또는</span>
            <div className="flex-1 border-t border-[var(--border)]" />
          </div>

          <button
            onClick={handleGoogleLogin}
            className="w-full py-2.5 rounded-lg border border-[var(--border)] text-[var(--text-dim)] hover:text-[var(--text)] hover:border-[var(--text-faint)] hover:bg-[var(--panel-2)] text-sm font-medium flex items-center justify-center gap-2 transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google로 로그인
          </button>
        </div>
      </div>
    </div>
  )
}
