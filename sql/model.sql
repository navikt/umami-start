SELECT
  `source`.`event_id` AS `event_id`,
  `source`.`created_at` AS `created_at`,
  `source`.`name` AS `name`,
  `source`.`website_id` AS `website_id`,
  `source`.`page_title` AS `page_title`,
  `source`.`domain` AS `website_domain`,
  `source`.`url_path` AS `url_path`,
  `source`.`url_query` AS `url_query`,
  CONCAT(
    `source`.`url_path`, 
    CASE 
      WHEN `source`.`url_query` IS NOT NULL AND `source`.`url_query` != '' 
      THEN CONCAT('?', `source`.`url_query`) 
      ELSE '' 
    END
  ) AS `url_fullpath`,
  CASE 
    WHEN `source`.`domain` IS NOT NULL AND `source`.`domain` != '' 
    THEN CONCAT(
      'https://', 
      `source`.`domain`, 
      `source`.`url_path`, 
      CASE 
        WHEN `source`.`url_query` IS NOT NULL AND `source`.`url_query` != '' 
        THEN CONCAT('?', `source`.`url_query`) 
        ELSE '' 
      END
    ) 
    ELSE NULL 
  END AS `url_fullurl`,
  `source`.`referrer_domain` AS `referrer_domain`,
  `source`.`referrer_path` AS `referrer_path`,
  `source`.`referrer_query` AS `referrer_query`,
  CONCAT(
    `source`.`referrer_path`, 
    CASE 
      WHEN `source`.`referrer_query` IS NOT NULL AND `source`.`referrer_query` != '' 
      THEN CONCAT('?', `source`.`referrer_query`) 
      ELSE '' 
    END
  ) AS `referrer_fullpath`,
  CASE 
    WHEN `source`.`referrer_domain` IS NOT NULL AND `source`.`referrer_domain` != '' 
    THEN CONCAT(
      'https://', 
      `source`.`referrer_domain`, 
      `source`.`referrer_path`, 
      CASE 
        WHEN `source`.`referrer_query` IS NOT NULL AND `source`.`referrer_query` != '' 
        THEN CONCAT('?', `source`.`referrer_query`) 
        ELSE '' 
      END
    ) 
    ELSE NULL 
  END AS `referrer_fullurl`,
  `source`.`event_type` AS `event_type`,
  `source`.`event_name` AS `event_name`,
  `source`.`visit_id` AS `visit_id`,
  `source`.`session_id` AS `session_id`,
  `source`.`tag` AS `tag`,
  `event_data`.`data_key` AS `data_key`,
  `event_data`.`string_value` AS `string_value`,
  `event_data`.`number_value` AS `number_value`,
  `event_data`.`date_value` AS `date_value`,
  `event_data`.`data_type` AS `data_type`,
  `session`.`browser` AS `browser`,
  `session`.`os` AS `os`,
  `session`.`device` AS `device`,
  `session`.`screen` AS `screen`,
  `session`.`language` AS `language`,
  `session`.`country` AS `country`,
  `session`.`subdivision1` AS `subdivision1`,
  `session`.`city` AS `city`
FROM
  (
    SELECT
      `source`.`name` AS `name`,
      `source`.`website_id` AS `website_id`,
      `source`.`domain` AS `domain`,
      `public_website_event___website_id`.`event_id` AS `event_id`,
      `public_website_event___website_id`.`created_at` AS `created_at`,
      `public_website_event___website_id`.`url_path` AS `url_path`,
      `public_website_event___website_id`.`url_query` AS `url_query`,
      `public_website_event___website_id`.`referrer_path` AS `referrer_path`,
      `public_website_event___website_id`.`referrer_query` AS `referrer_query`,
      `public_website_event___website_id`.`referrer_domain` AS `referrer_domain`,
      `public_website_event___website_id`.`page_title` AS `page_title`,
      `public_website_event___website_id`.`event_type` AS `event_type`,
      `public_website_event___website_id`.`event_name` AS `event_name`,
      `public_website_event___website_id`.`visit_id` AS `visit_id`,
      `public_website_event___website_id`.`session_id` AS `session_id`,
      `public_website_event___website_id`.`tag` AS `tag`
    FROM
      (
        SELECT
          `source`.`website_id` AS `website_id`,
          `source`.`name` AS `name`,
          `source`.`domain` AS `domain`,
          `source`.`share_id` AS `share_id`,
          `source`.`team_id` AS `team_id`,
          `source`.`created_at` AS `created_at`,
          `source`.`updated_at` AS `updated_at`
        FROM
          (
            WITH RankedWebsites AS (
              SELECT
                `source`.`website_id` AS `website_id`,
                `source`.`name` AS `name`,
                `source`.`domain` AS `domain`,
                `source`.`share_id` AS `share_id`,
                `source`.`reset_at` AS `reset_at`,
                `source`.`created_by` AS `created_by`,
                `source`.`team_id` AS `team_id`,
                `source`.`created_at` AS `created_at`,
                `source`.`updated_at` AS `updated_at`,
                ROW_NUMBER() OVER (
                  PARTITION BY `source`.`website_id`
                  ORDER BY
                    CASE
                      WHEN `source`.`share_id` IS NOT NULL THEN 0
                      ELSE 1
                    END,
                    COALESCE(`source`.`updated_at`, `source`.`created_at`) DESC
                ) AS rn
              FROM
                (
                  SELECT
                    `team-researchops-prod-01d6.umami.public_website`.`website_id` AS `website_id`,
                    `team-researchops-prod-01d6.umami.public_website`.`name` AS `name`,
                    `team-researchops-prod-01d6.umami.public_website`.`domain` AS `domain`,
                    `team-researchops-prod-01d6.umami.public_website`.`share_id` AS `share_id`,
                    `team-researchops-prod-01d6.umami.public_website`.`reset_at` AS `reset_at`,
                    `team-researchops-prod-01d6.umami.public_website`.`user_id` AS `user_id`,
                    `team-researchops-prod-01d6.umami.public_website`.`created_at` AS `created_at`,
                    `team-researchops-prod-01d6.umami.public_website`.`updated_at` AS `updated_at`,
                    `team-researchops-prod-01d6.umami.public_website`.`deleted_at` AS `deleted_at`,
                    `team-researchops-prod-01d6.umami.public_website`.`created_by` AS `created_by`,
                    `team-researchops-prod-01d6.umami.public_website`.`team_id` AS `team_id`
                  FROM
                    `team-researchops-prod-01d6.umami.public_website`
                ) AS `source`
              WHERE
                `source`.`user_id` IS NULL
                AND `source`.`deleted_at` IS NULL
            )
            SELECT
              `website_id`,
              `name`,
              `domain`,
              `share_id`,
              `team_id`,
              `created_at`,
              `updated_at`
            FROM
              RankedWebsites
            WHERE
              rn = 1
          ) AS `source`
      ) AS `source`
    LEFT JOIN `team-researchops-prod-01d6.umami.public_website_event` AS `public_website_event___website_id`
      ON `source`.`website_id` = `public_website_event___website_id`.`website_id`
  ) AS `source`
LEFT JOIN `team-researchops-prod-01d6.umami.public_event_data` AS `event_data`
  ON `source`.`event_id` = `event_data`.`website_event_id`
LEFT JOIN `team-researchops-prod-01d6.umami.public_session` AS `session`
  ON `source`.`session_id` = `session`.`session_id`;