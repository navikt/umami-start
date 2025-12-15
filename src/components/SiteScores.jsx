import React, { useEffect, useState } from 'react';

const LABEL_MIN_HEIGHT = "2.5rem"; // Ensures all labels take up the same vertical space

const SiteScores = ({ pageUrl, siteimproveSelectedDomain, baseUrl, className }) => {
    const [selectedPageId, setSelectedPageId] = useState(null);
    const [scoreOverview, setScoreOverview] = useState(null);
    const [error, setError] = useState(null);
    const [reportLink, setReportLink] = useState(null);

    const roundToOneDecimal = (num) => {
        return Math.round(num * 10) / 10;
    };

    // Helper for fetching from the proxy
    const fetchSiteimproveProxy = async (path) => {
        const url = `${baseUrl}/siteimprove${path}`; // removed /api
        console.log("Siteimprove API URL:", url);
        const credentials = window.location.hostname === 'localhost' ? 'omit' : 'include';
        let res;
        try {
            console.log("Fetching Siteimprove data from:", url, "with credentials:", credentials);
            res = await fetch(url, { credentials });
        } catch (err) {
            console.error("Fetch error:", err);
            throw new Error('Nettverksfeil ved henting av Siteimprove-data');
        }
        if (!res.ok) throw new Error('API error');
        try {
            return await res.json();
        } catch (err) {
            throw new Error('Feil ved parsing av JSON-data fra Siteimprove');
        }
    };

    useEffect(() => {
        // Clear previous state when dependencies change
        setSelectedPageId(null);
        setScoreOverview(null);
        setError(null);
        setReportLink(null);

        if (!siteimproveSelectedDomain || siteimproveSelectedDomain === false) {
            setError('Ingen Siteimprove-støtte for denne siden.');
            return;
        }
        const fetchData = async () => {
            try {
                const selectedPageData = await fetchSiteimproveProxy(
                    `/sites/${siteimproveSelectedDomain}/quality_assurance/inventory/pages?url=${pageUrl}`
                );

                if (
                    selectedPageData &&
                    selectedPageData.items &&
                    selectedPageData.items.length > 0
                ) {
                    const firstItemId = selectedPageData.items[0].id;
                    setSelectedPageId(firstItemId);

                    const overviewData = await fetchSiteimproveProxy(
                        `/sites/${siteimproveSelectedDomain}/dci/overview?page_id=${firstItemId}`
                    );
                    if (
                        overviewData &&
                        overviewData.a11y &&
                        overviewData.qa &&
                        overviewData.seo
                    ) {
                        setScoreOverview(overviewData);
                    } else {
                        setError('error');
                        throw new Error(
                            'Fant ingen data for side, sjekk om du har skrevet in URL riktig'
                        );
                    }

                    const reportsHref = await fetchSiteimproveProxy(
                        `/sites/${siteimproveSelectedDomain}/content/pages/${firstItemId}`
                    );
                    if (reportsHref._siteimprove?.quality_assurance?.page_report?.href) {
                        setReportLink(
                            reportsHref._siteimprove.quality_assurance.page_report.href
                        );
                    }
                } else {
                    setError('error');
                    throw new Error(
                        'Fant ingen side, sjekk om du har skrevet in URL riktig'
                    );
                }
            } catch (error) {
                console.error('Error fetching data: ', error);
                setError(
                    'Klarte ikke å hente data fra Siteimprove, sjekk om du har skrevet in URL riktig. '
                );
            }
        };

        fetchData();
    }, [pageUrl, siteimproveSelectedDomain, baseUrl]);

    if (error) {
        return null;
    }

    const getColor = (score) => {
        if (score > 75) return '#4caf50';
        if (score > 50) return '#ffeb3b';
        if (score > 25) return '#f44336';
        return '#ff9800';
    };

    // Helper for multi-ring border using box-shadow: black, color, black, white
    const getCircleBoxShadow = (score) => {
        const color = getColor(score);
        return `
            0 0 0 1.5px #111,    /* thin black outer */
            0 0 0 6px ${color},  /* thick color */
            0 0 0 7.5px #111,    /* thin black inner */
            0 0 0 11px #fff      /* white background ring */
        `;
    };

    return (
        <>
            {scoreOverview && (
                <div className={`p-2 w-full bg-white border border-gray-200 rounded-lg shadow-sm mb-2 ${className || ''}`}>
                    <div className="w-full">
                        <div className="mt-1 bg-white p-2 rounded-lg">
                            <h2 className="text-lg font-semibold mb-1" style={{ color: '#000000' }}>
                                Poengsum (av 100) fra Siteimprove
                            </h2>
                            <hr className="my-4 border-t border-gray-300" />
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                                {/* QA */}
                                <div className="flex flex-row md:flex-col items-center md:items-center justify-start md:justify-center w-full p-2">
                                    <div
                                        className="flex items-center justify-center w-16 h-16 rounded-full text-xl font-bold bg-white"
                                        style={{
                                            boxShadow: getCircleBoxShadow(scoreOverview.qa.total),
                                            color: '#111',
                                        }}
                                        aria-label={`Kvalitetsikring: ${roundToOneDecimal(scoreOverview.qa.total)}`}
                                    >
                                        {roundToOneDecimal(scoreOverview.qa.total)}
                                    </div>
                                    <div
                                        className="ml-4 md:ml-0 mt-0 md:mt-4 font-medium text-base leading-tight text-left md:text-center"
                                        style={{ minHeight: LABEL_MIN_HEIGHT }}
                                    >
                                        {`Kvalitetsikring av innhold`}
                                    </div>
                                </div>
                                {/* A11y */}
                                <div className="flex flex-row md:flex-col items-center md:items-center justify-start md:justify-center w-full p-2">
                                    <div
                                        className="flex items-center justify-center w-16 h-16 rounded-full text-xl font-bold bg-white"
                                        style={{
                                            boxShadow: getCircleBoxShadow(scoreOverview.a11y.total),
                                            color: '#111',
                                        }}
                                        aria-label={`Universell utforming: ${roundToOneDecimal(scoreOverview.a11y.total)}`}
                                    >
                                        {roundToOneDecimal(scoreOverview.a11y.total)}
                                    </div>
                                    <div
                                        className="ml-4 md:ml-0 mt-0 md:mt-4 font-medium text-base leading-tight text-left md:text-center"
                                        style={{ minHeight: LABEL_MIN_HEIGHT }}
                                    >
                                        {`Universell utforming`}
                                    </div>
                                </div>
                                {/* SEO */}
                                <div className="flex flex-row md:flex-col items-center md:items-center justify-start md:justify-center w-full p-2">
                                    <div
                                        className="flex items-center justify-center w-16 h-16 rounded-full text-xl font-bold bg-white"
                                        style={{
                                            boxShadow: getCircleBoxShadow(scoreOverview.seo.total),
                                            color: '#111',
                                        }}
                                        aria-label={`SEO: ${roundToOneDecimal(scoreOverview.seo.total)}`}
                                    >
                                        {roundToOneDecimal(scoreOverview.seo.total)}
                                    </div>
                                    <div
                                        className="ml-4 md:ml-0 mt-0 md:mt-4 font-medium text-base leading-tight text-left md:text-center"
                                        style={{ minHeight: LABEL_MIN_HEIGHT }}
                                    >
                                        {`Søkemotor-optimalisering`}
                                    </div>
                                </div>
                                {/* Total */}
                                <div className="flex flex-row md:flex-col items-center md:items-center justify-start md:justify-center w-full p-2">
                                    <div
                                        className="flex items-center justify-center w-16 h-16 rounded-full text-xl font-bold bg-white"
                                        style={{
                                            boxShadow: getCircleBoxShadow(scoreOverview.total),
                                            color: '#111',
                                        }}
                                        aria-label={`Snitt: ${roundToOneDecimal(scoreOverview.total)}`}
                                    >
                                        {roundToOneDecimal(scoreOverview.total)}
                                    </div>
                                    <div
                                        className="ml-4 md:ml-0 mt-0 md:mt-4 font-medium text-base leading-tight text-left md:text-center"
                                        style={{ minHeight: LABEL_MIN_HEIGHT }}
                                    >
                                        {`Snitt`}
                                    </div>
                                </div>
                            </div>
                            <hr className="my-2 border-t border-gray-300" />
                            {reportLink && (
                                <div className="bg-white pl-0 pt-2 ">
                                    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                                        <a
                                            href={reportLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <p className="text-base font-bold underline mb-1 text-blue-700">
                                                Rapport med forklaringer (🔐)
                                            </p>
                                        </a>
                                        <a
                                            href="https://jira.adeo.no/plugins/servlet/desk/portal/581/create/2641"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <p className="text-base font-bold underline text-blue-700">
                                                Få Siteimprove tilgang
                                            </p>
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default SiteScores;
