import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

export class TranscribeHelper {
  private deepgram: ReturnType<typeof createClient>;
  private connection: any | null = null;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.DEEPGRAM_API_KEY || (import.meta as any).env?.VITE_DEEPGRAM_API_KEY;
    if (!this.apiKey) {
      console.error('Deepgram API Key not found. Please set DEEPGRAM_API_KEY in your .env file.');
    }
    this.deepgram = createClient(this.apiKey);
  }

  public async start(onTranscript: (res: { transcript: string; channel: number; isFinal: boolean; words?: any[] }) => void, onUtteranceEnd?: () => void): Promise<void> {
    if (!this.apiKey) {
      console.error('Cannot start Deepgram transcription: API Key is missing.');
      return Promise.reject(new Error('Deepgram API Key is missing.'));
    }

    if (this.connection) {
      console.warn('Deepgram connection already active. Stopping existing connection before starting a new one.');
      this.finish();
    }

    return new Promise<void>((resolve, reject) => {
      try {
        console.warn('Attempting to connect to Deepgram...');
        this.connection = this.deepgram.listen.live({
          model: 'nova-3',
          language: 'en-US',
          smart_format: true,
          encoding: 'linear16',
          sample_rate: 16000,
          channels: 2,
          multichannel: true,
        });

        this.connection.on(LiveTranscriptionEvents.Open, () => {
          console.warn('Deepgram connection opened.');
          resolve();
        });

        this.connection.on(LiveTranscriptionEvents.Close, () => {
          console.warn('Deepgram connection closed.');
          this.connection = null;
        });

        this.connection.on(LiveTranscriptionEvents.Transcript, (data) => {
          const alt = data.channel.alternatives[0];
          if (!alt?.transcript) return;
          const channelIndex = data.channel_index[0];
          const result = {
            transcript: alt.transcript as string,
            words: (alt.words || []).map((w: any) => ({
              ...w,
              speaker: channelIndex,
            })),
            channel: channelIndex,
            isFinal: data.is_final as boolean,
            start: data.start,
            end: data.start+data.duration,
          };
          console.log(`[Deepgram Transcript] Channel: ${result.channel}, IsFinal: ${result.isFinal}, Transcript: "${result.transcript}"`);
          onTranscript(result as any);
        });

        this.connection.on(LiveTranscriptionEvents.UtteranceEnd, () => {
          console.warn('[TranscribeHelper] Utterance end');
          onUtteranceEnd?.();
        });

        this.connection.on(LiveTranscriptionEvents.Metadata, (_meta) => {
          // console.warn('Deepgram Metadata:', data);
        });

        this.connection.on(LiveTranscriptionEvents.Error, (err) => {
          console.error('Deepgram Error:', err);
          this.connection = null;
          reject(err);
        });

      } catch (error) {
        console.error('Failed to establish Deepgram connection:', error);
        this.connection = null;
        reject(error);
      }
    });
  }

  public sendChunk(chunk: Buffer): void {
    if (this.connection && this.connection.getReadyState() === 1) { // WebSocket.OPEN
      this.connection.send(chunk);
    } else {
      console.warn('Deepgram connection not open. Cannot send audio chunk.');
    }
  }

  public finish(): void {
    if (this.connection) {
      console.warn('Closing Deepgram connection.');
      this.connection.finish();
      this.connection = null;
    } else {
      console.warn('No active Deepgram connection to close.');
    }
  }
}
