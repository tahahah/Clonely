import { Mic, X, Command, CornerDownLeft, Space, Eye, EyeOff } from 'lucide-react';
import { useSelector } from '@xstate/react';
import { useUIActor } from '../../state/UIStateProvider';
import { useEffect, useState, useRef } from 'react';
import { Button } from '../ui/button';



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
  const { send } = uiActor;

  const { chatActive, isRecording } = useSelector(uiActor, (s) => ({
    chatActive: s.matches('chat'),
    isRecording: s.matches('live'),
  }));

  // TODO: Recording time should be driven by a state machine service
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  const handleMicClick = () => {
    if (isRecording) {
      send({ type: 'MIC_STOP' });
    } else {
      send({ type: 'MIC_START' });
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