import React, { useMemo, useState, useRef, useLayoutEffect } from 'react';

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
}

interface StepData {
    step: number;
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

const UmamiJourneyView: React.FC<UmamiJourneyViewProps> = ({ nodes, links, isFullscreen = false }) => {
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [paths, setPaths] = useState<ConnectionPath[]>([]);

    const contentRef = useRef<HTMLDivElement>(null);
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

            return {
                step: step + 1,
                items,
                totalValue: stepTotal
            };
        });

        return { stepsData, nodeValues, adjacency, reverseAdjacency };
    }, [nodes, links]);

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
        // Reset visited for upstream but keep connected set
        // Actually we want to highlight everything connected, so we can just continue adding to connected set.
        // But we need to be careful not to re-traverse downstream from upstream nodes if we only want the flow *through* the selected node.
        // Usually "flow through node" means:
        // - All ancestors of selected node
        // - All descendants of selected node
        // It does NOT typically mean "descendants of ancestors" (siblings).

        currentQueue = [selectedNodeIndex];
        // We use a separate visited set for upstream to avoid loops if graph has cycles (though Sankey is usually DAG, but let's be safe)
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

            const x1 = sourceRect.right - contentRect.left;
            const y1 = sourceRect.top + sourceRect.height / 2 - contentRect.top;
            const x2 = targetRect.left - contentRect.left;
            const y2 = targetRect.top + targetRect.height / 2 - contentRect.top;

            const dist = Math.abs(x2 - x1);
            const cp1x = x1 + dist * 0.5;
            const cp1y = y1;
            const cp2x = x2 - dist * 0.5;
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

    }, [selectedNodeId, nodes, links, stepsData, connectedNodeIds, isFullscreen]); // Added isFullscreen dependency

    // Handle resize
    useLayoutEffect(() => {
        const handleResize = () => setSelectedNodeId(prev => prev);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    if (!stepsData.length) {
        return <div className="p-4 text-gray-500">Ingen data å vise.</div>;
    }

    return (
        <div className="bg-white rounded-lg border border-gray-200 w-full overflow-x-auto p-6">
            {/* Inner container */}
            <div className={`relative min-w-max ${isFullscreen ? 'h-full overflow-auto' : ''}`} ref={contentRef}>

                {/* SVG Overlay */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                    {paths.map((path, i) => (
                        <path
                            key={i}
                            d={path.d}
                            stroke="#0067c5"
                            strokeWidth="2"
                            fill="none"
                            opacity={path.opacity}
                        />
                    ))}
                </svg>

                <div className="flex gap-8 relative z-20"> {/* Reduced gap from 12 to 8 */}
                    {stepsData.map((stepData) => (
                        <div key={stepData.step} className="flex-shrink-0 w-60 flex flex-col gap-4"> {/* Reduced width from 72 (18rem) to 60 (15rem) */}
                            {/* Step Header */}
                            <div className="flex flex-col items-center mb-2">
                                <div className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold text-sm mb-2 shadow-sm">
                                    {stepData.step}
                                </div>
                                <div className="text-sm font-semibold text-gray-900">
                                    {stepData.totalValue.toLocaleString()} besøkende
                                </div>
                            </div>

                            {/* Step Items */}
                            <div className="flex flex-col gap-2"> {/* Reduced gap from 3 to 2 */}
                                {stepData.items.map((item) => {
                                    const isSelected = selectedNodeId === item.nodeId;
                                    const isConnected = connectedNodeIds.has(item.nodeId);
                                    const isDimmed = selectedNodeId !== null && !isConnected;

                                    return (
                                        <div
                                            key={item.nodeId}
                                            ref={(el) => {
                                                if (el) nodeRefs.current.set(item.nodeId, el);
                                                else nodeRefs.current.delete(item.nodeId);
                                            }}
                                            onClick={() => setSelectedNodeId(isSelected ? null : item.nodeId)}
                                            className={`
                                                relative overflow-hidden rounded-md border transition-all duration-200 cursor-pointer
                                                ${isSelected ? 'ring-2 ring-blue-600 border-blue-600 shadow-md' : 'border-transparent hover:border-gray-400 shadow-sm'}
                                                ${isDimmed ? 'opacity-30 grayscale' : 'opacity-100'}
                                                text-white
                                            `}
                                            style={{
                                                minHeight: '40px', // Reduced height slightly
                                                backgroundColor: 'rgb(19, 17, 54)' // Custom theme color
                                            }}
                                        >
                                            {/* Progress Bar Background */}
                                            <div
                                                className="absolute left-0 top-0 bottom-0 bg-white transition-all duration-500 ease-out"
                                                style={{
                                                    width: `${item.percentage}%`,
                                                    opacity: 0.15
                                                }}
                                            />

                                            {/* Content */}
                                            <div className="relative z-10 p-2.5 flex justify-between items-center gap-2 h-full">
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <span className="text-gray-400 flex-shrink-0 text-xs">
                                                        📄
                                                    </span>
                                                    <span className="font-medium text-xs truncate" title={item.name}>
                                                        {item.name}
                                                    </span>
                                                </div>
                                                <span className="text-xs font-mono font-bold whitespace-nowrap">
                                                    {item.value.toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default UmamiJourneyView;
