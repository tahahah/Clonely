import { Mic, X, Command, CornerDownLeft, Space, Eye, EyeOff } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { Button } from '../ui/button';

import { startAudioCapture, stopAudioCapture, AudioCaptureStreams } from '../../lib/audio';

export enum UIState {
  ActiveIdle = 'ACTIVE_IDLE',
  ReadyChat = 'READY_CHAT',
  Loading = 'LOADING',
  Error = 'ERROR',
}

export const Mainbar = () => {
  const [isInvisible, setIsInvisible] = useState(false);

  // Sync initial and subsequent invisibility state from main process
  useEffect(() => {
    const updateState = (state: boolean) => setIsInvisible(state);
    window.api.invoke('get-invisibility-state').then(updateState).catch(() => {});
    window.api.receive('invisibility-state-changed', updateState);
    return () => window.api.removeAllListeners('invisibility-state-changed');
  }, []);
  const [chatActive, setChatActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  // we no longer use MediaRecorder (webm not supported by Gemini)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioStreamsRef = useRef<AudioCaptureStreams | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const videoElemRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const handleStateChange = ({ next }: { prev: UIState; next: UIState }) => {
      setChatActive([UIState.ReadyChat, UIState.Loading, UIState.Error].includes(next));
    };
    window.api.receive('state-changed', handleStateChange);
    return () => window.api.removeAllListeners('state-changed');
  }, []);

  const handleChatClick = () => {
    window.api.send('open-chat');
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${minutes}:${secs}`;
  };

  const handleMicClick = async () => {
    if (isRecording) {
      // stop recording
      window.api.send('live-audio-done');

      // Clean up audio nodes
      processorRef.current?.disconnect();
      audioCtxRef.current?.close();
      processorRef.current = null;
      audioCtxRef.current = null;

      if (audioStreamsRef.current) {
        await stopAudioCapture(audioStreamsRef.current);
        audioStreamsRef.current = null;
      }

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
      }
      // cleanup video & canvas
      if (videoElemRef.current) {
        videoElemRef.current.srcObject = null;
        videoElemRef.current = null as any;
      }
      canvasRef.current = null;
      setRecordingTime(0);
      setIsRecording(false);
    } else {
      try {
        const streams = await startAudioCapture();
        audioStreamsRef.current = streams;

        // ---- PCM streaming setup ----
        const ctx = new AudioContext({ sampleRate: 16000 });
        await ctx.resume();
        audioCtxRef.current = ctx;

        const sourceNode = ctx.createMediaStreamSource(streams.combinedStream);
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          const input = e.inputBuffer.getChannelData(0);
          // Convert Float32 [-1,1] to 16-bit PCM little-endian
          const pcm = new Int16Array(input.length);
          for (let i = 0; i < input.length; i++) {
            const s = Math.max(-1, Math.min(1, input[i]));
            pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          window.api.send('live-audio-chunk', new Uint8Array(pcm.buffer));
        };

        sourceNode.connect(processor);
        processor.connect(ctx.destination); // required in some browsers

        // ---- Screen frame capture setup ----
        const videoElem = document.createElement('video');
        videoElem.muted = true;
        videoElem.srcObject = streams.systemStream;
        await videoElem.play();
        videoElemRef.current = videoElem;
        const canvas = document.createElement('canvas');
        canvas.width = 1280;
        canvas.height = 720;
        canvasRef.current = canvas;
        const ctx2d = canvas.getContext('2d');
        frameIntervalRef.current = setInterval(() => {
          if (!ctx2d || videoElem.readyState < 2) return;
          ctx2d.drawImage(videoElem, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 1.0);
          const base64 = dataUrl.split(',')[1];
          window.api.send('live-image-chunk', base64);
        }, 1000);

        setIsRecording(true);
        // Notify main to start Gemini session
        window.api.send('open-chat');
        window.api.send('live-audio-start');
        setRecordingTime(0); // Reset timer
        recordingIntervalRef.current = setInterval(() => {
          setRecordingTime((prevTime) => prevTime + 1);
        }, 1000);
      } catch (error) {
        console.error('Failed to start recording:', error);
        if (audioStreamsRef.current) {
          await stopAudioCapture(audioStreamsRef.current);
        }
        setIsRecording(false);
      }
    }
  };

  const handleInvisibilityToggle = () => {
    setIsInvisible((prevState) => !prevState);
    window.api.send('toggle-invisibility');
  };

  return (
    <div className="w-full h-16 pl-5 pr-5 glass rounded-full font-sans">
      <div className="flex items-center justify-between w-full h-full">
        {/* Left - Chat button */}
        <div className="flex items-center gap-2">
          <Button variant={chatActive ? 'secondary' : 'ghost'} size="sm" onClick={handleChatClick}>
            <span>Chat</span>
            <Command />
            <CornerDownLeft />
          </Button>
        </div>

        {/* Middle - Show/Hide */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm">
            <span>Hide</span>
            <Command />
            <Space />
          </Button>
        </div>

        {/* Right - Microphone and recording */}
        <div className="flex items-center gap-2">
          <Button variant={isRecording ? 'destructive' : 'ghost'} size="sm" onClick={handleMicClick}>
            <span>{formatTime(recordingTime)}</span>
            <Mic className={isRecording ? 'animate-pulse text-red-500' : ''} />
          </Button>
        </div>

        {/* Right - Invisibility Toggle */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleInvisibilityToggle} title={isInvisible ? 'Enable invisibility' : 'Disable invisibility'}>
            {isInvisible ? <Eye /> : <EyeOff />}
          </Button>
        </div>

        {/* Right - Quit button */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => window.api.send('quit-app')} title="Quit App">
            <X />
          </Button>
        </div>
      </div>
    </div>
  );
};