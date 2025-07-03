import { startAudioCapture, stopAudioCapture, AudioCaptureStreams } from './audio'

export interface AudioStreamHandle {
  stop: () => Promise<void>
}

/**
 * Start microphone + system audio capture and stream 16-kHz PCM chunks via an AudioWorklet.
 * The worklet converts Float32 samples to 16-bit little-endian PCM off the main thread.
 */
export async function startAudioStreaming (
  onPCMChunk: (chunk: Uint8Array) => void
): Promise<{ handle: AudioStreamHandle; streams: AudioCaptureStreams }> {
  const streams = await startAudioCapture()

  // We create a separate AudioContext so the caller is not responsible for closing it.
  const ctx = new AudioContext({ sampleRate: 16000 })
  await ctx.audioWorklet.addModule(
    // Path is resolved relative to this file at runtime by bundlers like Vite.
    new URL('../worklets/pcm-worklet.js', import.meta.url).href
  )

  const source = ctx.createMediaStreamSource(streams.combinedStream)
  const worklet = new AudioWorkletNode(ctx, 'pcm-worklet')

  worklet.port.onmessage = (e) => {
    // The worklet posts back a transferable ArrayBuffer.
    const buff = new Uint8Array(e.data as ArrayBuffer)
    onPCMChunk(buff)
  }

  source.connect(worklet)
  // Required in some browsers – connect to destination even if we never listen.
  worklet.connect(ctx.destination)

  const handle: AudioStreamHandle = {
    async stop () {
      source.disconnect()
      worklet.disconnect()
      await ctx.close()
      await stopAudioCapture(streams)
    }
  }

  return { handle, streams }
}
