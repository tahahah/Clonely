import { initMain } from 'electron-audio-loopback';

/**
 * A helper class to manage audio capture, including microphone and system audio.
 */
export class AudioHelper {
  /**
   * Initializes the audio capture functionality in the main process.
   * This must be called before the app is ready.
   */
  public static initialize(): void {
    initMain();
  }
}
