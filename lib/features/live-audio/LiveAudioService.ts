import { GeminiLiveHelper } from '@/lib/llm/GeminiLiveHelper'
import { TranscribeHelper } from '@/lib/llm/TranscribeHelper'
import { performance } from 'node:perf_hooks';

export interface LiveAudioCallbacks {
  onGeminiChunk?: (chunk: { text?: string; reset?: boolean }) => void
  onTranscript?: (alternative: { transcript: string; words?: any[] }) => void
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
  private transcriptDebounceTimer: NodeJS.Timeout | null = null;
  private bufferedTranscript: any = null;

  isActive(): boolean {
    return this.active
  }

  /**
   * Connect to both Gemini and Deepgram. Resolves once BOTH are ready to receive data.
   */
  async start(callbacks: LiveAudioCallbacks): Promise<void> {
    const tStart = performance.now();
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
        this.transcribe.start(
          (res) => {
            if (!res.isFinal) {
              return;
            }

            // If a transcript is already buffered, we have a pair.
            if (this.bufferedTranscript) {
              clearTimeout(this.transcriptDebounceTimer!);
              const buffered = this.bufferedTranscript;
              this.bufferedTranscript = null;

              // Prioritize channel 1 (system audio) as the cleaner source.
              let winner = buffered; // Default to the one that arrived first
              if (res.channel === 1 && buffered.channel !== 1) {
                winner = res; // The new one is channel 1, and the buffered one wasn't.
              }

              console.log(`[LiveAudioService] Debounced pair. Chose Ch${winner.channel} from Buffered(Ch${buffered.channel}) & Current(Ch${res.channel}).`);
              this.processFinalTranscript(winner, onTranscript);

            } else {
              // This is the first transcript of a potential pair. Buffer it and set a timer.
              this.bufferedTranscript = res;
              this.transcriptDebounceTimer = setTimeout(() => {
                if (this.bufferedTranscript) {
                  console.log(`[LiveAudioService] Processing single transcript after timeout.`);
                  this.processFinalTranscript(this.bufferedTranscript, onTranscript);
                  this.bufferedTranscript = null;
                }
              }, 200); // Wait 200ms for a potential duplicate
            }
          },
          () => {
            console.warn('[LiveAudioService] Utterance end, calling gemini.finishTurn()');
            this.gemini.finishTurn();
          },
        ),
      ]);
      console.log('[perf] live-audio-ready', (performance.now() - tStart).toFixed(1), 'ms');
    } catch (err) {
      // Roll back active flag if we fail to connect
      this.active = false;
      throw err;
    }
  }

  /** Forward a PCM 16k **stereo** chunk to Deepgram, and left (mic) channel to Gemini */
  sendAudioChunk(chunk: Buffer): void {
    if (!this.active) {
      return;
    }
    // Send mic-only (left channel) to Gemini if not muted
    if (!this.geminiAudioMuted) {
      const left = LiveAudioService.extractLeftChannel(chunk);
      if (left) {
        this.gemini.sendAudioChunk(left);
      }
    }
    // Send full stereo to Deepgram
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

  /**
   * Extract the LEFT channel (mic) from an interleaved Int16 stereo buffer.
   * Returns a new Buffer containing left-channel 16-bit PCM samples.
   */
  private static extractLeftChannel(stereo: Buffer): Buffer | null {
    if (stereo.length % 4 !== 0) return null; // expect 4 bytes per stereo frame
    const sampleCount = stereo.length / 4;
    const left = Buffer.allocUnsafe(sampleCount * 2);
    for (let i = 0; i < sampleCount; i++) {
      // Copy little-endian 16-bit left sample (bytes 0 & 1 of each 4-byte frame)
      left[i * 2] = stereo[i * 4];
      left[i * 2 + 1] = stereo[i * 4 + 1];
    }
    return left;
  }

  private processFinalTranscript(res: any, onTranscript: (res: any) => void): void {
    console.log(`[LiveAudioService] Sending to UI (isFinal): Channel: ${res.channel}, Transcript: "${res.transcript}"`);
    onTranscript?.(res);

    // If this is from device channel (1), feed to Gemini as text.
    if (res.channel === 1 && this.gemini.canAcceptTextInput()) {
        console.log(`[LiveAudioService] Sending text to Gemini (Device Channel): "Device: ${res.transcript}"`);
        this.gemini.sendTextInput(`Device: ${res.transcript}`);
    }
  }
}
