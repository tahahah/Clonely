declare module 'electron-audio-loopback' {
  export function initMain(): void;
  export function getLoopbackAudioMediaStream(options?: { removeVideo?: boolean }): Promise<MediaStream>;
}
