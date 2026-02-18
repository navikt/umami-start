import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Alert,
  Button,
  Loader,
  ReadMore,
  Select,
  Tabs,
  TextField,
} from "@navikt/ds-react";
import type {
  IChartProps} from "@fluentui/react-charting";
import {
  ResponsiveContainer,
  SankeyChart,
} from "@fluentui/react-charting";
import { Download, Minimize2, Share2, Check, ExternalLink } from "lucide-react";
import { utils as XLSXUtils, write as XLSXWrite } from "xlsx";
import { parseISO } from "date-fns";
import ChartLayout from "../../components/analysis/ChartLayout.tsx";
import WebsitePicker from "../../components/analysis/WebsitePicker.tsx";
import PeriodPicker from "../../components/analysis/PeriodPicker.tsx";
import UmamiJourneyView from "../../components/analysis/journey/UmamiJourneyView.tsx";
import AnalysisActionModal from "../../components/analysis/AnalysisActionModal.tsx";
import type { Website } from "../../types/chart.ts";
import {
  getDateRangeFromPeriod,
  normalizeUrlToPath,
  savePeriodPreference,
  getStoredPeriod,
} from "../../lib/utils.ts";

type JourneyNode = {
  nodeId: string;
  name: string;
};

type JourneyLink = {
  source: number;
  target: number;
  value: number;
  color?: string;
};

type JourneyData = {
  nodes: JourneyNode[];
  links: JourneyLink[];
};

type QueryStats = {
  totalBytesProcessedGB?: number;
  estimatedCostUSD?: number;
};

const UserJourney = () => {
  const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
  const [searchParams] = useSearchParams();

  // Initialize state from URL params
  const [startUrl, setStartUrl] = useState<string>(
    () => searchParams.get("urlPath") || searchParams.get("startUrl") || ""
  );
  const [period, setPeriodState] = useState<string>(
    () => getStoredPeriod(searchParams.get("period"))
  );

  // Wrap setPeriod to also save to localStorage
  const setPeriod = (newPeriod: string) => {
    setPeriodState(newPeriod);
    savePeriodPreference(newPeriod);
  };

  // Support custom dates from URL
  const fromDateFromUrl = searchParams.get("from");
  const toDateFromUrl = searchParams.get("to");
  const initialCustomStartDate = fromDateFromUrl
    ? parseISO(fromDateFromUrl)
    : undefined;
  const initialCustomEndDate = toDateFromUrl ? parseISO(toDateFromUrl) : undefined;

  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(
    initialCustomStartDate
  );
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(
    initialCustomEndDate
  );
  const [steps, setSteps] = useState<number>(() => {
    const stepsParam = searchParams.get("steps");
    return stepsParam ? parseInt(stepsParam) : 7;
  });
  const [limit, setLimit] = useState<number>(() => {
    const limitParam = searchParams.get("limit");
    return limitParam ? parseInt(limitParam) : 15;
  });
  const [limitInput, setLimitInput] = useState<string>(() => {
    const limitParam = searchParams.get("limit");
    return limitParam || "15";
  });
  const [data, setData] = useState<IChartProps | null>(null);
  const [rawData, setRawData] = useState<JourneyData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("steps");
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [journeyDirection, setJourneyDirection] = useState<string>(
    () => searchParams.get("direction") || "forward"
  );
  const [queryStats, setQueryStats] = useState<QueryStats | null>(null);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [hasAutoSubmitted, setHasAutoSubmitted] = useState<boolean>(false);
  const [reverseVisualOrder, setReverseVisualOrder] = useState<boolean>(false); // Default off
  const [selectedTableUrl, setSelectedTableUrl] = useState<string | null>(null);
  const [lastAppliedFilterKey, setLastAppliedFilterKey] = useState<string | null>(
    null
  );
  const sankeyContainerRef = useRef<HTMLDivElement | null>(null);

  const buildAppliedFilterKey = useCallback(
    (normalizedStartUrl: string, stepsToFetch: number) =>
      JSON.stringify({
        websiteId: selectedWebsite?.id ?? null,
        startUrl: normalizedStartUrl,
        period,
        customStartDate: customStartDate?.toISOString() ?? null,
        customEndDate: customEndDate?.toISOString() ?? null,
        steps: stepsToFetch,
        limit,
        direction: journeyDirection,
      }),
    [selectedWebsite?.id, period, customStartDate, customEndDate, limit, journeyDirection]
  );

  const hasUnappliedFilterChanges = lastAppliedFilterKey
    ? buildAppliedFilterKey(normalizeUrlToPath(startUrl) || "", steps) !== lastAppliedFilterKey
    : true;

  const fetchData = useCallback(
    async (preserveData = false, customSteps?: number) => {
      if (!selectedWebsite) return;

      const normalizedStartUrl = normalizeUrlToPath(startUrl);
      if (!normalizedStartUrl) return;

      if (preserveData) {
        setIsUpdating(true);
      } else {
        setLoading(true);
        setData(null);
        setRawData(null);
      }

      setError(null);

      const dateRange = getDateRangeFromPeriod(period, customStartDate, customEndDate);
      if (!dateRange) {
        setError("Vennligst velg en gyldig periode.");
        setLoading(false);
        setIsUpdating(false);
        return;
      }
      const { startDate, endDate } = dateRange;

      const stepsToFetch = customSteps ?? steps;
      const appliedFilterKey = buildAppliedFilterKey(normalizedStartUrl, stepsToFetch);

      try {
        const response = await fetch("/api/bigquery/journeys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            websiteId: selectedWebsite.id,
            startUrl: normalizedStartUrl,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            steps: stepsToFetch,
            limit,
            direction: journeyDirection,
          }),
        });

        if (!response.ok) {
          throw new Error(
            `Failed to fetch user journeys: ${response.status} ${response.statusText}`
          );
        }

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const text = await response.text();
          throw new Error(
            `Server returned non-JSON response: ${text.substring(0, 100)}`
          );
        }

        const result: {
          nodes?: JourneyNode[];
          links?: JourneyLink[];
          queryStats?: QueryStats;
        } = await response.json();

        if (result.queryStats) {
          setQueryStats(result.queryStats);
        }

        const nodes: JourneyNode[] = Array.isArray(result.nodes) ? result.nodes : [];
        const links: JourneyLink[] = Array.isArray(result.links) ? result.links : [];

        const styledLinks = links.map((link) => ({
          ...link,
          color: link.color ?? "#666666",
        }));

        setRawData({ nodes, links: styledLinks });
        setData({
          chartTitle: "Brukerreiser",
          SankeyChartData: { nodes, links: styledLinks },
        } as IChartProps);

        setReverseVisualOrder(journeyDirection === "backward");

        const newParams = new URLSearchParams(window.location.search);
        newParams.set("period", period);
        newParams.set("steps", stepsToFetch.toString());
        newParams.set("limit", limit.toString());
        newParams.set("direction", journeyDirection);
        newParams.set("urlPath", normalizedStartUrl);
        newParams.delete("startUrl");

        window.history.replaceState(
          {},
          "",
          `${window.location.pathname}?${newParams.toString()}`
        );
        setLastAppliedFilterKey(appliedFilterKey);
      } catch {
        setError("Kunne ikke laste brukerreiser. Prøv igjen senere.");
      } finally {
        setLoading(false);
        setIsUpdating(false);
      }
    },
    [
      selectedWebsite,
      startUrl,
      period,
      customStartDate,
      customEndDate,
      steps,
      limit,
      journeyDirection,
      buildAppliedFilterKey,
    ]
  );

  // Auto-submit when URL parameters are present (for shared links)
  useEffect(() => {
    // Only auto-submit if there are config params beyond just websiteId
    const hasConfigParams =
      searchParams.has("period") ||
      searchParams.has("urlPath") ||
      searchParams.has("startUrl") ||
      searchParams.has("steps") ||
      searchParams.has("limit") ||
      searchParams.has("direction");
    if (selectedWebsite && hasConfigParams && !hasAutoSubmitted && !loading) {
      setHasAutoSubmitted(true);
      fetchData();
    }
  }, [selectedWebsite, searchParams, hasAutoSubmitted, loading, fetchData]);

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  const downloadCSV = () => {
    if (!rawData || !rawData.links || rawData.links.length === 0) return;

    const headers = ["Steg", "Til side", "Fra side", "Antall brukere"];
    const csvRows = [
      headers.join(","),
      ...rawData.links.map((link: JourneyLink) => {
        const sourceNode = rawData.nodes.find(
          (n) => rawData.nodes.indexOf(n) === link.source
        );
        const targetNode = rawData.nodes.find(
          (n) => rawData.nodes.indexOf(n) === link.target
        );
        const stepMatch = sourceNode?.nodeId?.match(/^(\d+):/);
        let step: number | string = "-";
        if (stepMatch) {
          const rawStep = parseInt(stepMatch[1]);
          step = journeyDirection === "backward" ? rawStep * -1 : rawStep;
        }

        const escapeCSV = (val: unknown) => {
          const str = val !== null && val !== undefined ? String(val) : "";
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return '"' + str.replace(/"/g, '""') + '"';
          }
          return str;
        };

        return [
          step,
          escapeCSV(targetNode?.name || "-"),
          escapeCSV(sourceNode?.name || "-"),
          link.value,
        ].join(",");
      }),
    ];

    const csvContent = csvRows.join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `brukerreiser_${selectedWebsite?.name || "data"}_${new Date()
        .toISOString()
        .slice(0, 10)}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadExcel = () => {
    if (!rawData || !rawData.links || rawData.links.length === 0) return;

    const worksheetData = [
      ["Steg", "Til side", "Fra side", "Antall brukere"],
      ...rawData.links.map((link: JourneyLink) => {
        const sourceNode = rawData.nodes.find(
          (n) => rawData.nodes.indexOf(n) === link.source
        );
        const targetNode = rawData.nodes.find(
          (n) => rawData.nodes.indexOf(n) === link.target
        );
        const stepMatch = sourceNode?.nodeId?.match(/^(\d+):/);
        let step: number | string = "-";
        if (stepMatch) {
          const rawStep = parseInt(stepMatch[1]);
          step = journeyDirection === "backward" ? rawStep * -1 : rawStep;
        }

        return [
          step,
          targetNode?.name || "-",
          sourceNode?.name || "-",
          link.value,
        ];
      }),
    ];

    const worksheet = XLSXUtils.aoa_to_sheet(worksheetData);
    const workbook = XLSXUtils.book_new();
    XLSXUtils.book_append_sheet(workbook, worksheet, "Brukerreiser");

    const wbout = XLSXWrite(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `brukerreiser_${selectedWebsite?.name || "data"}_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };


  const handleLoadMore = (increment: number) => {
    const newSteps = steps + increment;
    setSteps(newSteps);
    fetchData(true, newSteps);
  };

  return (
    <ChartLayout
      title="Navigasjonsflyt"
      description="Se hvilke veier folk tar på nettsiden."
      currentPage="brukerreiser"
      websiteDomain={selectedWebsite?.domain}
      websiteName={selectedWebsite?.name}
      sidebarContent={
        <WebsitePicker
          selectedWebsite={selectedWebsite}
          onWebsiteChange={setSelectedWebsite}
        />
      }
      filters={
        <>
          <div className="w-full sm:w-[300px]">
            <TextField
              size="small"
              label="URL"
              value={startUrl}
              onChange={(e) => setStartUrl(e.target.value)}
              onBlur={(e) => setStartUrl(normalizeUrlToPath(e.target.value))}
            />
          </div>

          <PeriodPicker
            period={period}
            onPeriodChange={setPeriod}
            startDate={customStartDate}
            onStartDateChange={setCustomStartDate}
            endDate={customEndDate}
            onEndDateChange={setCustomEndDate}
          />

          <div className="w-full sm:w-auto min-w-[150px]">
            <Select
              label="Reiseretning"
              size="small"
              value={journeyDirection}
              onChange={(e) => setJourneyDirection(e.target.value)}
            >
              <option value="forward">Fremover</option>
              <option value="backward">Bakover</option>
            </Select>
          </div>

          <div className="w-full sm:w-auto min-w-[100px]">
            <Select
              size="small"
              label="Antall steg"
              value={steps}
              onChange={(e) => setSteps(Number(e.target.value))}
            >
              <option value={1}>1 steg</option>
              <option value={2}>2 steg</option>
              <option value={3}>3 steg</option>
              <option value={4}>4 steg</option>
              <option value={5}>5 steg</option>
              <option value={6}>6 steg</option>
              <option value={7}>7 steg</option>
              <option value={8}>8 steg</option>
              <option value={9}>9 steg</option>
              <option value={10}>10 steg</option>
              <option value={11}>11 steg</option>
              <option value={12}>12 steg</option>
              <option value={13}>13 steg</option>
              <option value={14}>14 steg</option>
              <option value={15}>15 steg</option>
            </Select>
          </div>

          <div className="w-full sm:w-[100px]">
            <TextField
              size="small"
              label="Maks sider"
              type="number"
              value={limitInput}
              onChange={(e) => setLimitInput(e.target.value)}
              onBlur={() => {
                const val = parseInt(limitInput);
                if (!isNaN(val) && val > 0) {
                  setLimit(val);
                } else {
                  setLimitInput(limit.toString());
                }
              }}
            />
          </div>

          <div className="w-full sm:w-auto self-end pb-[2px]">
            <Button
              onClick={() => fetchData()}
              disabled={!selectedWebsite || loading || !hasUnappliedFilterChanges}
              loading={loading}
              size="small"
            >
              Vis
            </Button>
          </div>
        </>
      }
    >
      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}

      {!startUrl && !loading && !data && (
        <Alert variant="info" className="mb-4">
          Skriv inn en URL-sti for å se navigasjonsflyt.
        </Alert>
      )}

      {loading && (
        <div className="flex justify-center items-center h-full">
          <Loader size="xlarge" title="Laster brukerreiser..." />
        </div>
      )}

      {!loading && data && data.SankeyChartData?.nodes?.length && data.SankeyChartData?.nodes?.length > 0 && (
        <>
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="steps" label="Stegvisning" />
              <Tabs.Tab value="sankey" label="Flytdiagram" />
              <Tabs.Tab value="table" label="Tabell" />
            </Tabs.List>

            <Tabs.Panel value="sankey" className="pt-2">
              <div
                className={`${
                  isFullscreen
                    ? "fixed inset-0 z-50 bg-[var(--ax-bg-default)] p-8 overflow-auto"
                    : ""
                }`}
              >
                {isFullscreen && (
                  <div className="mb-4 flex justify-end">
                    <Button
                      size="small"
                      variant="tertiary"
                      onClick={() => setIsFullscreen(false)}
                      icon={<Minimize2 size={20} />}
                    >
                      Lukk fullskjerm
                    </Button>
                  </div>
                )}

                <div className="overflow-x-auto w-full" ref={sankeyContainerRef}>
                  <div
                    style={{
                      height: isFullscreen ? "calc(100vh - 120px)" : "700px",
                      minWidth: `${Math.max(1000, steps * 350)}px`,
                    }}
                  >
                    <ResponsiveContainer>
                      <SankeyChart data={data} />
                    </ResponsiveContainer>
                  </div>
                </div>
                {queryStats && (
                  <div className="text-sm text-[var(--ax-text-subtle)] text-right mt-4">
                    Data prosessert: {queryStats.totalBytesProcessedGB} GB
                  </div>
                )}
              </div>
            </Tabs.Panel>

            <Tabs.Panel value="steps" className="pt-4">
              <div
                className={`${
                  isFullscreen
                    ? "fixed inset-0 z-50 bg-[var(--ax-bg-default)] p-8 overflow-auto"
                    : ""
                }`}
              >
                {!isFullscreen && (
                  <ReadMore
                    header="Slik bruker du denne analysen"
                    defaultOpen={true}
                    size="large"
                    className="mb-6"
                  >
                    <ul className="list-disc pl-5 space-y-1">
                      <li>
                        Klikk på et steg-kortene for å utheve flyten via bestemte
                        sider
                      </li>
                      <li>Bruk pluss-ikonet (+) for å legge til steg i en traktanalyse.</li>
                      <li>
                        Juster reiseretningen, for å se brukerreisen i motsatt
                        retning
                      </li>
                    </ul>
                  </ReadMore>
                )}
                {isFullscreen && (
                  <div className="mb-4 flex justify-end">
                    <Button
                      size="small"
                      variant="tertiary"
                      onClick={() => setIsFullscreen(false)}
                      icon={<Minimize2 size={20} />}
                    >
                      Lukk fullskjerm
                    </Button>
                  </div>
                )}
                {/*
                            {!isFullscreen && (
                                <div className="mb-2 flex justify-end">
                                    <Button
                                        size="small"
                                        variant="tertiary"
                                        onClick={() => setIsFullscreen(true)}
                                        icon={<Maximize2 size={20} />}
                                    >
                                        Fullskjerm
                                    </Button>
                                </div>
                            )}
                            */}

                <UmamiJourneyView
                  nodes={rawData?.nodes || []}
                  links={rawData?.links || []}
                  isFullscreen={isFullscreen}
                  reverseVisualOrder={reverseVisualOrder}
                  journeyDirection={journeyDirection}
                  websiteId={selectedWebsite?.id}
                  period={period}
                  domain={selectedWebsite?.domain}
                  onLoadMore={handleLoadMore}
                  isLoadingMore={isUpdating}
                />
                {queryStats && (
                  <div className="text-sm text-[var(--ax-text-subtle)] text-right mt-4">
                    Data prosessert: {queryStats.totalBytesProcessedGB} GB
                  </div>
                )}
              </div>
            </Tabs.Panel>

            <Tabs.Panel value="table" className="pt-4">
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
                  <table className="min-w-full divide-y divide-[var(--ax-border-neutral-subtle)]">
                    <thead className="bg-[var(--ax-bg-neutral-soft)] sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-[var(--ax-text-default)] uppercase">
                          Steg
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-[var(--ax-text-default)] uppercase">
                          Til side
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-[var(--ax-text-default)] uppercase">
                          Fra side
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-[var(--ax-text-default)] uppercase">
                          Antall brukere
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-[var(--ax-bg-default)] divide-y divide-[var(--ax-border-neutral-subtle)]">
                      {rawData &&
                        rawData.links.map((link: JourneyLink, idx: number) => {
                          const sourceNode = rawData.nodes.find(
                            (n) => rawData.nodes.indexOf(n) === link.source
                          );
                          const targetNode = rawData.nodes.find(
                            (n) => rawData.nodes.indexOf(n) === link.target
                          );

                          const stepMatch = sourceNode?.nodeId?.match(/^(\d+):/);
                          let step: number | string = "-";
                          if (stepMatch) {
                            const rawStep = parseInt(stepMatch[1]);
                            step = journeyDirection === "backward" ? rawStep * -1 : rawStep;
                          }

                          return (
                            <tr key={idx} className="hover:bg-[var(--ax-bg-neutral-soft)]">
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-[var(--ax-text-default)]">
                                {step}
                              </td>
                              <td className="px-4 py-2 text-sm">
                                {targetNode?.name && selectedWebsite ? (
                                  <span
                                    className="text-blue-600 hover:underline cursor-pointer flex items-center gap-1"
                                    onClick={() => {
                                      if (typeof targetNode.name === "string") setSelectedTableUrl(targetNode.name);
                                    }}
                                  >
                                    {targetNode.name}{" "}
                                    <ExternalLink className="h-3 w-3" />
                                  </span>
                                ) : (
                                  <span className="text-[var(--ax-text-default)]">
                                    {targetNode?.name || "-"}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2 text-sm">
                                {sourceNode?.name && selectedWebsite ? (
                                  <span
                                    className="text-blue-600 hover:underline cursor-pointer flex items-center gap-1"
                                    onClick={() => {
                                      if (typeof sourceNode.name === "string") setSelectedTableUrl(sourceNode.name);
                                    }}
                                  >
                                    {sourceNode.name}{" "}
                                    <ExternalLink className="h-3 w-3" />
                                  </span>
                                ) : (
                                  <span className="text-[var(--ax-text-default)]">
                                    {sourceNode?.name || "-"}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-[var(--ax-text-default)]">
                                {link.value.toLocaleString("nb-NO")}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-2 bg-[var(--ax-bg-neutral-soft)] text-sm text-[var(--ax-text-subtle)] border-t flex justify-between items-center">
                  <span>
                    {rawData &&
                      `${rawData.links.length} forbindelser mellom ${rawData.nodes.length} sider`}
                  </span>
                  {queryStats && (
                    <span>Data prosessert: {queryStats.totalBytesProcessedGB} GB</span>
                  )}
                </div>
                <div className="flex gap-2 p-3 bg-[var(--ax-bg-neutral-soft)] border-b">
                  <Button
                    size="small"
                    variant="secondary"
                    onClick={downloadCSV}
                    icon={<Download size={16} />}
                  >
                    Last ned CSV
                  </Button>
                  <Button
                    size="small"
                    variant="secondary"
                    onClick={downloadExcel}
                    icon={<Download size={16} />}
                  >
                    Last ned Excel
                  </Button>
                </div>
              </div>

              <AnalysisActionModal
                open={!!selectedTableUrl}
                onClose={() => setSelectedTableUrl(null)}
                urlPath={selectedTableUrl}
                websiteId={selectedWebsite?.id}
                period={period}
                domain={selectedWebsite?.domain}
              />
            </Tabs.Panel>
          </Tabs>
          <div className="flex justify-end mt-8">
            <Button
              size="small"
              variant="secondary"
              icon={copySuccess ? <Check size={16} /> : <Share2 size={16} />}
              onClick={copyShareLink}
            >
              {copySuccess ? "Kopiert!" : "Del analyse"}
            </Button>
          </div>
        </>
      )}

      {!loading && data && (data.SankeyChartData?.nodes?.length ?? 0) === 0 && (
        <div className="flex justify-center items-center h-full text-gray-500">
          Ingen data funnet for valgt periode og start-URL.
        </div>
      )}
    </ChartLayout>
  );
};

export default UserJourney;
