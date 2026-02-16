import { useMemo, useRef, useState } from "react";
import { Label, UNSAFE_Combobox, Modal, Textarea, Button } from "@navikt/ds-react";
import { useSearchParams } from "react-router-dom";
import { normalizeUrlToPath } from "../../lib/utils";
import { useWebsiteMatching } from "../../hooks/useWebsiteMatching";

interface UrlPathFilterProps {
    /** Array of selected URLs */
    urlPaths: string[];
    /** Callback when URLs change */
    onUrlPathsChange: (paths: string[]) => void;
    /** Path operator: 'equals' or 'starts-with' */
    pathOperator: string;
    /** Callback when operator changes */
    onPathOperatorChange: (operator: string) => void;
    /** Optional: Selected website domain for validation in bulk add */
    selectedWebsiteDomain?: string;
    /** Label text (default: "URL") */
    label?: string;
    /** Placeholder text */
    placeholder?: string;
    /** Size of the component */
    size?: "small" | "medium";
    /** Whether to hide the label */
    hideLabel?: boolean;
    /** Whether to show the operator dropdown */
    showOperator?: boolean;
    /** Whether to show selected paths as combobox suggestions */
    showSuggestions?: boolean;
    /** Optional additional class names */
    className?: string;
}

export const UrlPathFilter = ({
    urlPaths,
    onUrlPathsChange,
    pathOperator,
    onPathOperatorChange,
    selectedWebsiteDomain,
    label = "URL",
    size = "small",
    hideLabel = false,
    showOperator = true,
    showSuggestions = false,
    className = ""
}: UrlPathFilterProps) => {
    const formatPathLabel = (path: string) => (path === "/" ? "/ (forsiden)" : path);
    const parseFormattedPath = (path: string) => (path === "/ (forsiden)" ? "/" : path);
    const uniqueUrlPaths = useMemo(() => Array.from(new Set(urlPaths)), [urlPaths]);

    // Combobox input state
    const [comboInputValue, setComboInputValue] = useState("");

    // Bulk URL modal state
    const [isUrlModalOpen, setIsUrlModalOpen] = useState(false);
    const [urlPasteInput, setUrlPasteInput] = useState("");
    const [urlPasteError, setUrlPasteError] = useState("");
    const urlModalRef = useRef<HTMLDialogElement>(null);

    // Website switch confirmation modal state
    const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
    const [pendingSwitchData, setPendingSwitchData] = useState<{
        website: any;
        path: string;
        originalUrl: string;
    } | null>(null);
    // Modal for missing leading slash
    const [isMissingSlashModalOpen, setIsMissingSlashModalOpen] = useState(false);
    const [pendingMissingSlash, setPendingMissingSlash] = useState<string | null>(null);
    const switchModalRef = useRef<HTMLDialogElement>(null);

    // Track if user is selecting from dropdown (to avoid auto-add during selection)
    const isSelectingRef = useRef(false);

    // Navigation and Matching
    const [searchParams] = useSearchParams();
    const { findMatchingWebsite, normalizeDomain: normalizeDomainHelper } = useWebsiteMatching();

    // Helper function to normalize domain for comparison
    const normalizeDomain = (domain: string) => {
        return normalizeDomainHelper ? normalizeDomainHelper(domain) : domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
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
                    paths.push(decodeURIComponent(url.pathname));
                } catch (e) {
                    invalid.push(line);
                }
            } else {
                // Strip query parameters from relative paths
                let path = line;
                const queryIndex = path.indexOf('?');
                if (queryIndex !== -1) {
                    path = path.substring(0, queryIndex);
                }

                path = path.startsWith('/') ? path : '/' + path;
                paths.push(path);
            }
        });

        return { paths, invalid };
    };

    // Check if input contains multiple values (has separators)
    const hasMultipleValues = (input: string): boolean => {
        return /[\n,;]/.test(input);
    };

    const handleSiteSwitch = (website: any, path: string) => {
        const newParams = new URLSearchParams(searchParams);
        newParams.set('websiteId', website.id);
        newParams.set('domain', website.domain);
        // Only set urlPath if it's not root/empty, otherwise remove it or set it
        if (path && path !== '/') {
            newParams.set('urlPath', path);
        } else {
            newParams.delete('urlPath');
        }
        // Use window.location for a proper navigation that will be picked up by all components
        // (WebsitePicker uses window.location.search, not React Router's useSearchParams)
        window.location.search = newParams.toString();
    };

    // Handle pasting multiple URLs directly into combobox
    const handlePaste = async (e: React.ClipboardEvent) => {
        const pastedText = e.clipboardData.getData('text');

        // Check if single URL and matches another site
        if (!hasMultipleValues(pastedText) && pastedText.match(/^https?:\/\//)) {
            // e.preventDefault(); // Don't prevent default yet, we need to check asynchronously.
            // Actually capturing paste async is tricky in React. 
            // We'll prevent default, check, and if no match, manually insert? 
            // Better: Check async and if match found, prompt. If not, just let it process as path.

            // However, we must prevent default to handle the async flow properly or handle it in onChange/onBlur.
            // Let's try preventing default and falling back to manual insertion logic if no switch.
            e.preventDefault();

            const match = await findMatchingWebsite(pastedText);
            const currentDomain = selectedWebsiteDomain ? normalizeDomain(selectedWebsiteDomain) : null;

            if (match && currentDomain) {
                const matchDomain = normalizeDomain(match.website.domain);

                // If the pasted URL belongs to a different known website, show modal to offer switch
                if (matchDomain !== currentDomain) {
                    setPendingSwitchData({
                        website: match.website,
                        path: match.path,
                        originalUrl: pastedText
                    });
                    setIsSwitchModalOpen(true);
                    return;
                }
            }

            // If we are here, either no match, same domain, or user cancelled switch.
            // Proceed with normal "single value" logic - essentially just setting it as a path?
            // But we prevented default. So we need to insert it.
            // Actually, if we use the existing logic for single paste, it relies on Combobox's native behavior.
            // We can just manually call the logic that extracts path and calls onUrlPathsChange

            try {
                const url = new URL(pastedText);
                const path = decodeURIComponent(url.pathname);
                // Add if not exists
                if (!uniqueUrlPaths.includes(path)) {
                    // Check if we should strict match domain here? User might have said no to switch.
                    // If user said no to switch, maybe they want to track that external URL on THIS site?
                    // Unlikely, but possible. Let's assume they want to add it as path.
                    // But we should verify if it belongs to current domain if we enforce that.
                    // The parseMultipleUrls has strict check for bulk, maybe we should apply it here too?
                    // For now, let's just add the path.
                    onUrlPathsChange([...uniqueUrlPaths, path]);
                    setComboInputValue("");
                }
            } catch (e) {
                // Not a valid URL, treat as text
                const path = pastedText;
                if (!uniqueUrlPaths.includes(path)) {
                    onUrlPathsChange([...uniqueUrlPaths, path]);
                    setComboInputValue("");
                }
            }
            return;
        }

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
                const uniqueNewPaths = new Set([...uniqueUrlPaths, ...paths]);
                onUrlPathsChange(Array.from(uniqueNewPaths));
                setComboInputValue("");
            }
        }
        // Single value (non-url) paste is handled normally by the combobox
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
        const uniqueNewPaths = new Set([...uniqueUrlPaths, ...paths]);
        onUrlPathsChange(Array.from(uniqueNewPaths));

        // Cleanup
        setUrlPasteInput("");
        setUrlPasteError("");
        setIsUrlModalOpen(false);
    };

    const handleToggleSelected = (option: string, isSelected: boolean) => {
        const rawOption = parseFormattedPath(option);
        // Mark that we're in a selection process
        isSelectingRef.current = true;

        if (isSelected) {
            let normalized = normalizeUrlToPath(rawOption);
            // If missing leading slash, ask user
            if (normalized && !normalized.startsWith('/')) {
                setPendingMissingSlash(normalized);
                setIsMissingSlashModalOpen(true);
                setComboInputValue("");
                setTimeout(() => { isSelectingRef.current = false; }, 100);
                return;
            }
            if (normalized && !uniqueUrlPaths.includes(normalized)) {
                const newPaths = [...uniqueUrlPaths, normalized];
                onUrlPathsChange(newPaths);
            }
        } else {
            // When removing, match against both the raw option and the normalized version
            let normalized = normalizeUrlToPath(rawOption);
            if (normalized && !normalized.startsWith('/')) {
                normalized = '/' + normalized;
            }
            const newPaths = uniqueUrlPaths.filter(p => p !== rawOption && p !== normalized);
            onUrlPathsChange(newPaths);
        }

        // Clear input after handling toggle
        setComboInputValue("");

        // Reset selection flag after a short delay
        setTimeout(() => {
            isSelectingRef.current = false;
        }, 100);
    };

    // Handle blur - auto-add any typed value (with modal for missing slash)
    const handleBlur = () => {
        setTimeout(async () => {
            const trimmedValue = comboInputValue.trim();
            if (trimmedValue && !isSelectingRef.current) {
                // Check for cross-site URL
                if (trimmedValue.match(/^https?:\/\//)) {
                    const match = await findMatchingWebsite(trimmedValue);
                    const currentDomain = selectedWebsiteDomain ? normalizeDomain(selectedWebsiteDomain) : null;
                    if (match && currentDomain) {
                        const matchDomain = normalizeDomain(match.website.domain);
                        if (matchDomain !== currentDomain) {
                            setPendingSwitchData({
                                website: match.website,
                                path: match.path,
                                originalUrl: trimmedValue
                            });
                            setIsSwitchModalOpen(true);
                            return;
                        }
                    }
                }
                let normalized = normalizeUrlToPath(trimmedValue);
                if (normalized && !normalized.startsWith('/')) {
                    setPendingMissingSlash(normalized);
                    setIsMissingSlashModalOpen(true);
                    setComboInputValue("");
                    return;
                }
                if (normalized && !uniqueUrlPaths.includes(normalized)) {
                    onUrlPathsChange([...uniqueUrlPaths, normalized]);
                }
                setComboInputValue("");
            }
        }, 150);
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
                    isListOpen={showSuggestions ? undefined : false}
                    toggleListButton={showSuggestions}
                    options={showSuggestions ? uniqueUrlPaths.map(p => ({ label: formatPathLabel(p), value: formatPathLabel(p) })) : []}
                    selectedOptions={uniqueUrlPaths.map(formatPathLabel)}
                    onToggleSelected={handleToggleSelected}
                    value={comboInputValue}
                    onChange={(val) => setComboInputValue(val)}
                />
            </div>



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

            {/* Website switch confirmation modal */}
                        {/* Missing leading slash modal */}
                        <Modal
                            open={isMissingSlashModalOpen}
                            onClose={() => {
                                setIsMissingSlashModalOpen(false);
                                setPendingMissingSlash(null);
                            }}
                            header={{ heading: pendingMissingSlash ? `Mente du /${pendingMissingSlash}?` : '', closeButton: true }}
                        >
                            <Modal.Body>
                                {pendingMissingSlash && (
                                    <div className="space-y-4">
                                        <p>
                                            Du skrev <strong>{pendingMissingSlash}</strong>, men URL-er starter vanligvis med <strong>/</strong>.
                                        </p>
                                        <p>Vil du at vi skal legge til dette automatisk?</p>
                                    </div>
                                )}
                            </Modal.Body>
                            <Modal.Footer>
                                <Button
                                    variant="secondary"
                                    onClick={() => {
                                        setIsMissingSlashModalOpen(false);
                                        setPendingMissingSlash(null);
                                    }}
                                >
                                    Avbryt
                                </Button>
                                <Button
                                    onClick={() => {
                                        if (pendingMissingSlash && !uniqueUrlPaths.includes('/' + pendingMissingSlash)) {
                                            onUrlPathsChange([...uniqueUrlPaths, '/' + pendingMissingSlash]);
                                        }
                                        setIsMissingSlashModalOpen(false);
                                        setPendingMissingSlash(null);
                                    }}
                                >
                                    Ja, legg til /
                                </Button>
                            </Modal.Footer>
                        </Modal>
            <Modal
                ref={switchModalRef}
                open={isSwitchModalOpen}
                onClose={() => {
                    setIsSwitchModalOpen(false);
                    setPendingSwitchData(null);
                    setComboInputValue("");
                }}
                header={{ heading: "Bytte nettsted?", closeButton: true }}
            >
                <Modal.Body>
                    {pendingSwitchData && (
                        <div className="space-y-4">
                            <p>
                                Denne siden hører til <strong>{pendingSwitchData.website.name}</strong>, ikke nettstedet du ser på nå.
                            </p>
                            <div className="bg-[var(--ax-bg-neutral-soft)] p-3 rounded-md text-sm break-all">
                                {pendingSwitchData.originalUrl}
                            </div>
                            <p>Vil du se statistikk for <strong>{pendingSwitchData.website.name}</strong> i stedet?</p>
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        onClick={() => {
                            if (pendingSwitchData) {
                                handleSiteSwitch(pendingSwitchData.website, pendingSwitchData.path);
                            }
                            setIsSwitchModalOpen(false);
                            setPendingSwitchData(null);
                            setComboInputValue("");
                        }}
                    >
                        Ja, bytt
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={() => {
                            // Add the path to current website without switching
                            if (pendingSwitchData?.path) {
                                let path = pendingSwitchData.path;
                                if (path && !path.startsWith('/')) {
                                    path = '/' + path;
                                }
                                if (path && !uniqueUrlPaths.includes(path)) {
                                    onUrlPathsChange([...uniqueUrlPaths, path]);
                                }
                            }
                            setIsSwitchModalOpen(false);
                            setPendingSwitchData(null);
                            setComboInputValue("");
                        }}
                    >
                        Nei, ikke bytt
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default UrlPathFilter;
