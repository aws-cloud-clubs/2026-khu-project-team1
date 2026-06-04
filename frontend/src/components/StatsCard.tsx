import type { ReactNode } from 'react'

interface StatsCardProps {
  label: string
  value: ReactNode
  icon: ReactNode
  accent?: 'indigo' | 'green' | 'gray'
}

// 다크 네온 액센트 (아이콘 배경 + 글로우)
const ACCENT: Record<NonNullable<StatsCardProps['accent']>, string> = {
  indigo: 'bg-[#1a2740] text-[var(--cyan)] ring-1 ring-[var(--cyan)]/25',
  green: 'bg-[var(--accent-dim)] text-[var(--accent)] ring-1 ring-[var(--accent)]/30',
  gray: 'bg-[var(--panel-2)] text-[var(--text-faint)] ring-1 ring-[var(--border)]',
}

export default function StatsCard({ label, value, icon, accent = 'indigo' }: StatsCardProps) {
  return (
    <div className="group flex items-center gap-3 bg-[var(--panel)] border border-[var(--border)] rounded-xl px-4 py-3.5 transition-colors hover:border-[var(--text-faint)]">
      <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${ACCENT[accent]}`}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-[var(--text-faint)]">{label}</p>
        <p className="font-display text-2xl font-semibold text-[var(--text)] truncate leading-tight">{value}</p>
      </div>
    </div>
  )
}
