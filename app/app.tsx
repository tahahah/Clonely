import { Mainbar } from './components/mainbar/Mainbar'
import { AI } from './components/mainbar/AI'
import { useUIState } from './state/UIStateProvider'

export default function App() {
  const isChatPaneVisible = useUIState((state) => state.matches('chat'))

  return (
    <div className="w-full h-full flex flex-col items-center justify-start gap-1 pt-2">
      <Mainbar />
      {isChatPaneVisible && (
        <div className="w-[40vw] h-[33.333vh] max-h-[45vh] px-4">
          <AI isChatPaneVisible={isChatPaneVisible} />
        </div>
      )}
    </div>
  )
}

