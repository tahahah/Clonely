class PCMWorkletProcessor extends AudioWorkletProcessor {
  /**
   * Convert Float32 samples to interleaved 16-bit PCM (little-endian).
   * Expects 2-channel input: channel[0] = mic (L), channel[1] = device (R).
   */
  process (inputs) {
    const channels = inputs[0]
    if (!channels || channels.length === 0) return true

    const left = channels[0]
    const right = channels[1] || channels[0] // Fallback to mono if right missing
    const frameCount = left.length

    // Int16Array interleaved LRLR...
    const pcm = new Int16Array(frameCount * 2)
    for (let i = 0; i < frameCount; i++) {
      // Clamp
      const l = Math.max(-1, Math.min(1, left[i]))
      const r = Math.max(-1, Math.min(1, right[i]))
      pcm[i * 2] = l < 0 ? l * 0x8000 : l * 0x7fff
      pcm[i * 2 + 1] = r < 0 ? r * 0x8000 : r * 0x7fff
    }

    // Transfer underlying buffer to avoid copy
    this.port.postMessage(pcm.buffer, [pcm.buffer])
    return true
  }
}

registerProcessor('pcm-worklet', PCMWorkletProcessor);

