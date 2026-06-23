/**
 * Accumulate Float32 PCM samples and flush exact-sized chunks.
 * Returns { chunks, remaining } where each chunk is an ArrayBuffer of chunkSize * 4 bytes.
 */
export function flushAudioChunks(
  pending: Float32Array,
  input: Float32Array,
  chunkSize: number
): { chunks: ArrayBuffer[]; remaining: Float32Array } {
  const merged = new Float32Array(pending.length + input.length)
  merged.set(pending)
  merged.set(input, pending.length)

  const chunks: ArrayBuffer[] = []
  let offset = 0
  while (offset + chunkSize <= merged.length) {
    chunks.push(merged.buffer.slice(offset * 4, (offset + chunkSize) * 4))
    offset += chunkSize
  }

  return { chunks, remaining: merged.slice(offset) }
}
