class PCMWorkletProcessor extends AudioWorkletProcessor {
  process (inputs) {
    const inputChannelData = inputs[0][0];
    if (!inputChannelData) return true;

    const pcm = new Int16Array(inputChannelData.length);
    for (let i = 0; i < inputChannelData.length; i++) {
      const s = Math.max(-1, Math.min(1, inputChannelData[i]));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    // Transfer the underlying buffer to avoid a copy.
    this.port.postMessage(pcm.buffer, [pcm.buffer]);
    return true; // keep processor alive
  }
}

registerProcessor('pcm-worklet', PCMWorkletProcessor);
