import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from '@xstate/react';
import { useUIActor } from '../state/UIStateProvider';



const TranscriptPane: React.FC = () => {
  const actor = useUIActor();
  const { isLiveActive } = useSelector(actor, (s) => ({
    isLiveActive: s.matches('live'),
  }));
  const [transcriptLines, setTranscriptLines] = useState<string[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLiveActive && window.api && typeof window.api.receive === 'function') {
      console.warn('TranscriptPane: Setting up IPC listener for live-transcript');

      const handleLiveTranscript = (chunk: string) => {
        console.warn('TranscriptPane: Received transcript chunk:', chunk);
        setTranscriptLines((prevLines) => [...prevLines, chunk]);
      };

      window.api.receive('live-transcript', handleLiveTranscript);

      // Cleanup on component unmount
      return () => {
        console.warn('TranscriptPane: Cleaning up IPC listener for live-transcript');
        window.api.removeAllListeners('live-transcript');
      };
    } else if (!isLiveActive) {
      // If live mode is deactivated, clear existing transcripts
      setTranscriptLines([]);
      return undefined; // Explicitly return undefined
    }
    return undefined; // Default return for paths that don't return a cleanup function
  }, [isLiveActive]);

  useEffect(() => {
    // Scroll to bottom when transcript updates
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcriptLines]);

  return (
    <div className="flex flex-col h-full p-4 glass rounded-lg shadow-inner overflow-y-auto">
      <h2 className="text-lg font-semibold mb-2">Live Transcription</h2>
      <div className="space-y-1 text-sm h-full content-end">
        <div ref={transcriptEndRef} />
        {transcriptLines.map((line, index) => (
          <p key={index}>{line}</p>
        ))}
      </div>
    </div>
  );
};

export default TranscriptPane;
