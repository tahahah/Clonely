import { Mic, X, Command, CornerDownLeft, Space, Eye, EyeOff } from 'lucide-react';
import { useSelector } from '@xstate/react';
import { useUIActor } from '../../state/UIStateProvider';
import { useEffect, useState, useRef } from 'react';
import { Button } from '../ui/button';
import { startAudioStreaming, AudioStreamHandle } from '../../lib/liveAudioStream';
import { startFrameStreaming, FrameStreamHandle } from '../../lib/liveFrameStream';



export const Mainbar = () => {
  const [isInvisible, setIsInvisible] = useState(false);

  // Sync initial and subsequent invisibility state from main process
  useEffect(() => {
    const updateState = (state: boolean) => setIsInvisible(state);
    window.api.invoke('get-invisibility-state').then(updateState).catch(() => {});
    window.api.receive('invisibility-state-changed', updateState);
    return () => window.api.removeAllListeners('invisibility-state-changed');
  }, []);

  const uiActor = useUIActor();

  // Debug: log every state transition
  useEffect(() => {
    const subscription = uiActor.subscribe((_snap) => {

    });
    return () => subscription.unsubscribe();
  }, [uiActor]);
  const { send } = uiActor;

  const { chatActive, isRecording } = useSelector(uiActor, (s) => ({
    chatActive: s.matches('chat'),
    isRecording: s.matches('live'),
  }));

  // TODO: Recording time should be driven by a state machine service
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Live audio streaming refs
  const audioHandleRef = useRef<AudioStreamHandle | null>(null);
  const frameHandleRef = useRef<FrameStreamHandle | null>(null);


  useEffect(() => {

    if (isRecording) {
      setRecordingTime(0); // Reset timer

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prevTime) => prevTime + 1);
      }, 1000);
    } else {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      setRecordingTime(0);
    }
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, [isRecording]);


  const handleChatClick = () => {
    send({ type: 'OPEN_CHAT' });
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${minutes}:${secs}`;
  };

  const stopRecording = async () => {
    window.api.send('live-audio-done');
    if (audioHandleRef.current) {
      await audioHandleRef.current.stop();
      audioHandleRef.current = null;
    }
    if (frameHandleRef.current) {
      frameHandleRef.current.stop();
      frameHandleRef.current = null;
    }
    
    setRecordingTime(0);
  };

  useEffect(() => {
    if (!isRecording) {
      stopRecording();
    }
  }, [isRecording]);

  const handleMicClick = async () => {
    console.warn("isRecording: "+isRecording)
    if (isRecording) {
      // Tell state machine to stop
      send({ type: 'MIC_STOP' });
    } else {
      try {
        // ======== Start Recording (optimised) ========
        const { handle: audioHandle, streams } = await startAudioStreaming((chunk) => {
          if (!uiActor.getSnapshot().matches({ live: 'streaming' })) return;
          window.api.send('live-audio-chunk', chunk);
        });
        audioHandleRef.current = audioHandle;

        // ---- JPEG frame streaming ----
        const frameHandle = startFrameStreaming(
          streams.systemStream,
          (jpeg) => {
            if (!uiActor.getSnapshot().matches({ live: 'streaming' })) return;
            window.api.send('live-image-chunk', jpeg);
          },
          { width: 1280, height: 720, intervalMs: 1000, quality: 1}
        );
        frameHandleRef.current = frameHandle;

        // Tell the UI state machine to transition to live mode
        send({ type: 'MIC_START' });

      } catch (_error) {
        console.error('[live] failed to start streaming', _error);
      }
    }
  };

  const handleInvisibilityToggle = () => {
    setIsInvisible((prevState) => !prevState);
    window.api.send('toggle-invisibility');
  };

  return (
    <div className="pl-5 pr-5 glass rounded-full font-sans flex-none w-[33.333vw] h-[5.5vh] max-w-[33.333vw] max-h-[5.5vh]">
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