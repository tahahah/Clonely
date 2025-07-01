import { useState, useEffect } from 'react'
import { Mainbar } from './components/mainbar/Mainbar'
import { AI } from './components/mainbar/AI'

export default function App() {
  const [isChatPaneVisible, setChatPaneVisible] = useState(false)

  useEffect(() => {
    const handleVisibilityChange = (isVisible: boolean) => {
      setChatPaneVisible(isVisible)
    }

    // Listen for visibility changes from the main process
    window.api.receive('ui:set-chat-pane-visibility', handleVisibilityChange)

    // Cleanup listener on unmount
    return () => {
      window.api.removeAllListeners('ui:set-chat-pane-visibility')
    }
  }, []) // Empty dependency array ensures this runs only once

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

