// Kept identical in mobile/src/cartSync.js so both apps follow the same rules.
export function createCartSync({ load, save, onChange, onError }) {
  let cart = []
  let ready = false
  let stopped = false
  let reading = false
  let pending = 0
  let version = 0
  let queue = Promise.resolve()

  async function refresh() {
    if (stopped || reading || pending) return
    reading = true
    const startedAt = version
    try {
      const items = await load()
      if (!Array.isArray(items)) throw new Error('Unable to load your saved cart.')
      if (!stopped && !pending && startedAt === version) {
        cart = items
        ready = true
        onChange(cart)
        onError('')
      }
    } catch {
      if (!stopped) onError('Cannot sync your cart right now. Please check your connection.')
    } finally {
      reading = false
    }
  }

  function update(change) {
    if (stopped) return
    if (!ready) {
      onError('Please wait for your saved cart to load before changing it.')
      return
    }
    cart = typeof change === 'function' ? change(cart) : change
    onChange(cart)
    const items = cart
    version += 1
    pending += 1
    queue = queue.then(async () => {
      try {
        await save(items)
        if (!stopped) onError('')
      } catch {
        // Reload the saved cart rather than silently claiming an edit was saved.
        ready = false
        if (!stopped) onError('Your cart change could not be saved. Please check your connection and try again.')
      } finally {
        pending -= 1
      }
    })
    return queue
  }

  return {
    refresh,
    update,
    stop() { stopped = true },
    flush() { return queue },
  }
}
