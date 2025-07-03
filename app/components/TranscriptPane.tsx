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
  const transcriptLinesRef = useRef<string[]>([]);
  const actionsRef = useRef<string[]>([]);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLiveActive && window.api && typeof window.api.receive === 'function') {
      console.warn('TranscriptPane: Setting up IPC listener for live-transcript');

      const onTranscript = (data: string) => {
        console.warn('TranscriptPane: Received transcript:', data);
        setTranscriptLines(prev => {
          const next = [...prev, data];
          transcriptLinesRef.current = next;
          return next;
        });

        // Debounce action generation to avoid excessive API calls
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
          try {
            console.warn('TranscriptPane: Invoking streamGroqQuestions with transcript length', transcriptLinesRef.current.length);
            const validatedActions = await window.api.invoke('streamGroqQuestions', actionsRef.current, transcriptLinesRef.current.join('\n'));
            console.warn('TranscriptPane: Received actions', validatedActions);
            console.warn('TranscriptPane: Validated actions length', validatedActions.length);
            // Strip newlines from each action to ensure single-line display
            const cleanedActions = (validatedActions || []).map((action: string) => String(action).trim());
            setActions(cleanedActions);
            actionsRef.current = cleanedActions;
          } catch (err) {
            console.error('GroqHelper error:', err);
          }
        }, 1500);
      };

      window.api.receive('live-transcript', onTranscript);

      return () => {
        console.warn('TranscriptPane: Cleaning up IPC listener');
        window.api.removeAllListeners('live-transcript');
        if (debounceRef.current) clearTimeout(debounceRef.current);
      };
    } else if (!isLiveActive) {
      // If live mode is deactivated, clear existing transcripts
      setTranscriptLines([]);
      transcriptLinesRef.current = [];
      setActions([]);
      actionsRef.current = [];
      return undefined; // Explicitly return undefined
    }
    return undefined; // Default return for paths that don't return a cleanup function
  }, [isLiveActive]);

  useEffect(() => {
    // Scroll to bottom when transcript updates
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [transcriptLines]);

  return (
    <div className="flex flex-col h-full glass rounded-lg shadow-inner">
      {/* Top Half - Transcript with auto-scroll */}
      <div className="flex-1 flex flex-col p-4 pb-2 min-h-0">
        <h2 className="text-lg font-semibold mb-2 shrink-0">Live Transcription</h2>
        <div className="flex-1 flex flex-col justify-end overflow-y-auto space-y-1 text-sm content-end">
          {transcriptLines.map((line, index) => (
            <p key={index} className="break-words">{line}</p>
          ))}
          <div ref={transcriptEndRef} />
        </div>
      </div>
      
      {/* Divider */}
      <hr className="mx-4 border-gray-300" />
      
      {/* Bottom Half - Actions */}
      <div className="flex-1 flex flex-col p-4 pt-2 min-h-0">
        <h2 className="text-lg font-semibold mb-2 shrink-0">Actions</h2>
        <div className="flex-1 overflow-y-auto">
          <div className="text-sm">
            {actions.map((action, index) => (
              <div
                key={index}
                className="flex items-start p-2 rounded-md cursor-pointer transition-colors duration-200"
                onClick={() => window.api?.send('live-audio-send-text-input', action)}
              >
                <span className="mr-2">•</span>
                <div className="flex-1">
                  <MarkdownRenderer content={action} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranscriptPane;
