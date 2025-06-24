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
    // Focus the input when the component becomes ready
    if (uiState === UIState.ReadyChat) {
      inputRef.current?.focus();
    }

    const handleStateChange = ({ next }) => {
      setUiState(next);
      if (next === UIState.ActiveIdle) {
        setInputValue(''); // Clear input when returning to idle
        setAnswer(null); // Clear answer as well
        setErrorMessage(null); // Clear error message
      }
    };

    const handleApiResult = (result: string) => {
      setAnswer(result);
      setInputValue(''); // Clear input after getting an answer
    };

    const handleApiError = (error: string) => {
      setErrorMessage(error);
    };

    const handleSetInitialInput = (value: string) => {
      setInputValue(value);
    };

    // Listen for state changes from the main process
    window.api.receive('state-changed', handleStateChange);
    window.api.receive('api-result', handleApiResult);
    window.api.receive('api-error', handleApiError);
    window.api.receive('set-initial-input', handleSetInitialInput);

    // Cleanup listener on unmount
    return () => {
      window.api.removeAllListeners('state-changed');
      window.api.removeAllListeners('api-result');
      window.api.removeAllListeners('api-error');
      window.api.removeAllListeners('set-initial-input');
    };
  }, [uiState]); // Re-run effect if uiState changes to handle focus

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    window.api.send('input-changed', value);
  };

  const renderContent = () => {
    if (uiState === UIState.Loading) {
      return <div className="p-4 text-white glass rounded-lg w-full text-center">Loading...</div>;
    }

    if (uiState === UIState.Error) {
      return (
        <div className="p-4 text-red-500 glass rounded-lg w-full text-center">
          {errorMessage || 'An error occurred.'}
        </div>
      );
    }

    // Default case for ReadyChat. It will show the input, and the answer if it exists.
    return (
      <div className="flex flex-col items-center justify-center w-full gap-2">
        {answer && (
          <div className="p-4 text-white text-lg glass rounded-lg w-full text-left">
            {answer}
          </div>
        )}
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          placeholder={answer ? 'Ask a follow-up...' : 'Ask me anything...'}
          className="glass m-1 rounded-full w-full"
        />
      </div>
    );
  };

  return (
    <div className="flex items-center justify-center h-full w-full bg-transparent p-2">
      {renderContent()}
    </div>
  );
};
