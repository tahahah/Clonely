import React, { useState, useEffect, useRef } from 'react';



const TranscriptPane: React.FC = () => {
  const [transcriptLines, setTranscriptLines] = useState<string[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Ensure window.api is available
    if (window.api && typeof window.api.receive === 'function') {
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
    } else {
      // If window.api is not available, return nothing (undefined) for cleanup.
      return undefined;
      console.error('TranscriptPane: window.api.receive is not available. IPC communication will not work.');
    }
  }, []);

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
