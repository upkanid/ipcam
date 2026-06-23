/** Scale video dimensions so the longest side ≤ maxSide, preserving aspect ratio. */
export function calcVcamDimensions(
  vW: number,
  vH: number,
  maxSide = 1280
): { W: number; H: number } {
  const scale = Math.min(1, maxSide / vW, maxSide / vH)
  return { W: Math.floor(vW * scale), H: Math.floor(vH * scale) }
}
