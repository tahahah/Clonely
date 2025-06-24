import { Mic, SettingsIcon, Command, CornerDownLeft, Space } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "../ui/button"

export enum UIState {
  ActiveIdle = 'ACTIVE_IDLE',
  ReadyChat = 'READY_CHAT',
  Loading = 'LOADING',
  Error = 'ERROR',
}

export const Mainbar = () => {
    const [chatActive, setChatActive] = useState(false);

    useEffect(() => {
        const handleStateChange = ({ next }: { prev: UIState; next: UIState }) => {
            setChatActive([UIState.ReadyChat, UIState.Loading, UIState.Error].includes(next));
        };
        window.api.receive('state-changed', handleStateChange);
        return () => window.api.removeAllListeners('state-changed');
    }, []);

    const handleChatClick = () => {
        window.api.send('open-chat');
    };

    return (
            <div className="w-full h-16 pl-5 pr-5 glass rounded-full font-sans">
                <div className="flex items-center justify-between w-full h-full">
                    {/* Left - Chat button */}
                    <div className="flex items-center gap-2">
                        <Button variant={chatActive ? "secondary" : "ghost"} size="sm" onClick={handleChatClick}>
                            <span>Chat</span>
                            <Command />
                            <CornerDownLeft />
                        </Button>
                    </div>

                    {/* Middle - Show/Hide */}
                    <div className="flex items-center gap-2">       
                        <Button variant="ghost" size="sm">
                            <span>Hide</span>
                            <Command />
                            <Space />
                        </Button>
                    </div>

                    {/* Right - Microphone and recording */}
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm">
                            <span>00:00</span>
                            <Mic />
                        </Button>
                    </div>

                    {/* Right - Settings button */}
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm">
                            <SettingsIcon />
                        </Button>
                    </div>
                </div>
            </div>
    )
}