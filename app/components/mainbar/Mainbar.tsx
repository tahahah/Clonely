import LiquidGlass from 'liquid-glass-react'
import { MessageSquare, MenuIcon, SettingsIcon } from "lucide-react"
import { Button } from "../ui/button"

export const Mainbar = () => {
    return (
            <div className="w-full h-16 bg-transparent">
                <div className="flex items-center justify-between w-full h-full">
                    {/* Left - Chat button */}
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon">
                            <span>Chat</span>
                            <MenuIcon />
                        </Button>
                    </div>

                    {/* Middle - Show/Hide */}
                    <div className="flex items-center gap-2">       
                        <Button variant="ghost" size="icon">
                            <span>Hide</span>
                            <MenuIcon />
                        </Button>
                    </div>

                    {/* Right - Microphone and recording */}
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon">
                            <span>00:00</span>
                            <MessageSquare />
                        </Button>
                    </div>

                    {/* Right - Settings button */}
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon">
                            <SettingsIcon />
                        </Button>
                    </div>
                </div>
            </div>
    )
}