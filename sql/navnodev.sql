WITH base_query AS (
  SELECT
    e.*,
    'ansatt.dev.nav.no' as website_domain,
    'Nav.no - dev' as website_name,
    CONCAT(
      e.url_path,
      CASE
        WHEN e.url_query IS NOT NULL AND e.url_query != ''
        THEN CONCAT('?', e.url_query)
        ELSE ''
      END
    ) AS url_fullpath,
    CONCAT(
      'https://ansatt.dev.nav.no',
      e.url_path,
      CASE
        WHEN e.url_query IS NOT NULL AND e.url_query != ''
        THEN CONCAT('?', e.url_query)
        ELSE ''
      END
    ) AS url_fullurl,
    CONCAT(
      e.referrer_path,
      CASE
        WHEN e.referrer_query IS NOT NULL AND e.referrer_query != ''
        THEN CONCAT('?', e.referrer_query)
        ELSE ''
      END
    ) AS referrer_fullpath,
    CASE
      WHEN e.referrer_domain IS NOT NULL AND e.referrer_domain != ''
      THEN CONCAT(
        'https://',
        e.referrer_domain,
        e.referrer_path,
        CASE
          WHEN e.referrer_query IS NOT NULL AND e.referrer_query != ''
          THEN CONCAT('?', e.referrer_query)
          ELSE ''
        END
      )
      ELSE NULL
    END AS referrer_fullurl,
    s.browser,
    s.os,
    s.device,
    s.screen,
    s.language,
    s.country,
    s.subdivision1,
    s.city
  FROM `team-researchops-prod-01d6.umami.public_website_event` e
  LEFT JOIN `team-researchops-prod-01d6.umami.public_session` s
    ON e.session_id = s.session_id
  WHERE (e.event_type = 1 OR e.event_name IN ('token dialog renew', 'skjema startet', 'token dialog logout', 'pageview', 'søk', 'kopier-lenke', 'token dialog shown', 'skjema steg startet', 'test', 'accordion lukket', 'filter-valg', 'accordion åpnet', 'resultat-klikk', 'arkivert-beskjed', 'navigere', 'video start', 'besøk', 'filtervalg', 'modal åpnet', 'modal lukket', 'skjema steg fullført'))
  AND e.website_id = 'c44a6db3-c974-4316-b433-214f87e80b4d'
)

SELECT
  base_query.event_id,
  base_query.created_at,
  base_query.event_type,
  base_query.event_name,
  base_query.website_id,
  base_query.website_domain,
  base_query.website_name,
  base_query.page_title,
  base_query.url_path,
  base_query.url_query,
  base_query.url_fullpath,
  base_query.url_fullurl,
  base_query.referrer_domain,
  base_query.referrer_path,
  base_query.referrer_query,
  base_query.referrer_fullpath,
  base_query.referrer_fullurl,
  base_query.visit_id,
  base_query.session_id,
  base_query.browser,
  base_query.os,
  base_query.device,
  base_query.screen,
  base_query.language,
  base_query.country,
  base_query.subdivision1,
  base_query.city,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'title' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_title,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'origin' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_origin,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'parametre.redirectToApp' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_parametre_redirectToApp,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'lenkegruppe' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_lenkegruppe,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'filternavn' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_filternavn,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'parametre.simpleHeader' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_parametre_simpleHeader,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'endring' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_endring,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'treffnr' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_treffnr,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'sokeord' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_sokeord,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'parametre.simple' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_parametre_simple,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'knapp' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_knapp,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'antallAktiviteter' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_antallAktiviteter,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'parametre.language' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_parametre_language,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'parametre.chatbot' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_parametre_chatbot,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'varighet' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_varighet,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'tittel' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_tittel,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'parametre.level' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_parametre_level,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'url' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_url,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'viaDekoratoren' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_viaDekoratoren,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'modalId' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_modalId,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'steg' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_steg,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'parametre.utilsBackground' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_parametre_utilsBackground,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'subFilter' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_subFilter,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'seksjon' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_seksjon,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'parametre.chatbotVisible' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_parametre_chatbotVisible,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'parametre.maskHotjar' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_parametre_maskHotjar,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'søkeord' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_soekeord,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'originVersion' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_originVersion,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'sidetittel' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_sidetittel,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'skjemaId' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_skjemaId,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'innholdstype' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_innholdstype,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'innlogging' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_innlogging,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'parametre.redirectToUrl' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_parametre_redirectToUrl,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'språk' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_spraak,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'destinasjon' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_destinasjon,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'parametre.availableLanguages' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_parametre_availableLanguages,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'parametre.logoutWarning' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_parametre_logoutWarning,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'opprinnelse' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_opprinnelse,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'parametre.redirectOnUserChange' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_parametre_redirectOnUserChange,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'sesjonId' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_sesjonId,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'rapporteringstype' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_rapporteringstype,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'kategori' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_kategori,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'stegnavn' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_stegnavn,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'målgruppe' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_maalgruppe,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'parametre.breadcrumbs' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_parametre_breadcrumbs,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'parametre.context' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_parametre_context,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'skjemanavn' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_skjemanavn,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'parametre.pageType' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_parametre_pageType,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'parametre.shareScreen' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_parametre_shareScreen,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'komponent' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_komponent,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'parametre.feedback' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_parametre_feedback,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'filter' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_filter,
  STRING_AGG(
        CASE 
          WHEN event_data.data_key = 'lenketekst' 
          THEN event_data.string_value 
        END, 
        ',' 
        ORDER BY base_query.created_at
      ) AS data_key_lenketekst
FROM base_query
LEFT JOIN `team-researchops-prod-01d6.umami.public_event_data` AS event_data
  ON base_query.event_id = event_data.website_event_id
GROUP BY
    base_query.event_id,
    base_query.created_at,
    base_query.event_type,
    base_query.event_name,
    base_query.website_id,
    base_query.website_domain,
    base_query.website_name,
    base_query.page_title,
    base_query.url_path,
    base_query.url_query,
    base_query.url_fullpath,
    base_query.url_fullurl,
    base_query.referrer_domain,
    base_query.referrer_path,
    base_query.referrer_query,
    base_query.referrer_fullpath,
    base_query.referrer_fullurl,
    base_query.visit_id,
    base_query.session_id,
    base_query.browser,
    base_query.os,
    base_query.device,
    base_query.screen,
    base_query.language,
    base_query.country,
    base_query.subdivision1,
    base_query.city