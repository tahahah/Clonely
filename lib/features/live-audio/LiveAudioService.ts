import { GeminiLiveHelper } from '@/lib/llm/GeminiLiveHelper'
import { TranscribeHelper } from '@/lib/llm/TranscribeHelper'

export interface LiveAudioCallbacks {
  onGeminiChunk?: (chunk: { text?: string; reset?: boolean }) => void
  onTranscript?: (text: string) => void
}

/**
 * High-level wrapper that orchestrates both Gemini Live and Deepgram live transcription
 * in tandem. Other modules can treat this as a single service without worrying about
 * the individual SDKs or sequencing.
 */
export class LiveAudioService {
  private readonly gemini = new GeminiLiveHelper()
  private readonly transcribe = new TranscribeHelper()
  private active = false;
  private geminiAudioMuted = false; // New flag to control Gemini audio

  isActive(): boolean {
    return this.active
  }

  /**
   * Connect to both Gemini and Deepgram. Resolves once BOTH are ready to receive data.
   */
  async start(callbacks: LiveAudioCallbacks): Promise<void> {
    // Prevent duplicate or concurrent start attempts
    if (this.active) {
      console.warn('LiveAudioService already active, ignoring start()');
      return;
    }

    // Optimistically mark active to block re-entry while we connect
    this.active = true;

    const { onGeminiChunk, onTranscript } = callbacks;

    try {
      await Promise.all([
        this.gemini.startSession((chunk) => {
          onGeminiChunk?.(chunk);
          console.warn('Gemini chunk:', chunk);
        }),
        this.transcribe.start((text) => {
          onTranscript?.(text);
        }),
      ]);
    } catch (err) {
      // Roll back active flag if we fail to connect
      this.active = false;
      throw err;
    }
  }

  /** Forward a PCM 16k mono chunk to both services */
  sendAudioChunk(chunk: Buffer): void {
    if (!this.active) {
      return;
    }
    if (!this.geminiAudioMuted) {
      this.gemini.sendAudioChunk(chunk);
    }
    this.transcribe.sendChunk(chunk);
  }

  /** Gracefully end both streams and reset */
  stop(): void {
    if (!this.active) {
      return;
    }
    this.gemini.endSession()
    this.transcribe.finish()
    this.active = false

  }

  /** Signal end of current user turn but keep connection open */
  finishTurn(): void {
    if (!this.active) {
      return;
    }
    this.gemini.finishTurn()
  }

  /** Send a video frame (JPEG base64) to Gemini only */
  sendImageChunk(base64Jpeg: string): void {
    if (!this.active) {
      return;
    }
    this.gemini.sendImageChunk(base64Jpeg)
  }

  /** Relay a text input to Gemini if allowed */
  sendTextInput(text: string): void {
    if (this.gemini.canAcceptTextInput()) {
      this.gemini.sendTextInput(text)
    }
  }

  /** Toggle whether audio is sent to Gemini */
  toggleGeminiAudio(mute: boolean): void {
    this.geminiAudioMuted = mute;
    console.warn(`Gemini audio muted: ${this.geminiAudioMuted}`);
  }
}
