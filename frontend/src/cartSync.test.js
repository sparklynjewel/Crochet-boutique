import test from 'node:test'
import assert from 'node:assert/strict'
import { createCartSync } from './cartSync.js'

const item = { id: 1, quantity: 2 }
function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

test('login and remote changes only load; empty remote carts also propagate', async () => {
  let saved = [item]
  let visible
  const writes = []
  const sync = createCartSync({ load: async () => saved, save: async (items) => writes.push(items), onChange: (items) => { visible = items }, onError() {} })
  await sync.refresh()
  assert.deepEqual(visible, [item])
  saved = []
  await sync.refresh()
  assert.deepEqual(visible, [])
  assert.deepEqual(writes, [])
})

test('edits cannot erase the saved cart before login finishes loading', async () => {
  const loading = deferred()
  const writes = []
  const sync = createCartSync({ load: () => loading.promise, save: async (items) => writes.push(items), onChange() {}, onError() {} })
  const refresh = sync.refresh()
  sync.update([])
  loading.resolve([item])
  await refresh
  assert.deepEqual(writes, [])
})

test('removing the last item saves an empty cart', async () => {
  const writes = []
  const sync = createCartSync({ load: async () => [item], save: async (items) => writes.push(items), onChange() {}, onError() {} })
  await sync.refresh()
  await sync.update([])
  assert.deepEqual(writes, [[]])
})

test('a slow poll cannot overwrite a newer local edit', async () => {
  const loading = deferred()
  let first = true
  let visible
  const sync = createCartSync({ load: () => { if (first) { first = false; return Promise.resolve([item]) } return loading.promise }, save: async () => {}, onChange: (items) => { visible = items }, onError() {} })
  await sync.refresh()
  const refresh = sync.refresh()
  await sync.update([{ ...item, quantity: 3 }])
  loading.resolve([item])
  await refresh
  assert.equal(visible[0].quantity, 3)
})

test('rapid edits save in order and sign-out does not clear the server cart', async () => {
  const saving = deferred()
  const writes = []
  const sync = createCartSync({ load: async () => [item], save: async (items) => { writes.push(items); if (writes.length === 1) await saving.promise }, onChange() {}, onError() {} })
  await sync.refresh()
  sync.update([{ ...item, quantity: 3 }])
  sync.update([{ ...item, quantity: 4 }])
  await Promise.resolve()
  assert.equal(writes.length, 1)
  saving.resolve()
  await sync.flush()
  sync.stop()
  await sync.refresh()
  assert.deepEqual(writes.map((items) => items[0].quantity), [3, 4])
})

test('failed reads do not turn into empty cart writes, and retry loads saved items', async () => {
  let fail = true
  let visible
  const writes = []
  const sync = createCartSync({ load: async () => { if (fail) throw new Error('offline'); return [item] }, save: async (items) => writes.push(items), onChange: (items) => { visible = items }, onError() {} })
  await sync.refresh()
  sync.update([])
  fail = false
  await sync.refresh()
  assert.deepEqual(visible, [item])
  assert.deepEqual(writes, [])
})
