import React, { useEffect, useState } from 'react';

const LABEL_MIN_HEIGHT = "2.5rem"; // Ensures all labels take up the same vertical space

/**
 * SiteGroupScores - Displays Siteimprove DCI scores and QA details at the group level
 * Similar to SiteScores but uses group_id instead of page_id
 */
const SiteGroupScores = ({ siteId, portalSiteId, groupId, baseUrl, className }) => {
    const [scoreOverview, setScoreOverview] = useState(null);
    const [qaOverview, setQaOverview] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);

    const roundToOneDecimal = (num) => {
        return Math.round(num * 10) / 10;
    };

    // Helper for fetching from the proxy
    const fetchSiteimproveProxy = async (path, optional = false) => {
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

        console.log(`Response status for ${path}:`, res.status);

        if (!res.ok) {
            if (optional) {
                console.warn(`Optional endpoint ${path} returned ${res.status}`);
                return null;
            }
            throw new Error(`API error: ${res.status}`);
        }

        try {
            const text = await res.text();
            try {
                return JSON.parse(text);
            } catch (parseErr) {
                console.error('JSON parse error. Response text:', text.substring(0, 500));
                if (optional) return null;
                throw new Error('Feil ved parsing av JSON-data fra Siteimprove');
            }
        } catch (err) {
            if (optional) return null;
            throw err;
        }
    };

    useEffect(() => {
        // Clear previous state when dependencies change
        setScoreOverview(null);
        setQaOverview(null);
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

                console.log('DCI Overview full response:', overviewData);
                console.log('QA details:', JSON.stringify(overviewData?.qa, null, 2));
                console.log('A11y details:', JSON.stringify(overviewData?.a11y, null, 2));

                if (
                    overviewData &&
                    overviewData.a11y &&
                    overviewData.qa &&
                    overviewData.seo
                ) {
                    setScoreOverview(overviewData);
                } else {
                    setError('Fant ingen data for denne gruppen.');
                    return;
                }

                // Fetch broken links for this group
                const brokenLinksData = await fetchSiteimproveProxy(
                    `/sites/${siteId}/quality_assurance/links/broken_links?group_id=${groupId}`,
                    true // optional
                );

                // Fetch potential misspellings for this group
                const misspellingsData = await fetchSiteimproveProxy(
                    `/sites/${siteId}/quality_assurance/spelling/potential_misspellings?group_id=${groupId}`,
                    true // optional
                );

                console.log('Broken links data:', brokenLinksData);
                console.log('Misspellings data:', misspellingsData);

                const newQaOverview = {};

                if (brokenLinksData) {
                    newQaOverview.broken_links = brokenLinksData.total_items || brokenLinksData.items?.length || 0;
                    newQaOverview.raw_broken_links = brokenLinksData;
                }

                if (misspellingsData) {
                    newQaOverview.potential_misspellings = misspellingsData.total_items || misspellingsData.items?.length || 0;
                    newQaOverview.raw_misspellings = misspellingsData;
                }

                if (Object.keys(newQaOverview).length > 0) {
                    setQaOverview(newQaOverview);
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

    // Get color for issue counts (inverted - 0 is best)
    const getIssueColor = (count) => {
        if (count === 0) return '#4caf50';
        if (count <= 10) return '#ffeb3b';
        if (count <= 50) return '#ff9800';
        return '#f44336';
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

    // Stat card component for QA details
    const StatCard = ({ label, value, color }) => (
        <div className="flex flex-col items-center p-3 bg-gray-50 rounded-lg">
            <span
                className="text-2xl font-bold"
                style={{ color: color || '#111' }}
            >
                {value}
            </span>
            <span className="text-sm text-gray-600 text-center mt-1">{label}</span>
        </div>
    );

    return (
        <>
            {scoreOverview && (
                <div className={`p-2 w-full bg-white border border-gray-200 rounded-lg shadow-sm mb-2 ${className || ''}`}>
                    <div className="w-full">
                        <div className="mt-1 bg-white p-2 rounded-lg">
                            <h2 className="text-lg font-semibold mb-3" style={{ color: '#000000' }}>
                                Funn fra Siteimprove
                            </h2>

                            {/* QA Details Section - Funn (Findings) */}
                            {qaOverview && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Broken Links */}
                                    {qaOverview.broken_links !== undefined && (
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 bg-white border border-gray-200 rounded-lg p-4 shadow-sm h-full">
                                            <div className="flex items-center gap-3 min-w-[200px]">
                                                <div
                                                    className="flex items-center justify-center w-10 h-10 rounded-full font-bold text-base shrink-0 transition-colors"
                                                    style={{
                                                        color: (getIssueColor(qaOverview.broken_links) === '#ffeb3b' || getIssueColor(qaOverview.broken_links) === '#ff9800') ? '#1f2937' : '#ffffff',
                                                        backgroundColor: getIssueColor(qaOverview.broken_links)
                                                    }}
                                                >
                                                    {qaOverview.broken_links}
                                                </div>
                                                <div className="flex flex-col">
                                                    <h3 className="text-base font-semibold text-gray-900">
                                                        Ødelagte lenker
                                                    </h3>
                                                    {qaOverview.broken_links === 0 && (
                                                        <span className="text-sm text-green-700 font-medium">Ingen — God jobbet!</span>
                                                    )}
                                                </div>
                                            </div>

                                            {qaOverview.broken_links > 0 && (
                                                <a
                                                    href={`https://my2.siteimprove.com/QualityAssurance/${portalSiteId || 1002489}/${groupId}/Links/Pages/1/PageLevel/Asc?pageSize=100`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="mt-2 sm:mt-0 inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                                                >
                                                    Se rapport <span className="ml-1" aria-hidden="true">→</span>
                                                </a>
                                            )}
                                        </div>
                                    )}

                                    {/* Potential Misspellings */}
                                    {qaOverview.potential_misspellings !== undefined && (
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 bg-white border border-gray-200 rounded-lg p-4 shadow-sm h-full">
                                            <div className="flex items-center gap-3 min-w-[200px]">
                                                <div
                                                    className="flex items-center justify-center w-10 h-10 rounded-full font-bold text-base shrink-0 transition-colors"
                                                    style={{
                                                        color: (getIssueColor(qaOverview.potential_misspellings) === '#ffeb3b' || getIssueColor(qaOverview.potential_misspellings) === '#ff9800') ? '#1f2937' : '#ffffff',
                                                        backgroundColor: getIssueColor(qaOverview.potential_misspellings)
                                                    }}
                                                >
                                                    {qaOverview.potential_misspellings}
                                                </div>
                                                <div className="flex flex-col">
                                                    <h3 className="text-base font-semibold text-gray-900">
                                                        Mulige stavefeil
                                                    </h3>
                                                    {qaOverview.potential_misspellings === 0 && (
                                                        <span className="text-sm text-green-700 font-medium">Ingen funnet!</span>
                                                    )}
                                                </div>
                                            </div>

                                            {qaOverview.potential_misspellings > 0 && (
                                                <a
                                                    href={`https://my2.siteimprove.com/QualityAssurance/${portalSiteId || 1002489}/${groupId}/Spelling/IndexV2`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="mt-2 sm:mt-0 inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                                                >
                                                    Se rapport <span className="ml-1" aria-hidden="true">→</span>
                                                </a>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="bg-white pl-0 mt-4">
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
