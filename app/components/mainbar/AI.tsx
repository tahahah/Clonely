import { useState, useEffect, useRef } from 'react';
import { Input } from '../ui/input';

// Local copy of UIState enum to avoid importing main-process code that relies on Node modules.
export enum UIState {
  ActiveIdle = 'ACTIVE_IDLE',
  ReadyChat = 'READY_CHAT',
  Loading = 'LOADING',
  Error = 'ERROR',
}

export const AI = () => {
  const [inputValue, setInputValue] = useState('');
  const [uiState, setUiState] = useState<UIState>(UIState.ReadyChat);
  const [answer, setAnswer] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleStateChange = ({ prev, next }) => {
      setUiState(next)

      if (next === UIState.Loading) {
        setAnswer('') // Clear previous answer and prepare for stream
        setErrorMessage(null)
      }

      if (next === UIState.ActiveIdle) {
        setInputValue('')
        setAnswer(null)
        setErrorMessage(null)
      }

      // After a stream is complete, clear the user's last input
      if (prev === UIState.Loading && next === UIState.ReadyChat) {
        setInputValue('')
      }
    }

    const handleStreamChunk = (chunk: string) => {
      setAnswer((prev) => (prev || '') + chunk)
    }

    const handleApiError = (error: string) => {
      setErrorMessage(error)
    }

    const handleSetInitialInput = (value: string) => {
      setInputValue(value)
    }

    // Listen for state changes from the main process
    window.api.receive('state-changed', handleStateChange)
    window.api.receive('api-stream-chunk', handleStreamChunk)
    window.api.receive('api-error', handleApiError)
    window.api.receive('set-initial-input', handleSetInitialInput)

    // Cleanup listener on unmount
    return () => {
      window.api.removeAllListeners('state-changed')
      window.api.removeAllListeners('api-stream-chunk')
      window.api.removeAllListeners('api-error')
      window.api.removeAllListeners('set-initial-input')
    }
  }, []) // Empty dependency array ensures this runs only once

  // Effect for focusing input, separated for clarity and correctness
  useEffect(() => {
    if (uiState === UIState.ReadyChat) {
      inputRef.current?.focus()
    }
  }, [uiState])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    window.api.send('input-changed', value);
  };

  const renderContent = () => {
    if (uiState === UIState.Error) {
      return (
        <div className="p-4 text-red-500 glass rounded-lg w-full text-center">
          {errorMessage || 'An error occurred.'}
        </div>
      )
    }

    // For both Loading and ReadyChat, we show the answer and input.
    // The differences are handled by conditionals inside.
    const isLoading = uiState === UIState.Loading

    return (
      <div className="flex flex-col w-full h-full gap-2">
        {/* Show answer box if we have an answer OR if we are loading (to show the stream) */}
        {(answer || isLoading) && (
          <div className="p-4 text-white text-md glass rounded-lg w-full text-left min-h-[56px] max-h-[90%] overflow-y-auto">
            {answer || ''}
          </div>
        )}
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          placeholder={
            isLoading
              ? 'Generating answer...'
              : answer
              ? 'Ask a follow-up...'
              : 'Ask me anything...'
          }
          className="glass m-1 rounded-full w-full"
          disabled={isLoading}
        />
      </div>
    )
  }

  return (
    <div className="flex items-start justify-center h-full w-full bg-transparent p-2">
      {renderContent()}
    </div>
  );
};
