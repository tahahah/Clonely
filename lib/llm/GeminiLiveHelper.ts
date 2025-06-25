import { GoogleGenAI, Modality } from '@google/genai'

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY

if (!GEMINI_API_KEY) {
  throw new Error(
    'GEMINI_API_KEY is not set. Ensure it exists in .env or as a system env variable, or that it is defined in Vite env files.'
  )
}

const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY })

interface LiveSession {
  sendRealtimeInput: (input: any) => void
  close: () => void
}

interface ChatChunk { text?: string; reset?: boolean }

export class GeminiLiveHelper {
  private session: LiveSession | null = null
  private readonly modelName = 'gemini-live-2.5-flash-preview'
  private closePending = false
  private turnJustCompleted = false

  async startSession(onMessage: (chunk: ChatChunk) => void): Promise<void> {
    if (this.session) return // already running

    const responseQueue: any[] = []

    const waitMessage = async () => {
      while (responseQueue.length === 0) {
        await new Promise((res) => setTimeout(res, 50))
      }
      return responseQueue.shift()
    }

    const handleTurn = async () => {
      const turns: any[] = []
      let done = false
      while (!done) {
        const message = await waitMessage()
        turns.push(message)
        if (message?.serverContent?.turnComplete) {
          done = true
        }
      }
      return turns
    }

    this.session = (await genAI.live.connect({
      model: this.modelName,
      callbacks: {
        onopen: () => console.warn('[GeminiLive] opened'),
        onmessage: (m) => {
          responseQueue.push(m)
          const tText = (m as any).text
          if (tText) {
            if (this.turnJustCompleted) {
              onMessage({ reset: true })
              this.turnJustCompleted = false
            }
            onMessage({ text: tText })
          }
          if (m?.serverContent?.turnComplete) {
            this.turnJustCompleted = true
          }
          if (m?.serverContent?.turnComplete && this.closePending && this.session) {
            // turn finished and user toggled mic off – close socket
            this.session.close()
            this.session = null
            this.closePending = false
          }
        },
        onerror: (e) => console.error('[GeminiLive] error', e),
        onclose: (e) => console.warn('[GeminiLive] closed', e.reason)
      },
      config: { responseModalities: [Modality.TEXT] }
    })) as unknown as LiveSession

    // detach async listener to forward text
    ;(async () => {
      const turns = await handleTurn()
      for (const t of turns) {
        const text = (t as any).text
        if (text) {
          onMessage({ text })
        }
      }
    })()
  }


  // Stream an audio chunk (called every ~250 ms)
  sendAudioChunk(chunk: Uint8Array): void {
    if (!this.session) return
    const base64Audio = Buffer.from(chunk).toString('base64')
    this.session.sendRealtimeInput({
      audio: { data: base64Audio, mimeType: 'audio/pcm;rate=16000' }
    })
  }

  // Stream a JPEG image frame
  sendImageChunk(base64Jpeg: string): void {
    if (!this.session) return;

    this.session.sendRealtimeInput({ video: { data: base64Jpeg, mimeType: 'image/jpeg' } });
  }

  // Called when the mic button is toggled OFF
  finishTurn(): void {
    if (!this.session) return
    // Send explicit end-of-turn marker but keep socket open for reply
    this.session.sendRealtimeInput({ audioStreamEnd: true })
    this.closePending = true
  }
}
