import { useState } from 'react';
import { Mainbar } from './components/mainbar/Mainbar'
import { AI } from './components/mainbar/AI'
import { useUIState } from './state/UIStateProvider'

export default function App() {
  const isChatPaneVisible = useUIState((state) => state.matches('chat') || state.matches('live'))
  const [isWideChatPane, setIsWideChatPane] = useState(false);

  const chatPaneWidthClass = isWideChatPane ? 'w-[60vw]' : 'w-[40vw]';

  return (
    <div className="w-full h-full flex flex-col items-center justify-start gap-1 pt-2">
      <Mainbar />
      {isChatPaneVisible && (
        <div className={`h-[33.333vh] max-h-[45vh] px-4 transition-all duration-300 ease-in-out ${chatPaneWidthClass}`}>
          <AI isChatPaneVisible={isChatPaneVisible} onContentChange={setIsWideChatPane} />
        </div>
      )}
    </div>
  )
}

