// Keep a global reference to the audio context
let audioContext: AudioContext | null = null;

export type AudioCaptureStreams = {
  combinedStream: MediaStream;
  micStream: MediaStream;
  systemStream: MediaStream;
};

/**
 * Starts capturing both microphone and system audio and combines them into a single stream.
 *
 * @returns A promise that resolves to an object containing the combined stream and the original source streams for cleanup.
 */
export async function startAudioCapture(): Promise<AudioCaptureStreams> {
  try {
    // 1. Get or create an AudioContext
    if (!audioContext || audioContext.state === 'closed') {
      audioContext = new AudioContext();
    }

    // 2. Capture microphone input
    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const micSource = audioContext.createMediaStreamSource(micStream);

    // 3. Capture system audio loopback
    await window.api.enableLoopback();
    const systemStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });
    systemStream.getVideoTracks().forEach((track) => track.stop()); // We don't need video
    const systemSource = audioContext.createMediaStreamSource(systemStream);

    // 4. Combine streams
    const destination = audioContext.createMediaStreamDestination();
    micSource.connect(destination);
    systemSource.connect(destination);

    const combinedStream = destination.stream;

    return { combinedStream, micStream, systemStream };
  } catch (err) {
    console.error('Error starting audio capture:', err);
    // Best-effort cleanup if something goes wrong during startup
    await stopAudioCapture({} as AudioCaptureStreams); // Pass empty object to trigger cleanup
    throw err;
  }
}

/**
 * Stops all provided audio streams and disables system audio loopback.
 *
 * @param streams An object containing the streams to stop.
 */
export async function stopAudioCapture(streams: Partial<AudioCaptureStreams>): Promise<void> {
  streams.combinedStream?.getTracks().forEach((track) => track.stop());
  streams.micStream?.getTracks().forEach((track) => track.stop());
  streams.systemStream?.getTracks().forEach((track) => track.stop());

  // Close the audio context if it exists
  if (audioContext && audioContext.state !== 'closed') {
    await audioContext.close();
    audioContext = null;
  }

  // Tell the main process to disable system audio loopback.
  await window.api.disableLoopback().catch((err) => {
    console.error('Failed to disable loopback on cleanup:', err);
  });
}
