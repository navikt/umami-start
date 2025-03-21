import { useState, useEffect } from "react";
import './CopyButton.css'
import { Button } from "@navikt/ds-react";
import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
    textToCopy: string;
    visible: boolean;
}

function CopyButton({ textToCopy, visible }: CopyButtonProps) {
    const [isCopied, setIsCopied] = useState(false);

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(textToCopy);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
    };

    // Reset copied state when text changes
    useEffect(() => {
        setIsCopied(false);
    }, [textToCopy]);

    if (!visible) return null;

    return (
        <Button 
            onClick={copyToClipboard} 
            id="sql-copy-button"
            icon={isCopied ? <Check size="1.2rem" /> : <Copy size="1.2rem" />}
        >
            {isCopied ? 'Kopiert!' : 'Kopier graf'}
        </Button>
    );
}

export default CopyButton;
