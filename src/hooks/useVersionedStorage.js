import { useEffect, useState } from 'react'

const CURRENT_SCHEMA_VERSION = 2

function readStoredValue(key, fallback) {
  try {
    const storedVersion = Number(localStorage.getItem('mikiosco-schema-version') || 0)
    if (storedVersion !== CURRENT_SCHEMA_VERSION) return fallback
    return JSON.parse(localStorage.getItem(key)) || fallback
  } catch {
    return fallback
  }
}

export function useVersionedStorage(key, fallback, delay = 180) {
  const [value, setValue] = useState(() => readStoredValue(key, fallback))

  useEffect(() => {
    const timer = window.setTimeout(() => {
      localStorage.setItem('mikiosco-schema-version', String(CURRENT_SCHEMA_VERSION))
      localStorage.setItem(key, JSON.stringify(value))
    }, delay)
    return () => window.clearTimeout(timer)
  }, [delay, key, value])

  return [value, setValue]
}
