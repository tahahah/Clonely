export interface FrameStreamOptions {
  width?: number
  height?: number
  intervalMs?: number // capture cadence in milliseconds
  quality?: number // JPEG quality 0–1
}

export interface FrameStreamHandle {
  stop: () => void
}

/**
 * Start JPEG frame capture of a given MediaStream (usually getDisplayMedia) and
 * deliver base-64 JPEG strings via the supplied callback.
 */
export function startFrameStreaming (
  systemVideoStream: MediaStream,
  onJPEG: (jpegBase64: string) => void,
  {
    width = 1280,
    height = 720,
    intervalMs = 750,
    quality = 1
  }: FrameStreamOptions = {}
): FrameStreamHandle {
  // Create hidden <video> element to render the stream.
  const videoElem = document.createElement('video')
  videoElem.muted = true
  videoElem.srcObject = systemVideoStream
  videoElem.width = width
  videoElem.height = height
  // Avoid letting the element affect layout.
  videoElem.style.position = 'fixed'
  videoElem.style.left = '-9999px'
  videoElem.style.top = '-9999px'
  document.body.appendChild(videoElem)

  const worker = new Worker(new URL('../workers/jpeg-worker.js', import.meta.url), {
    type: 'module'
  })
  worker.onmessage = (evt) => {
    const { base64, error } = evt.data as { base64?: string; error?: string }
    if (base64) {
      onJPEG(base64);
    } else if (error) console.warn('[frame-stream] worker error', error);
  }

  let running = true
  const tick = async () => {
    if (!running) return
    if (videoElem.readyState >= 2) {
      try {
        const bitmap = await createImageBitmap(videoElem, 0, 0, width, height, {
          resizeWidth: width,
          resizeHeight: height,
          resizeQuality: 'high'
        })
        worker.postMessage({ bitmap, width, height, quality }, [bitmap])
      } catch (err) {
        console.warn('[frame-stream] capture error', err)
      }
    }
    setTimeout(tick, intervalMs)
  }
  videoElem.play().then(tick)

  return {
    stop () {
      running = false
      videoElem.pause()
      videoElem.srcObject = null
      videoElem.remove()
      worker.terminate()
    }
  }
}
