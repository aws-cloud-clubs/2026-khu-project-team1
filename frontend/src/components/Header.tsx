import { supabase } from '../lib/supabase'

export default function Header() {
  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <header className="sticky top-0 z-10 bg-[var(--bg)]/80 backdrop-blur-md border-b border-[var(--border)]">
      <div className="max-w-3xl mx-auto flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center text-[var(--accent)]">
            <svg className="h-6 w-6" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M24 8 V26 A8 8 0 1 1 16 34" />
              <circle cx="24" cy="8" r="2.6" fill="currentColor" stroke="none" />
            </svg>
          </span>
          <span className="font-display text-base font-semibold text-[var(--text)] tracking-tight">
            Webhook<span className="text-[var(--accent)]">Inspector</span>
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs text-[var(--text-dim)] hover:text-[var(--text)] border border-[var(--border)] hover:border-[var(--text-faint)] rounded-md px-3 py-1.5 transition-colors"
        >
          logout
        </button>
      </div>
    </header>
  )
}
