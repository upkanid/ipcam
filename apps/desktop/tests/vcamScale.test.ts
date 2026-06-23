import { describe, it, expect } from 'vitest'
import { calcVcamDimensions } from '../src/renderer/src/vcamScale'

describe('calcVcamDimensions', () => {
  it('landscape within limit — no scale', () => {
    expect(calcVcamDimensions(1280, 720)).toEqual({ W: 1280, H: 720 })
  })

  it('portrait within limit — no scale', () => {
    expect(calcVcamDimensions(720, 1280)).toEqual({ W: 720, H: 1280 })
  })

  it('landscape over limit — scales down by width', () => {
    const { W, H } = calcVcamDimensions(1920, 1080)
    expect(W).toBe(1280)
    expect(H).toBe(720)
  })

  it('portrait over limit — scales down by height', () => {
    const { W, H } = calcVcamDimensions(1080, 1920)
    expect(W).toBe(720)
    expect(H).toBe(1280)
  })

  it('square', () => {
    expect(calcVcamDimensions(1920, 1920)).toEqual({ W: 1280, H: 1280 })
  })

  it('small input — no upscale', () => {
    expect(calcVcamDimensions(480, 640)).toEqual({ W: 480, H: 640 })
  })
})
