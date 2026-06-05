import { useEffect, useState } from 'react'

/** 일정 주기(기본 1초)마다 현재 시각(ms)을 갱신해 컴포넌트를 재렌더한다. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

/** 경과 시간을 "방금 전 / N초 전 / N분 전 / N시간 전" 한국어로 포맷. */
export function formatAgo(fromIso: string, now: number): string {
  const diff = Math.max(0, now - new Date(fromIso).getTime())
  const sec = Math.floor(diff / 1000)
  if (sec < 3) return '방금 전'
  if (sec < 60) return `${sec}초 전`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  return `${Math.floor(hr / 24)}일 전`
}
