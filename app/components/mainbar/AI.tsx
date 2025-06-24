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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus the input when the component becomes ready
    if (uiState === UIState.ReadyChat) {
      inputRef.current?.focus();
    }

    const handleStateChange = ({ next }) => {
      console.log(`[Renderer] Received state change: ${next}`);
      setUiState(next);
      if (next === UIState.ActiveIdle) {
        setInputValue(''); // Clear input when returning to idle
      }
    };

    // Listen for state changes from the main process
    window.api.receive('state-changed', handleStateChange);

    // Cleanup listener on unmount
    return () => {
      window.api.removeAllListeners('state-changed');
    };
  }, [uiState]); // Re-run effect if uiState changes to handle focus

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    window.api.send('input-changed', value);
  };

  const renderContent = () => {
    switch (uiState) {
      case UIState.Loading:
        return <div className="p-2 text-white">Loading...</div>;
      case UIState.Error:
        return <div className="p-2 text-red-500">An error occurred.</div>;
      default:
        return (
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            placeholder="Ask me anything..."
            className="glass m-1 rounded-full w-full"
          />
        );
    }
  };

  return (
    <div className="flex items-center justify-center h-full w-full bg-transparent">
      {renderContent()}
    </div>
  );
};
