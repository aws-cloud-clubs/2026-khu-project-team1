/** 이력 로딩 중 표시되는 카드 모양 스켈레톤 (shimmer) */
export default function HistorySkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-[var(--panel)] border border-[var(--border)] rounded-xl px-4 py-3">
          <div className="flex items-center gap-3 mb-2">
            <div className="skeleton h-5 w-12 rounded" />
            <div className="skeleton h-4 w-40 rounded" />
            <div className="skeleton h-3 w-16 rounded ml-auto" />
          </div>
          <div className="skeleton h-3 w-2/3 rounded" />
        </div>
      ))}
    </div>
  )
}
