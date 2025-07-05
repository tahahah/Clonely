import { useState, lazy, Suspense } from 'react';
import { Mainbar } from './components/mainbar/Mainbar';
import { useUIState } from './state/UIStateProvider';

const AI = lazy(() => import('./components/mainbar/AI').then(module => ({ default: module.AI })));


export default function App() {
  const isChatPaneVisible = useUIState((state) => state.matches('chat') || state.matches('live'))
  const [isWideChatPane, setIsWideChatPane] = useState(false);

  const chatPaneWidthClass = isWideChatPane ? 'w-[60vw]' : 'w-[40vw]';

  return (
    <div className="w-full h-full flex flex-col items-center justify-start gap-1 pt-2">
      <Mainbar />

        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isChatPaneVisible ? 'max-h-[45vh] opacity-100' : 'max-h-0 opacity-0'} px-4 ${chatPaneWidthClass}`}>
          <Suspense fallback={<div className="flex-1 p-4 glass rounded-lg animate-pulse">Loading AI...</div>}>
          <AI isChatPaneVisible={isChatPaneVisible} onContentChange={setIsWideChatPane} />
        </Suspense>
        </div>

    </div>
  )
}

