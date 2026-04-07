/**
 * In-memory file buffer store for download support.
 * Clears on restart — sufficient for hackathon demo.
 */
const store = new Map() // documentId -> { name, mimetype, buffer }

export function storeFile(docId, { name, mimetype, buffer }) {
  store.set(docId, { name, mimetype, buffer })
}

export function getFile(docId) {
  return store.get(docId) || null
}

export function getFiles(docIds) {
  return docIds
    .map(id => ({ id, ...store.get(id) }))
    .filter(f => f.buffer)
}
