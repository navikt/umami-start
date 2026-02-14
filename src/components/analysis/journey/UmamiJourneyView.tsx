import React, { useMemo, useState, useRef, useLayoutEffect, useEffect } from 'react';
import { Button, Tooltip, Loader } from '@navikt/ds-react';
import { Plus, Check, ExternalLink, ArrowRight } from 'lucide-react';
import AnalysisActionModal from '../AnalysisActionModal';

interface Node {
    nodeId: string;
    name: string;
    color?: string;
}

interface Link {
    source: number;
    target: number;
    value: number;
}

interface UmamiJourneyViewProps {
    nodes: Node[];
    links: Link[];
    isFullscreen?: boolean;
    reverseVisualOrder?: boolean;
    journeyDirection?: string;
    websiteId?: string;
    period?: string;
    domain?: string;
    onLoadMore?: (increment: number) => void;
    isLoadingMore?: boolean;
}

interface StepData {
    step: number;
    displayStep: number;
    items: {
        name: string;
        value: number;
        percentage: number;
        nodeId: string;
    }[];
    totalValue: number;
}



interface ConnectionPath {
    d: string;
    opacity: number;
}

interface FunnelStep {
    nodeId: string;
    path: string;
    step: number;
}

const UmamiJourneyView: React.FC<UmamiJourneyViewProps> = ({ nodes, links, isFullscreen = false, reverseVisualOrder = false, journeyDirection = 'forward', websiteId, period = 'current_month', domain, onLoadMore, isLoadingMore }) => {
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
    const [paths, setPaths] = useState<ConnectionPath[]>([]);
    const [funnelSteps, setFunnelSteps] = useState<FunnelStep[]>([]);

    const contentRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    // Process data
    const { stepsData, adjacency, reverseAdjacency } = useMemo(() => {
        if (!nodes || nodes.length === 0) return { stepsData: [], nodeValues: new Map(), adjacency: [], reverseAdjacency: [] };

        const stepsMap = new Map<number, Node[]>();
        nodes.forEach(node => {
            const match = node.nodeId.match(/^(\d+):/);
            if (match) {
                const step = parseInt(match[1]);
                if (!stepsMap.has(step)) stepsMap.set(step, []);
                stepsMap.get(step)?.push(node);
            }
        });

        const nodeValues = new Map<string, number>();
        nodes.forEach(n => nodeValues.set(n.nodeId, 0));

        // Build adjacency lists for recursive traversal
        const adjacency: number[][] = Array(nodes.length).fill(null).map(() => []);
        const reverseAdjacency: number[][] = Array(nodes.length).fill(null).map(() => []);

        links.forEach(link => {
            adjacency[link.source].push(link.target);
            reverseAdjacency[link.target].push(link.source);

            const sourceNode = nodes[link.source];
            const targetNode = nodes[link.target];

            if (sourceNode) {
                const sourceStep = parseInt(sourceNode.nodeId.split(':')[0]);
                if (sourceStep === 0) {
                    nodeValues.set(sourceNode.nodeId, (nodeValues.get(sourceNode.nodeId) || 0) + link.value);
                }
            }
            if (targetNode) {
                nodeValues.set(targetNode.nodeId, (nodeValues.get(targetNode.nodeId) || 0) + link.value);
            }
        });

        const sortedSteps = Array.from(stepsMap.keys()).sort((a, b) => a - b);

        const stepsData: StepData[] = sortedSteps.map(step => {
            const stepNodes = stepsMap.get(step) || [];
            const stepTotal = stepNodes.reduce((sum, node) => sum + (nodeValues.get(node.nodeId) || 0), 0);

            const items = stepNodes.map(node => {
                const val = nodeValues.get(node.nodeId) || 0;
                return {
                    name: node.name,
                    value: val,
                    percentage: stepTotal > 0 ? (val / stepTotal) * 100 : 0,
                    nodeId: node.nodeId
                };
            }).sort((a, b) => b.value - a.value);

            // Calculate display step based on direction
            let displayStep = step;
            if (journeyDirection === 'backward') {
                displayStep = step * -1;
            }

            return {
                step: step,
                displayStep,
                items,
                totalValue: stepTotal
            };
        });

        return { stepsData, nodeValues, adjacency, reverseAdjacency };
    }, [nodes, links, journeyDirection]); // Added journeyDirection dependency

    // Preselect the first node in the first step when new data loads.
    useEffect(() => {
        if (!stepsData.length) {
            setSelectedNodeId(null);
            return;
        }

        setSelectedNodeId((prevSelectedNodeId) => {
            const hasPreviousSelection = prevSelectedNodeId
                ? stepsData.some((step) => step.items.some((item) => item.nodeId === prevSelectedNodeId))
                : false;

            if (hasPreviousSelection) return prevSelectedNodeId;
            return stepsData[0]?.items[0]?.nodeId ?? null;
        });
    }, [stepsData]);

    // Determine connected nodes for highlighting (Recursive)
    const connectedNodeIds = useMemo(() => {
        if (!selectedNodeId) return new Set<string>();

        const connected = new Set<string>();
        const selectedNodeIndex = nodes.findIndex(n => n.nodeId === selectedNodeId);
        if (selectedNodeIndex === -1) return connected;

        const visited = new Set<number>();
        visited.add(selectedNodeIndex);
        connected.add(nodes[selectedNodeIndex].nodeId);

        // Downstream (Forward)
        let currentQueue = [selectedNodeIndex];
        while (currentQueue.length > 0) {
            const nextQueue: number[] = [];
            for (const idx of currentQueue) {
                for (const targetIdx of adjacency[idx]) {
                    if (!visited.has(targetIdx)) {
                        visited.add(targetIdx);
                        connected.add(nodes[targetIdx].nodeId);
                        nextQueue.push(targetIdx);
                    }
                }
            }
            currentQueue = nextQueue;
        }

        // Upstream (Backward)
        currentQueue = [selectedNodeIndex];
        const visitedUpstream = new Set<number>();
        visitedUpstream.add(selectedNodeIndex);

        while (currentQueue.length > 0) {
            const nextQueue: number[] = [];
            for (const idx of currentQueue) {
                for (const sourceIdx of reverseAdjacency[idx]) {
                    if (!visitedUpstream.has(sourceIdx)) {
                        visitedUpstream.add(sourceIdx);
                        connected.add(nodes[sourceIdx].nodeId);
                        nextQueue.push(sourceIdx);
                    }
                }
            }
            currentQueue = nextQueue;
        }

        return connected;
    }, [selectedNodeId, nodes, adjacency, reverseAdjacency]);

    // Calculate SVG paths
    useLayoutEffect(() => {
        if (!selectedNodeId || !contentRef.current) {
            setPaths([]);
            return;
        }

        const newPaths: ConnectionPath[] = [];
        const contentRect = contentRef.current.getBoundingClientRect();

        // Helper to create path between two elements
        const createPath = (sourceId: string, targetId: string) => {
            const sourceEl = nodeRefs.current.get(sourceId);
            const targetEl = nodeRefs.current.get(targetId);

            if (!sourceEl || !targetEl) return null;

            const sourceRect = sourceEl.getBoundingClientRect();
            const targetRect = targetEl.getBoundingClientRect();

            let x1, x2;

            if (reverseVisualOrder) {
                // Source is on the right, Target is on the left
                x1 = sourceRect.left - contentRect.left;
                x2 = targetRect.right - contentRect.left;
            } else {
                // Source is on the left, Target is on the right
                x1 = sourceRect.right - contentRect.left;
                x2 = targetRect.left - contentRect.left;
            }

            const y1 = sourceRect.top + sourceRect.height / 2 - contentRect.top;
            const y2 = targetRect.top + targetRect.height / 2 - contentRect.top;

            const dist = Math.abs(x2 - x1);
            const cp1x = reverseVisualOrder ? x1 - dist * 0.5 : x1 + dist * 0.5;
            const cp1y = y1;
            const cp2x = reverseVisualOrder ? x2 + dist * 0.5 : x2 - dist * 0.5;
            const cp2y = y2;

            return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
        };

        // Draw links ONLY if both source and target are in the connected set
        links.forEach(link => {
            const sourceNode = nodes[link.source];
            const targetNode = nodes[link.target];

            if (sourceNode && targetNode) {
                if (connectedNodeIds.has(sourceNode.nodeId) && connectedNodeIds.has(targetNode.nodeId)) {
                    const d = createPath(sourceNode.nodeId, targetNode.nodeId);
                    if (d) newPaths.push({ d, opacity: 0.8 });
                }
            }
        });

        setPaths(newPaths);

    }, [selectedNodeId, nodes, links, stepsData, connectedNodeIds, isFullscreen, reverseVisualOrder]);

    // Handle resize
    useLayoutEffect(() => {
        const handleResize = () => setSelectedNodeId(prev => prev);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Auto-scroll to right if reversed
    useLayoutEffect(() => {
        if (reverseVisualOrder && containerRef.current) {
            containerRef.current.scrollLeft = containerRef.current.scrollWidth;
        } else if (!reverseVisualOrder && containerRef.current) {
            containerRef.current.scrollLeft = 0;
        }
    }, [reverseVisualOrder]); // Removed stepsData dependency to prevent scroll reset on load more

    const toggleFunnelStep = (e: React.MouseEvent, nodeId: string, path: string, step: number) => {
        e.stopPropagation(); // Prevent selecting the node for path highlighting

        setFunnelSteps(prev => {
            const exists = prev.some(s => s.nodeId === nodeId);
            if (exists) {
                return prev.filter(s => s.nodeId !== nodeId);
            } else {
                return [...prev, { nodeId, path, step }];
            }
        });
    };

    const navigateToFunnel = () => {
        if (funnelSteps.length < 2 || !websiteId) return;

        // Sort by step index based on direction
        const sortedSteps = [...funnelSteps].sort((a, b) => {
            if (journeyDirection === 'backward') {
                return b.step - a.step; // Descending for backward (2 -> 1 -> 0)
            }
            return a.step - b.step; // Ascending for forward (0 -> 1 -> 2)
        });

        const params = new URLSearchParams();
        params.set('websiteId', websiteId);
        params.set('period', 'current_month'); // Default to current month
        params.set('strict', 'true');

        sortedSteps.forEach(s => {
            params.append('step', s.path);
        });

        const url = `/trakt?${params.toString()}`;
        window.open(url, '_blank');
    };

    if (!stepsData.length) {
        return <div className="p-4 text-gray-500">Ingen data å vise.</div>;
    }

    return (
        <>
            <div
                ref={containerRef}
                className={`bg-[var(--ax-bg-default)] w-full p-6 ${isFullscreen ? 'overflow-auto' : 'overflow-x-auto'}`}
            >
                {/* Inner container */}
                <div className={`relative min-w-max ${isFullscreen ? '' : ''}`} ref={contentRef}>

                    {/* SVG Overlay */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                        {paths.map((path, i) => (
                            <path
                                key={i}
                                d={path.d}
                                stroke="var(--journey-line-color, #0067c5)"
                                strokeWidth="2"
                                fill="none"
                                opacity={path.opacity}
                            />
                        ))}
                    </svg>

                    <div className={`flex gap-8 relative z-20 ${reverseVisualOrder ? 'flex-row-reverse' : ''}`}>
                        {stepsData.map((stepData) => (
                            <div key={stepData.step} className="flex-shrink-0 w-60 flex flex-col gap-4">
                                {/* Step Header */}
                                <div className="flex flex-col items-center mb-2">
                                    <div className="w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-sm mb-2 shadow-sm border border-transparent dark:border-[var(--ax-border-neutral-subtle)]" style={{ backgroundColor: 'var(--funnel-box-bg, rgb(19, 17, 54))' }}>
                                        {stepData.displayStep}
                                    </div>
                                    <div className="text-sm font-semibold text-[var(--ax-text-default)]">
                                        {stepData.totalValue.toLocaleString('nb-NO')} besøkende
                                    </div>
                                </div>

                                {/* Step Items */}
                                <div className="flex flex-col gap-2">
                                    {stepData.items.map((item) => {
                                        const isSelected = selectedNodeId === item.nodeId;
                                        const isConnected = connectedNodeIds.has(item.nodeId);
                                        const isDimmed = selectedNodeId !== null && !isConnected;
                                        const isFunnelStep = funnelSteps.some(s => s.nodeId === item.nodeId);

                                        return (
                                            <div
                                                key={item.nodeId}
                                                ref={(el) => {
                                                    if (el) nodeRefs.current.set(item.nodeId, el);
                                                    else nodeRefs.current.delete(item.nodeId);
                                                }}
                                                onClick={() => setSelectedNodeId(isSelected ? null : item.nodeId)}
                                                className={`
                                                relative overflow-hidden rounded-md border transition-all duration-200 cursor-pointer group
                                                ${isSelected ? 'ring-2 ring-blue-600 border-blue-600 shadow-md' : 'border-transparent dark:border-[var(--ax-border-neutral-subtle)] hover:border-gray-400 dark:hover:border-[var(--ax-border-neutral-strong)] shadow-sm'}
                                                ${isFunnelStep ? 'ring-2 ring-green-500 border-green-500' : ''}
                                                ${isDimmed && !isFunnelStep ? 'opacity-30 grayscale' : 'opacity-100'}
                                                text-white
                                            `}
                                                style={{
                                                    minHeight: '40px',
                                                    backgroundColor: 'var(--funnel-box-bg, rgb(19, 17, 54))'
                                                }}
                                            >
                                                {/* Content */}
                                                <div className="relative z-10 p-2.5 flex justify-between items-center gap-2">
                                                    <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0 group/text">
                                                        <span className="text-gray-400 flex-shrink-0 text-xs mt-0.5 self-start">
                                                            📄
                                                        </span>
                                                        <div className="flex-1 min-w-0">
                                                            <Tooltip content={item.name} delay={500}>
                                                                <div className="flex items-start gap-1">
                                                                    <span className="font-medium text-xs leading-tight line-clamp-3 group-hover:line-clamp-none break-words text-left transition-all duration-200" title={item.name}>
                                                                        {item.name}
                                                                    </span>

                                                                    {/* Action Button - Visible on hover, opens modal */}
                                                                    {websiteId && (
                                                                        <button
                                                                            className="flex-shrink-0 p-1 rounded-md hover:bg-[var(--ax-bg-default)]/20 transition-all text-gray-400 opacity-0 group-hover/text:opacity-100"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setSelectedUrl(item.name);
                                                                            }}
                                                                            title="Åpne i analyse"
                                                                        >
                                                                            <ExternalLink size={12} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </Tooltip>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-shrink-0 self-start mt-0.5">
                                                        <span className="text-xs font-mono font-bold whitespace-nowrap">
                                                            {item.value.toLocaleString('nb-NO')}
                                                        </span>

                                                        {/* Funnel Selection Button */}
                                                        <button
                                                            onClick={(e) => toggleFunnelStep(e, item.nodeId, item.name, stepData.step)}
                                                            className={`
                                                            w-6 h-6 rounded-full flex items-center justify-center transition-all
                                                            ${isFunnelStep
                                                                    ? 'bg-green-500 text-white opacity-100'
                                                                    : 'bg-[var(--ax-bg-default)]/30 text-white hover:bg-[var(--ax-bg-default)]/50 opacity-100'
                                                                }
                                                        `}
                                                            title={isFunnelStep ? "Fjern fra trakt" : "Legg til i trakt"}
                                                        >
                                                            {isFunnelStep ? <Check size={14} strokeWidth={3} /> : <Plus size={14} strokeWidth={3} />}
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Percentage Bar - Bottom */}
                                                <div className="absolute bottom-0 left-0 right-0 h-2 bg-[var(--ax-bg-default)]/30">
                                                    <div
                                                        className="h-full bg-orange-400 transition-all duration-500 ease-out"
                                                        style={{ width: `${item.percentage}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}

                        {/* Load More Button */}
                        {onLoadMore && (
                            <div className="flex-shrink-0 w-40 flex flex-col">
                                <button
                                    onClick={() => !isLoadingMore && onLoadMore(2)}
                                    disabled={isLoadingMore}
                                    className={`
                                        group flex flex-col items-center justify-center gap-3
                                        w-full h-[300px] mt-14 rounded-lg border-2 border-dashed border-gray-400
                                        hover:border-blue-600 hover:bg-[var(--ax-bg-accent-soft)] transition-all duration-200
                                        text-[var(--ax-text-subtle)] hover:text-blue-700
                                        ${isLoadingMore ? 'opacity-70 cursor-wait' : 'cursor-pointer'}
                                    `}
                                >
                                    {isLoadingMore ? (
                                        <>
                                            <Loader size="medium" />
                                            <span className="text-sm font-medium">Laster mer...</span>
                                        </>
                                    ) : (
                                        <>
                                            <div className="w-12 h-12 rounded-full bg-[var(--ax-bg-neutral-soft)] group-hover:bg-[var(--ax-bg-accent-soft)] flex items-center justify-center transition-colors shadow-sm border border-[var(--ax-border-neutral-subtle)]">
                                                <ArrowRight size={24} className="group-hover:translate-x-1 transition-transform text-[var(--ax-text-default)] group-hover:text-blue-700" />
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <span className="font-bold text-base">Last inn mer</span>
                                                <span className="text-xs text-gray-500">Vis 2 steg til</span>
                                            </div>
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Floating Funnel Builder Action Bar */}
                {funnelSteps.length > 0 && (
                    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-900 border border-gray-700 text-white px-8 py-5 rounded-full shadow-2xl z-50 flex items-center gap-8 animate-in fade-in slide-in-from-bottom-4">
                        <div className="flex flex-col">
                            <span className="font-bold text-xl">{funnelSteps.length} steg valgt</span>
                            <span className="text-sm text-gray-300">
                                {funnelSteps.length < 2
                                    ? "Du må velge minst to steg for å lage en trakt"
                                    : "Bygg en traktanalyse fra disse stegene"
                                }
                            </span>
                        </div>

                        <div className="flex items-center gap-4">
                            <Button
                                variant="tertiary"
                                size="medium"
                                onClick={() => setFunnelSteps([])}
                                className="text-white hover:bg-[var(--ax-bg-default)]/10 hover:text-white"
                            >
                                Tøm valgte
                            </Button>
                            <Button
                                variant="primary"
                                size="medium"
                                onClick={navigateToFunnel}
                                disabled={funnelSteps.length < 2}
                                icon={<ExternalLink size={20} />}
                            >
                                Opprett traktanalyse
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            <AnalysisActionModal
                open={!!selectedUrl}
                onClose={() => setSelectedUrl(null)}
                urlPath={selectedUrl}
                websiteId={websiteId}
                period={period}
                domain={domain}
            />
        </>
    );
};

export default UmamiJourneyView;
