import { Mic, MenuIcon, SettingsIcon, Command, CornerDownLeft, Space } from "lucide-react"
import { Button } from "../ui/button"

export const Mainbar = () => {
    return (
            <div className="w-full h-16 pl-5 pr-5 glass rounded-full shadow-lg">
                <div className="flex items-center justify-between w-full h-full">
                    {/* Left - Chat button */}
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm">
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