import { useEffect, useRef, useState } from 'react'
import { createCartSync } from './cartSync'

export function useSyncedCart(userId, apiBase = '') {
  const [cart, setLocalCart] = useState([])
  const [cartError, setCartError] = useState('')
  const syncRef = useRef(null)

  useEffect(() => {
    setLocalCart([])
    setCartError('')
    if (!userId) return
    const sync = createCartSync({
      async load() {
        const response = await fetch(`${apiBase}/api/cart?user_id=${encodeURIComponent(userId)}`)
        if (!response.ok) throw new Error('Cart load failed')
        return response.json()
      },
      async save(items) {
        const response = await fetch(`${apiBase}/api/cart`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, items }),
        })
        if (!response.ok) throw new Error('Cart save failed')
        const result = await response.json()
        if (!result.success) throw new Error('Cart save failed')
      },
      onChange: setLocalCart,
      onError: setCartError,
    })
    syncRef.current = sync
    sync.refresh()
    const timer = setInterval(() => sync.refresh(), 3000)
    return () => {
      clearInterval(timer)
      sync.stop()
      syncRef.current = null
    }
  }, [userId, apiBase])

  function setCart(change) {
    if (userId) return syncRef.current?.update(change)
    setLocalCart(change)
  }

  // Finish edits already made before disconnecting the account.
  async function flushCart() {
    await syncRef.current?.flush()
  }

  return { cart, setCart, cartError, flushCart }
}
