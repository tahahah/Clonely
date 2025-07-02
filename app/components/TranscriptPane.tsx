import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from '@xstate/react';
import { useUIActor } from '../state/UIStateProvider';

import MarkdownRenderer from './MarkdownRenderer';

const TranscriptPane: React.FC = () => {
  const actor = useUIActor();
  const { isLiveActive } = useSelector(actor, (s) => ({
    isLiveActive: s.matches('live'),
  }));
  const [transcriptLines, setTranscriptLines] = useState<string[]>([]);
  const [actions, setActions] = useState<string[]>([]);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLiveActive && window.api && typeof window.api.receive === 'function') {
      console.warn('TranscriptPane: Setting up IPC listener for live-transcript');

      const handleLiveTranscript = (data: string) => {
        console.warn('TranscriptPane: Received transcript chunk:', data);
        setTranscriptLines((prevLines) => [...prevLines, data].slice(-1000)); // Keep last 1000 lines

        // Debounce action generation to avoid excessive API calls
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
          try {
            const validatedActions = await window.api.invoke('streamGroqQuestions', actions, [...transcriptLines, data].join('\n'));
            setActions(validatedActions);
          } catch (err) {
            console.error('GroqHelper error:', err);
          }
        }, 1500);
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
  }, [isLiveActive, transcriptLines, actions]);

  useEffect(() => {
    // Scroll to bottom when transcript updates
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
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
      <hr className="my-3" />
      <h2 className="text-lg font-semibold mb-2">Actions</h2>
      <ul className="list-disc list-inside space-y-1 text-sm">
        {actions.map((act, idx) => (
          <li key={idx} className="break-words">
            <MarkdownRenderer content={act} />
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TranscriptPane;
