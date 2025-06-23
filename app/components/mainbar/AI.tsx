import { useState, useEffect, useRef } from 'react';
import { Input } from "../ui/input";

export const AI = () => {
    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input when component mounts
    useEffect(() => {
        inputRef.current?.focus();

        // Listen for IPC event to focus input
        if (window.api?.receive) {
            window.api.receive('chat-focus-input', () => {
                inputRef.current?.focus();
            });
        }

        return () => {
            // Clean up listeners when unmounting
            if (window.api?.removeAllListeners) {
                window.api.removeAllListeners('chat-focus-input');
            }
        };
    }, []);

    const handleSubmit = (e: React.FormEvent<HTMLInputElement>) => {
        e.preventDefault(); // Prevent default form submission behavior
        // You can add logic here to handle the submitted value (inputValue)

        setInputValue(''); // Clear the input field
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
    };

    return (
        <div className="flex items-center justify-center h-full">
            <Input
                className="glass m-1 rounded-full"
                placeholder="Ask me anything..."
                value={inputValue}
                onChange={handleChange}
                onSubmit={handleSubmit}
                ref={inputRef}
            />
        </div>
    );
};
