import { useEffect, useRef, useState } from 'react'

/**
 * 숫자가 바뀔 때 이전 값 → 새 값으로 부드럽게 굴러 올라가는 애니메이션 값.
 * requestAnimationFrame 기반, ease-out. 정수만 표시.
 */
export function useCountUp(target: number, durationMs = 600): number {
  const [display, setDisplay] = useState(target)
  const fromRef = useRef(target)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef(0)

  useEffect(() => {
    const from = fromRef.current
    if (from === target) return

    startRef.current = performance.now()
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    const tick = (now: number) => {
      const elapsed = now - startRef.current
      const t = Math.min(elapsed / durationMs, 1)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
      const value = Math.round(from + (target - from) * eased)
      setDisplay(value)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = target
      }
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [target, durationMs])

  return display
}
