import React, { useState, useEffect, useRef } from 'react';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface TranscriptPaneProps {
  // No props needed for now, as it will listen to IPC events
}

const TranscriptPane: React.FC<TranscriptPaneProps> = () => {
  const [transcriptLines, setTranscriptLines] = useState<string[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Ensure window.api is available
    if (window.api && typeof window.api.receive === 'function') {
      console.warn('TranscriptPane: Setting up IPC listener for live-transcript');

      const handleLiveTranscript = (transcript: string) => {
        console.warn('TranscriptPane: Received transcript chunk:', transcript);
        setTranscriptLines((prevLines) => {
          // Deepgram sends interim results, so we'll update the last line
          // if it's an interim result, otherwise add a new line.
          // A simple heuristic for now: if the new transcript is a continuation
          // of the last line and the last line wasn't final, update it.
          // For more robust handling, Deepgram's final/is_final flag should be used.
          if (prevLines.length > 0 && !transcript.endsWith('.')) { // Simple check for interim
            const newLines = [...prevLines];
            newLines[newLines.length - 1] = transcript;
            return newLines;
          } else {
            return [...prevLines, transcript];
          }
        });
      };

      window.api.receive('live-transcript', handleLiveTranscript);

      // Cleanup on component unmount
      return () => {
        console.warn('TranscriptPane: Cleaning up IPC listener for live-transcript');
        window.api.removeAllListeners('live-transcript');
      };
    } else {
      console.error('TranscriptPane: window.api.receive is not available. IPC communication will not work.');
    }
  }, []);

  useEffect(() => {
    // Scroll to bottom when transcript updates
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcriptLines]);

  return (
    <div className="flex flex-col h-full p-4 bg-gray-800 text-white rounded-lg shadow-inner overflow-y-auto">
      <h2 className="text-lg font-semibold mb-2">Live Transcription</h2>
      <div className="flex-grow space-y-1 text-sm">
        {transcriptLines.map((line, index) => (
          <p key={index}>{line}</p>
        ))}
        <div ref={transcriptEndRef} />
      </div>
    </div>
  );
};

export default TranscriptPane;
