import { describe, it, expect } from 'vitest'
import { flushAudioChunks } from '../src/renderer/src/audioChunks'

const CHUNK = 4800

function f32(len: number, fill = 0): Float32Array {
  return new Float32Array(len).fill(fill)
}

describe('flushAudioChunks', () => {
  it('exact one chunk — flushes immediately, no remainder', () => {
    const { chunks, remaining } = flushAudioChunks(f32(0), f32(CHUNK, 1), CHUNK)
    expect(chunks).toHaveLength(1)
    expect(new Float32Array(chunks[0])).toHaveLength(CHUNK)
    expect(remaining).toHaveLength(0)
  })

  it('input smaller than chunk — nothing flushed, all pending', () => {
    const { chunks, remaining } = flushAudioChunks(f32(0), f32(4096), CHUNK)
    expect(chunks).toHaveLength(0)
    expect(remaining).toHaveLength(4096)
  })

  it('accumulates across two callbacks', () => {
    const r1 = flushAudioChunks(f32(0), f32(4096), CHUNK)
    expect(r1.chunks).toHaveLength(0)
    expect(r1.remaining).toHaveLength(4096)

    // second callback brings total to 8192 → 1 chunk of 4800, remainder 3392
    const r2 = flushAudioChunks(r1.remaining, f32(4096), CHUNK)
    expect(r2.chunks).toHaveLength(1)
    expect(r2.remaining).toHaveLength(8192 - CHUNK)
  })

  it('large input yields multiple chunks', () => {
    const { chunks, remaining } = flushAudioChunks(f32(0), f32(CHUNK * 3 + 100), CHUNK)
    expect(chunks).toHaveLength(3)
    expect(remaining).toHaveLength(100)
  })

  it('chunk bytes are exactly chunkSize * 4', () => {
    const { chunks } = flushAudioChunks(f32(0), f32(CHUNK), CHUNK)
    expect(chunks[0].byteLength).toBe(CHUNK * 4)
  })

  it('preserves sample values correctly', () => {
    const input = Float32Array.from({ length: CHUNK }, (_, i) => i / CHUNK)
    const { chunks } = flushAudioChunks(f32(0), input, CHUNK)
    const out = new Float32Array(chunks[0])
    expect(out[0]).toBeCloseTo(0)
    expect(out[CHUNK - 1]).toBeCloseTo((CHUNK - 1) / CHUNK)
  })
})
