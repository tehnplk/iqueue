import { useEffect, useState } from 'react'

// True while the shared call cooldown (owned by the main process) is running.
export default function useCallCooldown() {
  const [until, setUntil] = useState(0)
  const [, rerender] = useState(0)

  useEffect(() => {
    window.bar.getCallCooldown().then(setUntil)
    return window.bar.onCallCooldown(setUntil)
  }, [])

  useEffect(() => {
    const ms = until - Date.now()
    if (ms <= 0) return
    const t = setTimeout(() => rerender((n) => n + 1), ms)
    return () => clearTimeout(t)
  }, [until])

  return Date.now() < until
}
