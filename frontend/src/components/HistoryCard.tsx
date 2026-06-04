import type { WebhookListItem } from '../api/webhookApi'

interface HistoryCardProps {
  item: WebhookListItem
  onSelect: (id: string) => void
  /** 실시간 push로 막 도착한 항목이면 도착 애니메이션 표시 */
  isNew?: boolean
}

// 다크 네온 메서드 뱃지
const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-[#0e2233] text-[var(--cyan)] ring-1 ring-[var(--cyan)]/30',
  POST: 'bg-[var(--accent-dim)] text-[var(--accent)] ring-1 ring-[var(--accent)]/30',
  PUT: 'bg-[#2a2310] text-[var(--amber)] ring-1 ring-[var(--amber)]/30',
  PATCH: 'bg-[#2a1c10] text-[#fb923c] ring-1 ring-[#fb923c]/30',
  DELETE: 'bg-[#2a1218] text-[var(--rose)] ring-1 ring-[var(--rose)]/30',
}

function formatAbsolute(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

// 상대 시각: 방금 전 · N분 전 · N시간 전, 그 이상은 절대 시각
function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 10) return '방금 전'
  if (sec < 60) return `${sec}초 전`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  return formatAbsolute(iso)
}

export default function HistoryCard({ item, onSelect, isNew }: HistoryCardProps) {
  const methodColor = METHOD_COLORS[item.method] ?? 'bg-[var(--panel-2)] text-[var(--text-dim)] ring-1 ring-[var(--border)]'

  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      className={`group w-full text-left bg-[var(--panel)] border border-[var(--border)] rounded-xl px-4 py-3 hover:border-[var(--accent)]/50 hover:bg-[var(--panel-2)] active:scale-[0.99] transition-all ${
        isNew ? 'item-new' : ''
      }`}
    >
      <div className="flex items-center gap-3 mb-1.5">
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded tracking-wide ${methodColor}`}>
          {item.method}
        </span>
        <span className="text-sm text-[var(--text)] font-mono truncate">
          {item.path || '/'}
        </span>
        <span
          className="ml-auto text-xs text-[var(--text-faint)] shrink-0 tabular-nums"
          title={formatAbsolute(item.received_at)}
        >
          {formatRelative(item.received_at)}
        </span>
      </div>
      <div className="flex items-center gap-2 pl-0.5">
        {item.content_type && (
          <span className="text-[11px] text-[var(--text-faint)] truncate">{item.content_type}</span>
        )}
        {item.body_preview && (
          <span className="text-[11px] text-[var(--text-dim)] font-mono truncate opacity-80">{item.body_preview}</span>
        )}
      </div>
    </button>
  )
}
