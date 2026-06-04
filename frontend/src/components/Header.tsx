import { supabase } from '../lib/supabase'

export default function Header() {
  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <header className="sticky top-0 z-10 bg-[var(--bg)]/80 backdrop-blur-md border-b border-[var(--border)]">
      <div className="max-w-3xl mx-auto flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-dim)] text-[var(--accent)] ring-1 ring-[var(--accent)]/30">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13l1-8z" />
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
