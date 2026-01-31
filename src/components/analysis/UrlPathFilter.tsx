import { useState, useRef } from "react";
import { Label, UNSAFE_Combobox, Modal, Textarea, Button, TextField } from "@navikt/ds-react";
import { normalizeUrlToPath } from "../../lib/utils";

interface UrlPathFilterProps {
    /** Array of selected URL paths */
    urlPaths: string[];
    /** Callback when paths change */
    onUrlPathsChange: (paths: string[]) => void;
    /** Path operator: 'equals' or 'starts-with' */
    pathOperator: string;
    /** Callback when operator changes */
    onPathOperatorChange: (operator: string) => void;
    /** Optional: Selected website domain for validation in bulk add */
    selectedWebsiteDomain?: string;
    /** Label text (default: "URL-sti") */
    label?: string;
    /** Placeholder text */
    placeholder?: string;
    /** Size of the component */
    size?: "small" | "medium";
    /** Whether to hide the label */
    hideLabel?: boolean;
    /** Whether to show the operator dropdown */
    showOperator?: boolean;
    /** Optional additional class names */
    className?: string;
}

export const UrlPathFilter = ({
    urlPaths,
    onUrlPathsChange,
    pathOperator,
    onPathOperatorChange,
    selectedWebsiteDomain,
    label = "URL-sti",
    placeholder = "Skriv og trykk enter",
    size = "small",
    hideLabel = false,
    showOperator = true,
    className = ""
}: UrlPathFilterProps) => {
    // Combobox input state
    const [comboInputValue, setComboInputValue] = useState("");

    // Bulk URL modal state
    const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
    const [urlPasteInput, setUrlPasteInput] = useState("");
    const [urlPasteError, setUrlPasteError] = useState("");
    const urlModalRef = useRef<HTMLDialogElement>(null);

    // Unsaved input modal state (shown when user blurs with typed text)
    const [isUnsavedModalOpen, setIsUnsavedModalOpen] = useState(false);
    const [unsavedValue, setUnsavedValue] = useState("");
    const unsavedModalRef = useRef<HTMLDialogElement>(null);
    const isSelectingRef = useRef(false); // Track if user is selecting from dropdown

    // Helper function to normalize domain for comparison
    const normalizeDomain = (domain: string) => {
        const cleaned = domain
            .trim()
            .toLowerCase()
            .replace(/^https?:\/\//, "")
            .replace(/\.$/, "")
            .replace(/^www\./, "");
        return cleaned === "nav.no" ? "www.nav.no" : cleaned;
    };

    // Parse input that may contain multiple URLs/paths (newlines, commas, semicolons)
    const parseMultipleUrls = (input: string): { paths: string[], invalid: string[] } => {
        const rawLines = input
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n")
            .split(/[\n,;]+/)
            .map(s => s.trim())
            .filter(s => s.length > 0);

        const paths: string[] = [];
        const invalid: string[] = [];
        const currentDomain = selectedWebsiteDomain ? normalizeDomain(selectedWebsiteDomain) : null;

        rawLines.forEach(line => {
            if (line.match(/^https?:\/\//)) {
                try {
                    const url = new URL(line);
                    if (currentDomain) {
                        const lineDomain = normalizeDomain(url.hostname);
                        if (lineDomain !== currentDomain && !lineDomain.endsWith('.' + currentDomain)) {
                            invalid.push(line);
                            return;
                        }
                    }
                    paths.push(url.pathname);
                } catch (e) {
                    invalid.push(line);
                }
            } else {
                const path = line.startsWith('/') ? line : '/' + line;
                paths.push(path);
            }
        });

        return { paths, invalid };
    };

    // Check if input contains multiple values (has separators)
    const hasMultipleValues = (input: string): boolean => {
        return /[\n,;]/.test(input);
    };

    // Handle pasting multiple URLs directly into combobox
    const handlePaste = (e: React.ClipboardEvent) => {
        const pastedText = e.clipboardData.getData('text');
        
        if (hasMultipleValues(pastedText)) {
            e.preventDefault(); // Prevent default paste behavior
            
            const { paths, invalid } = parseMultipleUrls(pastedText);
            
            if (invalid.length > 0) {
                // If there are invalid URLs, fall back to modal for user feedback
                setUrlPasteInput(pastedText);
                setUrlPasteError(`Noen URL-er tilhører ikke valgt nettside eller er ugyldige. Sjekk: ${invalid.slice(0, 3).join(', ')}${invalid.length > 3 ? '...' : ''}`);
                setIsUrlModalOpen(true);
                return;
            }
            
            if (paths.length > 0) {
                // Add all valid paths
                const uniqueNewPaths = new Set([...urlPaths, ...paths]);
                onUrlPathsChange(Array.from(uniqueNewPaths));
                setComboInputValue("");
            }
        }
        // Single value paste is handled normally by the combobox
    };

    const handleBulkAddUrls = () => {
        if (!urlPasteInput.trim()) {
            setIsUrlModalOpen(false);
            return;
        }

        const { paths, invalid } = parseMultipleUrls(urlPasteInput);

        if (invalid.length > 0) {
            setUrlPasteError(`Noen URL-er tilhører ikke valgt nettside (${selectedWebsiteDomain}) eller er ugyldige. Sjekk: ${invalid.slice(0, 3).join(', ')}${invalid.length > 3 ? '...' : ''}`);
            return;
        }

        // Add to urlPaths (avoiding duplicates)
        const uniqueNewPaths = new Set([...urlPaths, ...paths]);
        onUrlPathsChange(Array.from(uniqueNewPaths));

        // Cleanup
        setUrlPasteInput("");
        setUrlPasteError("");
        setIsUrlModalOpen(false);
    };

    const handleToggleSelected = (option: string, isSelected: boolean) => {
        console.log('[UrlPathFilter] handleToggleSelected called:', { option, isSelected, currentPaths: urlPaths });
        
        // Mark that we're in a selection process
        isSelectingRef.current = true;
        
        if (isSelected) {
            let normalized = normalizeUrlToPath(option);
            console.log('[UrlPathFilter] normalizeUrlToPath result:', normalized);
            // Ensure path starts with / if it has content
            if (normalized && !normalized.startsWith('/')) {
                normalized = '/' + normalized;
            }
            if (normalized && !urlPaths.includes(normalized)) {
                const newPaths = [...urlPaths, normalized];
                console.log('[UrlPathFilter] Adding path, new paths:', newPaths);
                onUrlPathsChange(newPaths);
            }
        } else {
            // When removing, match against both the raw option and the normalized version
            let normalized = normalizeUrlToPath(option);
            if (normalized && !normalized.startsWith('/')) {
                normalized = '/' + normalized;
            }
            const newPaths = urlPaths.filter(p => p !== option && p !== normalized);
            console.log('[UrlPathFilter] Removing path, new paths:', newPaths);
            onUrlPathsChange(newPaths);
        }
        
        // Clear input after handling toggle
        setComboInputValue("");
        
        // Reset selection flag after a short delay
        setTimeout(() => {
            isSelectingRef.current = false;
        }, 100);
    };

    // Handle blur - show modal if there's unsaved input
    const handleBlur = () => {
        // Use a small delay to allow toggle selection to complete first
        setTimeout(() => {
            const trimmedValue = comboInputValue.trim();
            // Only show modal if there's actual input and we're not in the middle of selecting
            if (trimmedValue && !isSelectingRef.current) {
                setUnsavedValue(trimmedValue);
                setIsUnsavedModalOpen(true);
            }
        }, 150);
    };

    // Handle adding the unsaved value
    const handleAddUnsavedValue = () => {
        let normalized = normalizeUrlToPath(unsavedValue);
        if (normalized && !normalized.startsWith('/')) {
            normalized = '/' + normalized;
        }
        if (normalized && !urlPaths.includes(normalized)) {
            onUrlPathsChange([...urlPaths, normalized]);
        }
        setComboInputValue("");
        setUnsavedValue("");
        setIsUnsavedModalOpen(false);
    };

    // Handle discarding the unsaved value
    const handleDiscardUnsavedValue = () => {
        setComboInputValue("");
        setUnsavedValue("");
        setIsUnsavedModalOpen(false);
    };

    return (
        <div className={className}>
            {showOperator && (
                <div className="flex items-center gap-2 mb-1">
                    {!hideLabel && <Label size={size} htmlFor="url-filter">{label}</Label>}
                    <select
                        className="text-sm bg-[var(--ax-bg-default)] border border-[var(--ax-border-neutral-subtle)] rounded text-[var(--ax-text-accent)] font-medium cursor-pointer focus:outline-none py-1 px-2"
                        value={pathOperator}
                        onChange={(e) => onPathOperatorChange(e.target.value)}
                    >
                        <option value="equals">er lik</option>
                        <option value="starts-with">starter med</option>
                    </select>
                </div>
            )}
            <div onPaste={handlePaste} onBlur={handleBlur}>
                <UNSAFE_Combobox
                    id="url-filter"
                    label={label}
                    hideLabel={showOperator || hideLabel}
                    size={size}
                    isMultiSelect
                    allowNewValues
                    options={urlPaths.map(p => ({ label: p, value: p }))}
                    selectedOptions={urlPaths}
                    onToggleSelected={handleToggleSelected}
                    value={comboInputValue}
                    onChange={(val) => setComboInputValue(val)}
                    placeholder={placeholder}
                />
            </div>

            {/* Unsaved input confirmation modal */}
            <Modal
                ref={unsavedModalRef}
                open={isUnsavedModalOpen}
                onClose={handleDiscardUnsavedValue}
                header={{ heading: "Lagre URL-sti?", closeButton: true }}
            >
                <Modal.Body>
                    <p className="mb-4">
                        Du har skrevet inn en verdi som ikke ble lagt til. Rediger om nødvendig:
                    </p>
                    <TextField
                        label="URL-sti"
                        hideLabel
                        size="small"
                        value={unsavedValue.startsWith('/') ? unsavedValue : '/' + unsavedValue}
                        onChange={(e) => setUnsavedValue(e.target.value)}
                    />
                </Modal.Body>
                <Modal.Footer>
                    <Button onClick={handleAddUnsavedValue}>
                        Legg til
                    </Button>
                    <Button variant="secondary" onClick={handleDiscardUnsavedValue}>
                        Forkast
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Bulk URL paste modal */}
            <Modal
                ref={urlModalRef}
                open={isUrlModalOpen}
                onClose={() => {
                    setIsUrlModalOpen(false);
                    setUrlPasteError("");
                    setUrlPasteInput("");
                }}
                header={{ heading: "Lim inn flere URL-er", closeButton: true }}
            >
                <Modal.Body>
                    <Textarea
                        label="Lim inn URL-er (én per linje, eller kommaseparert)"
                        description="Du kan lime inn hele URL-er (f.eks. https://nav.no/side) eller bare stier (/side)"
                        value={urlPasteInput}
                        onChange={(e) => {
                            setUrlPasteInput(e.target.value);
                            setUrlPasteError("");
                        }}
                        minRows={6}
                    />
                    {urlPasteError && (
                        <p className="text-red-600 text-sm mt-2">{urlPasteError}</p>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button onClick={handleBulkAddUrls}>
                        Legg til
                    </Button>
                    <Button variant="secondary" onClick={() => {
                        setIsUrlModalOpen(false);
                        setUrlPasteError("");
                        setUrlPasteInput("");
                    }}>
                        Avbryt
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default UrlPathFilter;
