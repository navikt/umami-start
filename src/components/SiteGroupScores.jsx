import React, { useEffect, useState } from 'react';

const LABEL_MIN_HEIGHT = "2.5rem"; // Ensures all labels take up the same vertical space

/**
 * SiteGroupScores - Displays Siteimprove DCI scores at the group level
 * Similar to SiteScores but uses group_id instead of page_id
 */
const SiteGroupScores = ({ siteId, groupId, baseUrl, className }) => {
    const [scoreOverview, setScoreOverview] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    const roundToOneDecimal = (num) => {
        return Math.round(num * 10) / 10;
    };

    // Helper for fetching from the proxy
    const fetchSiteimproveProxy = async (path) => {
        const url = `${baseUrl}/siteimprove${path}`;
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
        setScoreOverview(null);
        setError(null);
        setLoading(true);

        if (!siteId) {
            setError('Mangler Siteimprove site ID.');
            setLoading(false);
            return;
        }

        if (!groupId) {
            setError('Velg et kontor for å se Siteimprove-poengsum.');
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                // Fetch DCI overview with group_id parameter
                const overviewData = await fetchSiteimproveProxy(
                    `/sites/${siteId}/dci/overview?group_id=${groupId}`
                );

                if (
                    overviewData &&
                    overviewData.a11y &&
                    overviewData.qa &&
                    overviewData.seo
                ) {
                    setScoreOverview(overviewData);
                } else {
                    setError('Fant ingen data for denne gruppen.');
                }
            } catch (error) {
                console.error('Error fetching group data: ', error);
                setError('Klarte ikke å hente data fra Siteimprove.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [siteId, groupId, baseUrl]);

    if (loading) {
        return (
            <div className={`p-4 w-full bg-white border border-gray-200 rounded-lg shadow-sm ${className || ''}`}>
                <div className="animate-pulse flex space-x-4">
                    <div className="flex-1 space-y-4 py-1">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="space-y-2">
                            <div className="h-4 bg-gray-200 rounded"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`p-4 w-full bg-white border border-gray-200 rounded-lg shadow-sm ${className || ''}`}>
                <p className="text-gray-500 text-sm">{error}</p>
            </div>
        );
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
                            <div className="bg-white pl-0 pt-2 ">
                                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
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
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default SiteGroupScores;
