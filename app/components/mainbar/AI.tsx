import { useState, useEffect, useRef } from 'react';
import { useSelector } from '@xstate/react';
import { useUIActor } from '../../state/UIStateProvider';
import { Input } from '../ui/input';
import { Command, CornerDownLeft } from 'lucide-react';
import MarkdownRenderer from '../MarkdownRenderer';
import TranscriptPane from '../TranscriptPane';


interface AIProps {
  isChatPaneVisible: boolean;
}

export const AI: React.FC<AIProps> = ({ isChatPaneVisible }) => {
  const actor = useUIActor();
  const { send } = actor;

  const { state, isChatIdle, isChatLoading, isChatError, isLiveActive } = useSelector(actor, (s) => ({
    state: s,
    isChatIdle: s.matches({ chat: 'idle' }),
    isChatLoading: s.matches({ chat: 'loading' }),
    isChatError: s.matches({ chat: 'error' }),
    isLiveActive: s.matches({ live: 'active' }),
  }));

  const [answer, setAnswer] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Streamed chunk listener (legacy)
  useEffect(() => {
    const handleChunk = (chunk: string) => {
      setAnswer((prev) => (prev || '') + chunk);
    };
    window.api.receive('chat:chunk', handleChunk);
    return () => {
      window.api.removeAllListeners('chat:chunk');
    };
  }, []);

  useEffect(() => {
    if (state.matches('activeIdle')) {
      setAnswer(null);
      setErrorMessage(null);
      setInputValue('');
    } else if (isChatLoading) {
      setAnswer('');
      setErrorMessage(null);
    }
  }, [state, isChatLoading]);

  useEffect(() => {
    const handleStreamChunk = (chunk: { text?: string; reset?: boolean }) => {
      if (chunk.reset) {
        setAnswer('');
        return;
      }
      if (chunk.text) {
        setAnswer((prev) => (prev || '') + chunk.text);
      }
    };

    const handleApiError = (error: string) => setErrorMessage(error);
    const handleSetInitialInput = (value: string) => setInputValue(value);

    // Expose focus and send helpers for global shortcuts
    (window as any).chatInputAPI = {
      focus: () => {
        inputRef.current?.focus();
      },
      submit: () => {
        const val = inputRef.current?.value.trim() || '';
        if (!isChatLoading && val) {
          send({ type: 'SUBMIT', value: val });
          setInputValue('');
        }
      }
    };

    window.api.receive('api-stream-chunk', handleStreamChunk as any);
    window.api.receive('gemini-transcript', handleStreamChunk as any);
    window.api.receive('api-error', handleApiError);
    window.api.receive('set-initial-input', handleSetInitialInput);

    return () => {
      window.api.removeAllListeners('api-stream-chunk');
      delete (window as any).chatInputAPI;
      window.api.removeAllListeners('gemini-transcript');
      window.api.removeAllListeners('api-error');
      window.api.removeAllListeners('set-initial-input');
    };
  }, [send, isChatLoading]);

  useEffect(() => {
    if (isChatPaneVisible && (isChatIdle || isChatError)) {
      inputRef.current?.focus();
    }
  }, [isChatPaneVisible, isChatIdle, isChatError]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const renderContent = () => {
    if (isChatError) {
      return (
        <div className="p-4 text-red-500 glass rounded-lg w-full text-center">
          {errorMessage || 'An error occurred.'}
        </div>
      );
    }

    let contentToDisplay;

    if (errorMessage) {
      contentToDisplay = (
        <div className="p-4 text-red-500 glass rounded-lg w-full text-center">
          {errorMessage}
        </div>
      );
    } else if (isChatLoading && !answer) {
      contentToDisplay = (
        <div className="p-4 text-md glass rounded-lg w-full text-left min-h-[56px] max-h-[90%] overflow-y-auto overflow-x-hidden animate-pulse">
          Loading...
        </div>
      ); // Placeholder for loading animation
    } else if (answer) {
      contentToDisplay = (
        <div className="p-4 text-md glass rounded-lg w-full text-left min-h-[56px] max-h-[90%] overflow-y-auto overflow-x-hidden">
          <MarkdownRenderer content={answer || ''} />
        </div>
      );
    }

    return (
      <div className="flex w-full h-full gap-3">
        {/* Left Column for TranscriptPane */}
        {isLiveActive && (
          <div className="w-2/3 h-full min-h-0">
            <TranscriptPane />
          </div>
        )}

        {/* Right Column for Chat Content */}
        <div className="flex flex-col w-full h-full gap-2">
          {contentToDisplay}
          <div className="relative w-full">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={handleInputChange}
              placeholder={
                isChatLoading
                  ? 'Generating answer...'
                  : answer
                  ? 'Ask a follow-up...'
                  : 'Ask me anything...'
              }
              className="glass rounded-full w-full pr-14"
              disabled={isChatLoading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isChatLoading && inputValue.trim()) {
                  send({ type: 'SUBMIT', value: inputValue });
                  setInputValue('');
                }
              }}
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className="flex gap-2 pt-2">
                <Command className="size-4" />
                <CornerDownLeft className="size-4" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start justify-center h-full w-full bg-transparent p-2 font-sans">
      {renderContent()}
    </div>
  );
};
