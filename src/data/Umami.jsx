import { useEffect, useState, useMemo } from "react";
import {
  GuidePanel,
  Button,
  Alert,
  Radio,
  RadioGroup,
  TextField,
  List,
  Link,
} from "@navikt/ds-react";
import { Link as RouterLink } from "react-router-dom";
import { PlusIcon, TrashIcon } from "@navikt/aksel-icons";
import SiteScores from "./SiteScores";
import Grafbygger from "./Grafbygger";
import teamsData from "../../../data/teamsData.json";
import { getBaseUrl, getCredentialsMode } from "../../../utils/environment";

function Umami(props) {
  let query = props.query;
  const [dashboardUrl, setDashboardUrl] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState("exact"); // "exact", "startsWith", or "multiple"
  const [additionalUrls, setAdditionalUrls] = useState([]); // Array to store additional URLs
  const [newUrlInput, setNewUrlInput] = useState(""); // Input for adding new URLs
  const [inputError, setInputError] = useState(""); // Error message for URL input
  const [urlInput, setUrlInput] = useState(""); // New state for URL input when no query is provided
  const [internalQuery, setInternalQuery] = useState(""); // Internal query state
  const [websiteData, setWebsiteData] = useState(null); // Store website data
  const [urlInfo, setUrlInfo] = useState(null); // Store URL info
  const [showUrlSuggestion, setShowUrlSuggestion] = useState(false); // State to show URL paste suggestion
  const [dashboardMode, setDashboardMode] = useState("standard"); // "standard" or "graf"
  const isInWebstatistikkMode = props.isWebstatistikkMode || false; // Flag to determine if we're in webstatistikk mode

  const baseUrl = getBaseUrl({
    localUrl: "https://reops-proxy.intern.nav.no",
    prodUrl: "https://reops-proxy.ansatt.nav.no",
  });

  const normalizeDomain = (domain) => {
    if (domain === "www.nav.no") return domain;
    return domain.replace(/^www\./, "");
  };

  // Helper function to detect if input looks like incomplete URL typing
  const shouldShowUrlSuggestion = (input) => {
    if (!input || input.length < 3) return false;

    // If it already looks like a valid URL, don't show suggestion
    if (
      input.startsWith("http://") ||
      input.startsWith("https://") ||
      input.includes("nav.no")
    ) {
      return false;
    }

    // Show suggestion if it looks like someone is starting to type a domain
    // but it's incomplete or malformed
    const suspiciousPatterns = [
      /^www\./, // starts with www.
      /^[a-zA-Z]+\./, // starts with letters followed by dot
      /\.[a-zA-Z]{2,}$/, // ends with .domain extension
      /^[a-zA-Z0-9-]+\.[a-zA-Z0-9-]/, // basic domain pattern without protocol
    ];

    return suspiciousPatterns.some((pattern) => pattern.test(input));
  };

  // Use internal query if external query is empty, otherwise use external query
  // However, in webstatistikk mode, if we have an internal query, prioritize it over invalid external query
  const effectiveQuery =
    isInWebstatistikkMode && internalQuery
      ? internalQuery
      : query || internalQuery;
  const lowerCaseQuery =
    typeof effectiveQuery === "string" ? effectiveQuery.toLowerCase() : "";

  // Check if the input contains multiple URLs - memoized to prevent infinite loops
  const { hasMultiple, urls: detectedUrls } = useMemo(() => {
    if (!effectiveQuery || typeof effectiveQuery !== "string")
      return { hasMultiple: false, urls: [] };

    // Split by line breaks first, then by spaces if on same line
    const potentialUrls = effectiveQuery
      .split(/[\r\n]+/) // Split by line breaks first
      .flatMap((line) => line.split(/\s+/)) // Then split each line by spaces
      .map((url) => url.trim())
      .filter(
        (url) =>
          url && (url.startsWith("http://") || url.startsWith("https://"))
      );

    return {
      hasMultiple: potentialUrls.length > 1,
      urls: potentialUrls,
    };
  }, [effectiveQuery]);

  // Don't show Umami if the query starts with "graf " (this should be handled by Grafbygger)
  const isValid =
    !lowerCaseQuery.startsWith("graf ") &&
    (lowerCaseQuery.startsWith("https://") ||
      lowerCaseQuery.startsWith("http://") ||
      lowerCaseQuery.includes("nav.no") ||
      hasMultiple);

  // Separate useEffect to fetch data only when query changes
  useEffect(() => {
    if (!isValid) {
      setDashboardUrl(null);
      setError(null);
      setWebsiteData(null);
      setUrlInfo(null);
      props.onValidQuery && props.onValidQuery(false);
      return;
    }
    if (!effectiveQuery || typeof effectiveQuery !== "string") {
      setDashboardUrl(null);
      setError("Ingen URL oppgitt.");
      setWebsiteData(null);
      setUrlInfo(null);
      props.onValidQuery && props.onValidQuery(false);
      return;
    }

    // Handle multiple URLs case
    if (hasMultiple && detectedUrls.length > 0) {
      // When multiple URLs are detected, automatically switch to multiple mode
      // and process all URLs from the same domain
      // Use the first URL to determine the domain and validate
      let inputUrl = detectedUrls[0];
      if (!inputUrl.startsWith("http://") && !inputUrl.startsWith("https://")) {
        inputUrl = "https://" + inputUrl;
      }
      let urlObj;
      try {
        urlObj = new URL(inputUrl);
        // Normalize nav.no to www.nav.no
        if (urlObj.hostname === "nav.no") {
          urlObj = new URL(inputUrl.replace("://nav.no", "://www.nav.no"));
        }
      } catch {
        setDashboardUrl(null);
        setError("Ugyldig URL-format.");
        setWebsiteData(null);
        setUrlInfo(null);
        props.onValidQuery && props.onValidQuery(false);
        return;
      }

      setLoading(true);
      setError(null);

      Promise.all([
        fetch(
          `${baseUrl}/umami/api/teams/aa113c34-e213-4ed6-a4f0-0aea8a503e6b/websites`,
          {
            credentials: getCredentialsMode(),
          }
        ).then((r) => r.json()),
        fetch(
          `${baseUrl}/umami/api/teams/bceb3300-a2fb-4f73-8cec-7e3673072b30/websites`,
          {
            credentials: getCredentialsMode(),
          }
        ).then((r) => r.json()),
      ])
        .then(([data1, data2]) => {
          if (!data1?.data || !data2?.data) throw new Error("API-feil");
          const team1Data = data1.data.filter(
            (item) => item.teamId === "aa113c34-e213-4ed6-a4f0-0aea8a503e6b"
          );
          const team2Data = data2.data.filter(
            (item) =>
              item.teamId === "bceb3300-a2fb-4f73-8cec-7e3673072b30" &&
              item.id === "c44a6db3-c974-4316-b433-214f87e80b4d"
          );
          const combinedData = [...team1Data, ...team2Data];
          const domain = urlObj.hostname;
          const normalizedInputDomain = normalizeDomain(domain);
          const matchedWebsite = combinedData.find(
            (item) =>
              normalizeDomain(item.domain) === normalizedInputDomain ||
              normalizedInputDomain.endsWith(`.${normalizeDomain(item.domain)}`)
          );

          if (matchedWebsite) {
            // Store the website data and URL info for later use
            setWebsiteData(matchedWebsite);
            setUrlInfo({
              domain: domain,
              path: urlObj.pathname,
              decodedPath: decodeURIComponent(urlObj.pathname || "*"),
            });

            // Auto-switch to multiple mode and process all URLs
            setFilterType("multiple");

            // Process all detected URLs to extract paths
            const allPaths = [];
            let hasError = false;

            for (const url of detectedUrls) {
              try {
                const urlObjTemp = new URL(url);
                if (urlObjTemp.hostname !== domain) {
                  setError(
                    `Alle URL-er må være fra samme domene (${domain}). Fant URL fra ${urlObjTemp.hostname}.`
                  );
                  hasError = true;
                  break;
                }
                allPaths.push(urlObjTemp.pathname);
              } catch (e) {
                setError(`Ugyldig URL-format: ${url}`);
                hasError = true;
                break;
              }
            }

            if (!hasError) {
              // Remove duplicates and set additional URLs
              const uniquePaths = [...new Set(allPaths)];
              setAdditionalUrls(uniquePaths);
              setError(null);
              props.onValidQuery && props.onValidQuery(true);
            } else {
              props.onValidQuery && props.onValidQuery(false);
            }
          } else {
            setWebsiteData(null);
            setUrlInfo(null);
            setDashboardUrl(null);
            setError("Denne siden har ikke fått støtte for Umami enda.");
            props.onValidQuery && props.onValidQuery(false);
          }
        })
        .catch(() => {
          setWebsiteData(null);
          setUrlInfo(null);
          setDashboardUrl(null);
          setError("Feil ved oppslag mot Umami.");
          props.onValidQuery && props.onValidQuery(false);
        })
        .finally(() => setLoading(false));

      return; // Early return for multiple URLs case
    }

    // Handle single URL case (existing logic)
    let inputUrl = effectiveQuery;
    if (!inputUrl.startsWith("http://") && !inputUrl.startsWith("https://")) {
      inputUrl = "https://" + inputUrl;
    }
    let urlObj;
    try {
      urlObj = new URL(inputUrl);
      // Normalize nav.no to www.nav.no
      if (urlObj.hostname === "nav.no") {
        urlObj = new URL(inputUrl.replace("://nav.no", "://www.nav.no"));
      }
    } catch {
      setDashboardUrl(null);
      setError("Ugyldig URL-format.");
      setWebsiteData(null);
      setUrlInfo(null);
      props.onValidQuery && props.onValidQuery(false);
      return;
    }
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(
        `${baseUrl}/umami/api/teams/aa113c34-e213-4ed6-a4f0-0aea8a503e6b/websites`,
        {
          credentials: getCredentialsMode(),
        }
      ).then((r) => r.json()),
      fetch(
        `${baseUrl}/umami/api/teams/bceb3300-a2fb-4f73-8cec-7e3673072b30/websites`,
        {
          credentials: getCredentialsMode(),
        }
      ).then((r) => r.json()),
    ])
      .then(([data1, data2]) => {
        if (!data1?.data || !data2?.data) throw new Error("API-feil");
        const team1Data = data1.data.filter(
          (item) => item.teamId === "aa113c34-e213-4ed6-a4f0-0aea8a503e6b"
        );
        const team2Data = data2.data.filter(
          (item) =>
            item.teamId === "bceb3300-a2fb-4f73-8cec-7e3673072b30" &&
            item.id === "c44a6db3-c974-4316-b433-214f87e80b4d"
        );
        const combinedData = [...team1Data, ...team2Data];
        const domain = urlObj.hostname;
        const path = urlObj.pathname;
        const normalizedInputDomain = normalizeDomain(domain);
        const matchedWebsite = combinedData.find(
          (item) =>
            normalizeDomain(item.domain) === normalizedInputDomain ||
            normalizedInputDomain.endsWith(`.${normalizeDomain(item.domain)}`)
        );

        if (matchedWebsite) {
          // Store the website data and URL info for later use
          setWebsiteData(matchedWebsite);
          setUrlInfo({
            domain: domain,
            path: path,
            decodedPath: decodeURIComponent(path || "*"),
          });
          setError(null);
          props.onValidQuery && props.onValidQuery(true);
        } else {
          setWebsiteData(null);
          setUrlInfo(null);
          setDashboardUrl(null);
          setError("Denne siden har ikke fått støtte for Umami enda.");
          props.onValidQuery && props.onValidQuery(false);
        }
      })
      .catch(() => {
        setWebsiteData(null);
        setUrlInfo(null);
        setDashboardUrl(null);
        setError("Feil ved oppslag mot Umami.");
        props.onValidQuery && props.onValidQuery(false);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveQuery, baseUrl, isValid, hasMultiple, props]); // Separate useEffect to update dashboard URL when filter type changes
  useEffect(() => {
    if (websiteData && urlInfo) {
      // Build URL for the new Dashboard app at startumami.ansatt.nav.no
      // The Dashboard supports: domain, path (multiple), pathOperator (equals/starts-with)

      const baseUmamiUrl = "https://startumami.ansatt.nav.no/dashboard";
      const params = new URLSearchParams();

      // Add domain for website resolution
      params.set("domain", urlInfo.domain);

      // Handle different filter types
      if (filterType === "exact") {
        // Single path with equals operator
        params.append("path", urlInfo.decodedPath);
        // pathOperator defaults to "equals", so no need to set it
      } else if (filterType === "startsWith") {
        // Single path with starts-with operator
        params.append("path", urlInfo.decodedPath);
        params.set("pathOperator", "starts-with");
      } else if (filterType === "multiple") {
        // Multiple paths with equals operator
        const allUrls = [urlInfo.decodedPath, ...additionalUrls];
        const uniqueUrls = [...new Set(allUrls)];

        uniqueUrls.forEach((url) => {
          params.append("path", url);
        });
        // pathOperator defaults to "equals", so no need to set it
      }

      const dashboardUrl = `${baseUmamiUrl}?${params.toString()}`;
      setDashboardUrl(dashboardUrl);
    }
  }, [filterType, websiteData, urlInfo, additionalUrls]);

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text");

    if (!pastedText || filterType !== "multiple" || !urlInfo) {
      return;
    }

    setInputError(""); // Clear previous error

    const urlsToAdd = pastedText
      .split(/\r\n|\r|\n/)
      .map((url) => url.trim())
      .filter((url) => url);

    if (urlsToAdd.length === 0) return;

    const mainDomain = urlInfo.domain;
    const newUrls = [...additionalUrls];
    let hasError = false;

    for (const urlToProcess of urlsToAdd) {
      let urlPath;

      if (
        urlToProcess.startsWith("http://") ||
        urlToProcess.startsWith("https://")
      ) {
        try {
          const urlObj = new URL(urlToProcess);
          if (urlObj.hostname !== mainDomain) {
            setInputError(
              `Domene "${urlObj.hostname}" matcher ikke "${mainDomain}". Kun stier fra samme domene kan legges til.`
            );
            hasError = true;
            break;
          }
          urlPath = urlObj.pathname;
        } catch (err) {
          setInputError(`Ugyldig URL-format: ${urlToProcess}`);
          hasError = true;
          break;
        }
      } else {
        urlPath = urlToProcess.startsWith("/")
          ? urlToProcess
          : "/" + urlToProcess;
      }

      if (!newUrls.includes(urlPath)) {
        newUrls.push(urlPath);
      }
    }

    if (!hasError) {
      setAdditionalUrls(newUrls);
      setNewUrlInput(""); // Clear input after paste
    }
  };

  // Helper function to handle adding a new URL to the list
  const addNewUrl = () => {
    // Basic validation
    if (!newUrlInput || filterType !== "multiple" || !urlInfo) {
      setInputError("");
      return;
    }

    console.log("Raw input:", newUrlInput);
    setInputError(""); // Clear previous error

    // First, normalize all line breaks and then split by common separators
    let normalizedInput = newUrlInput
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");
    console.log("Normalized input:", normalizedInput);

    // Split by newlines first, then handle any commas or semicolons within each line
    const lines = normalizedInput.split("\n");
    console.log("Split lines:", lines);

    const urlsToAdd = [];

    lines.forEach((line) => {
      const trimmedLine = line.trim();
      if (trimmedLine) {
        // If the line contains commas or semicolons, split it further
        if (trimmedLine.includes(",") || trimmedLine.includes(";")) {
          const subUrls = trimmedLine
            .split(/[,;]/)
            .map((url) => url.trim())
            .filter((url) => url);
          urlsToAdd.push(...subUrls);
        } else {
          urlsToAdd.push(trimmedLine);
        }
      }
    });

    console.log("URLs to add after parsing:", urlsToAdd);

    if (urlsToAdd.length === 0) return;

    const mainDomain = urlInfo.domain;
    const newUrls = [...additionalUrls];
    let hasError = false;

    // Debug log to console
    console.log("URLs to process:", urlsToAdd);

    for (const urlToProcess of urlsToAdd) {
      let urlPath;

      // Check if it's a full URL or just a path
      if (
        urlToProcess.startsWith("http://") ||
        urlToProcess.startsWith("https://")
      ) {
        try {
          const urlObj = new URL(urlToProcess);

          // Check if the domain matches the main domain
          if (urlObj.hostname !== mainDomain) {
            setInputError(
              `Domene "${urlObj.hostname}" matcher ikke "${mainDomain}". Kun stier fra samme domene kan legges til.`
            );
            hasError = true;
            break;
          }

          // Get the pathname and ensure query parameters are removed
          urlPath = urlObj.pathname;
        } catch (e) {
          console.error("URL parsing error:", e, "for URL:", urlToProcess);
          setInputError(`Ugyldig URL-format: ${urlToProcess}`);
          hasError = true;
          break;
        }
      } else {
        // It's just a path, ensure it starts with /
        urlPath = urlToProcess.startsWith("/")
          ? urlToProcess
          : "/" + urlToProcess;
      }

      // Avoid duplicates and main URL if it's already in the list
      if (!newUrls.includes(urlPath)) {
        newUrls.push(urlPath);
      }
    }

    if (!hasError) {
      // Debug log to console
      console.log("Final URL paths:", newUrls);

      setAdditionalUrls(newUrls);
      setNewUrlInput("");
    }
  };

  // Helper to find teamSiteimproveSite for the current query
  const getSiteimproveDomain = (url) => {
    if (!url) return false;
    try {
      const urlObj = new URL(url);
      const domain = urlObj.origin;
      const team = teamsData.find(
        (t) => t.teamDomain && domain.startsWith(t.teamDomain)
      );
      return team && team.teamSiteimproveSite
        ? team.teamSiteimproveSite
        : false;
    } catch {
      return false;
    }
  };

  // Handle URL input submission
  const handleUrlSubmit = (e) => {
    e.preventDefault();
    if (urlInput.trim()) {
      // Standard dashboard mode - go directly to dashboard
      setInternalQuery(urlInput.trim());
      // Update URL parameters to reflect the new query
      const newUrl = `/?w=${encodeURIComponent(urlInput.trim())}`;
      window.history.pushState(null, "", newUrl);
      // Clear the URL input since we're now using the internal query
      setUrlInput("");
    }
  };

  return (
    <>
      {/* If we're NOT in webstatistikk mode and there's no valid query, don't render anything */}
      {!isInWebstatistikkMode && !isValid ? null : (
        <GuidePanel className="mt-3 mb-7">
          <div className="prose">
            <h2 className="mb-6 text-2xl font-semibold">Nav webstatistikk</h2>

            {/* Show URL input when in webstatistikk mode and no valid query */}
            {isInWebstatistikkMode && (!effectiveQuery || !isValid) && (
              <form onSubmit={handleUrlSubmit} className="mb-4">
                <TextField
                  label="Lim inn URL for å se webstatistikk"
                  value={urlInput}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setUrlInput(newValue);
                    setShowUrlSuggestion(shouldShowUrlSuggestion(newValue));
                  }}
                  className="mb-3"
                />
                {showUrlSuggestion && (
                  <Alert variant="info" className="mb-2">
                    <strong>Tips:</strong> Prøv å lime inn den komplette URL-en
                    (inkludert https://) i stedet for å skrive den manuelt.
                  </Alert>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  style={{
                    backgroundColor: "var(--ax-bg-accent-strong)",
                    color: "var(--ax-text-accent-contrast)",
                  }}
                >
                  Neste
                </Button>
              </form>
            )}

            {isValid && !loading && !error && (
              <>
                <div className="mb-4">
                  <RadioGroup
                    legend="Vis statistikk for"
                    description={
                      hasMultiple
                        ? `${detectedUrls.length} URL-er oppdaget`
                        : effectiveQuery
                    }
                    value={filterType}
                    onChange={(value) => {
                      setFilterType(value);
                      // Clear additional URLs when switching away from multiple
                      if (value !== "multiple") {
                        setAdditionalUrls([]);
                      } else if (
                        value === "multiple" &&
                        urlInfo?.decodedPath &&
                        urlInfo.decodedPath !== "*"
                      ) {
                        // Pre-add the current path when switching to multiple
                        setAdditionalUrls([urlInfo.decodedPath]);
                      }
                    }}
                  >
                    <Radio value="exact">Kun denne siden</Radio>
                    <Radio value="multiple">Flere bestemte sider</Radio>
                    <Radio value="startsWith">
                      Alle sider som starter med URL-en
                    </Radio>
                  </RadioGroup>
                </div>

                {filterType === "multiple" && (
                  <div className="mb-4">
                    {/* List of added URLs */}
                    {additionalUrls.length > 0 && (
                      <div className="mb-3">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium">
                            Valgte URL-stier ({additionalUrls.length})
                          </span>
                          <Button
                            size="small"
                            variant="tertiary"
                            onClick={() => setAdditionalUrls([])}
                          >
                            Fjern alle
                          </Button>
                        </div>
                        <List as="ul">
                          {additionalUrls.map((url, index) => (
                            <List.Item
                              key={index}
                              className="flex items-center justify-between py-1"
                            >
                              <span>{url}</span>
                              <Button
                                size="small"
                                variant="tertiary"
                                onClick={() => {
                                  const newUrls = [...additionalUrls];
                                  newUrls.splice(index, 1);
                                  setAdditionalUrls(newUrls);
                                }}
                                icon={<TrashIcon aria-hidden />}
                                title="Fjern URL"
                              />
                            </List.Item>
                          ))}
                        </List>
                      </div>
                    )}

                    {/* Input field for new URL */}
                    <div className="flex items-end gap-2 mt-4">
                      <TextField
                        label="Legg til flere URL-er eller stier"
                        description="Lim inn fra Excel eller legg til manuelt"
                        value={newUrlInput}
                        onChange={(e) => {
                          setNewUrlInput(e.target.value);
                          if (inputError) setInputError("");
                        }}
                        onPaste={handlePaste}
                        className="flex-grow"
                        error={inputError || undefined}
                        multiline={true}
                        rows={newUrlInput.includes("\n") ? 8 : 3}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && e.ctrlKey) {
                            e.preventDefault();
                            addNewUrl();
                          }
                        }}
                      />
                      <Button
                        variant="secondary"
                        size="medium"
                        onClick={addNewUrl}
                        icon={<PlusIcon aria-hidden />}
                      >
                        Legg til
                      </Button>
                    </div>

                    {!inputError && (
                      <p className="text-sm text-gray-600 mt-1">
                        Du kan lime inn flere URL-er direkte fra Excel (en URL
                        per linje), eller separert med komma eller semikolon.
                        {newUrlInput.includes("\n") &&
                          " Bruk Ctrl+Enter for å legge til alle URL-ene samtidig."}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            {loading && (
              <Button loading variant="primary">
                Laster dashboard ...
              </Button>
            )}
            {!loading && dashboardUrl && (
              <div className="space-y-3">
                <Button
                  as="a"
                  href={dashboardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="primary"
                >
                  Åpne oversikten
                </Button>
                <div className="pt-2">
                  <Button
                    size="small"
                    variant="tertiary"
                    onClick={() => {
                      // Reset all state
                      setFilterType("exact");
                      setAdditionalUrls([]);
                      setNewUrlInput("");
                      setInputError("");
                      setInternalQuery("");
                      setWebsiteData(null);
                      setUrlInfo(null);
                      setDashboardUrl(null);
                      setError(null);

                      // Navigate back to webstatistikk mode with empty query without page refresh
                      window.history.pushState(null, "", "/?w");

                      // Force a page reload to ensure clean state
                      window.location.reload();
                    }}
                  >
                    Tilbakestill
                  </Button>
                </div>
              </div>
            )}
            {!loading && error && (
              <Alert variant="warning" style={{ marginTop: "1rem" }}>
                {error} Fortvil ikke — kontakt Team ResearchOps for å få lagt
                den til :)
              </Alert>
            )}
          </div>
          {/* Add SiteScores below Umami dashboard */}
          {isValid && (
            <div className="mt-2">
              <SiteScores
                pageUrl={
                  hasMultiple && detectedUrls.length > 0
                    ? detectedUrls[0]
                    : effectiveQuery
                }
                siteimproveSelectedDomain={getSiteimproveDomain(
                  hasMultiple && detectedUrls.length > 0
                    ? detectedUrls[0]
                    : effectiveQuery
                )}
                baseUrl={baseUrl}
              />
            </div>
          )}

          {/* Link to bookmark plugin - only show when dashboard is available 
          {!loading && dashboardUrl && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <Link as={RouterLink} to="?q=bokmerke">
                Se webstatistikk med ett klikk med et bokmerke
              </Link>
            </div>
          )}
            */}
        </GuidePanel>
      )}
    </>
  );
}

export default Umami;
