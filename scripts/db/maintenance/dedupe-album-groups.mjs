import { spawnSync } from "child_process";

const sql = `
BEGIN;

CREATE TEMP TABLE dup_map AS
SELECT album_group_id AS dup_id, keep_id
FROM (
  SELECT
    album_group_id,
    lower(regexp_replace(trim(title), '\\\\s+', ' ', 'g')) AS norm_title,
    lower(regexp_replace(trim(primary_artist_display), '\\\\s+', ' ', 'g')) AS norm_artist,
    original_year,
    created_at,
    first_value(album_group_id) OVER (
      PARTITION BY lower(regexp_replace(trim(title), '\\\\s+', ' ', 'g')),
                   lower(regexp_replace(trim(primary_artist_display), '\\\\s+', ' ', 'g')),
                   original_year
      ORDER BY created_at ASC, album_group_id ASC
    ) AS keep_id,
    row_number() OVER (
      PARTITION BY lower(regexp_replace(trim(title), '\\\\s+', ' ', 'g')),
                   lower(regexp_replace(trim(primary_artist_display), '\\\\s+', ' ', 'g')),
                   original_year
      ORDER BY created_at ASC, album_group_id ASC
    ) AS rn
  FROM album_groups
) s
WHERE rn > 1;

-- album_details_cache (PK: album_group_id)
DELETE FROM album_details_cache adc
USING dup_map dm
WHERE adc.album_group_id = dm.dup_id
  AND EXISTS (
    SELECT 1 FROM album_details_cache adc2 WHERE adc2.album_group_id = dm.keep_id
  );

UPDATE album_details_cache adc
SET album_group_id = dm.keep_id
FROM dup_map dm
WHERE adc.album_group_id = dm.dup_id;

-- map_nodes (PK: album_group_id)
DELETE FROM map_nodes mn
USING dup_map dm
WHERE mn.album_group_id = dm.dup_id
  AND EXISTS (
    SELECT 1 FROM map_nodes mn2 WHERE mn2.album_group_id = dm.keep_id
  );

UPDATE map_nodes mn
SET album_group_id = dm.keep_id
FROM dup_map dm
WHERE mn.album_group_id = dm.dup_id;

-- album_links (PK: album_group_id, provider, url)
DELETE FROM album_links al
USING dup_map dm, album_links al2
WHERE al.album_group_id = dm.dup_id
  AND al2.album_group_id = dm.keep_id
  AND al2.provider = al.provider
  AND al2.url = al.url;

UPDATE album_links al
SET album_group_id = dm.keep_id
FROM dup_map dm
WHERE al.album_group_id = dm.dup_id;

-- album_awards (unique: album_group_id, award_name, award_year, award_result, source_url)
DELETE FROM album_awards aa
USING dup_map dm, album_awards aa2
WHERE aa.album_group_id = dm.dup_id
  AND aa2.album_group_id = dm.keep_id
  AND aa2.award_name = aa.award_name
  AND aa2.award_year IS NOT DISTINCT FROM aa.award_year
  AND aa2.award_result IS NOT DISTINCT FROM aa.award_result
  AND aa2.source_url IS NOT DISTINCT FROM aa.source_url;

UPDATE album_awards aa
SET album_group_id = dm.keep_id
FROM dup_map dm
WHERE aa.album_group_id = dm.dup_id;

-- album_credits (PK: album_group_id, creator_id, role_id)
DELETE FROM album_credits ac
USING dup_map dm, album_credits ac2
WHERE ac.album_group_id = dm.dup_id
  AND ac2.album_group_id = dm.keep_id
  AND ac2.creator_id = ac.creator_id
  AND ac2.role_id = ac.role_id;

UPDATE album_credits ac
SET album_group_id = dm.keep_id
FROM dup_map dm
WHERE ac.album_group_id = dm.dup_id;

-- user_album_actions (PK: user_id, album_group_id)
DELETE FROM user_album_actions ua
USING dup_map dm, user_album_actions ua2
WHERE ua.album_group_id = dm.dup_id
  AND ua2.album_group_id = dm.keep_id
  AND ua2.user_id = ua.user_id;

UPDATE user_album_actions ua
SET album_group_id = dm.keep_id
FROM dup_map dm
WHERE ua.album_group_id = dm.dup_id;

-- album_reviews
UPDATE album_reviews ar
SET album_id = dm.keep_id
FROM dup_map dm
WHERE ar.album_id = dm.dup_id;

-- releases
UPDATE releases r
SET album_group_id = dm.keep_id
FROM dup_map dm
WHERE r.album_group_id = dm.dup_id;

-- ai_research
UPDATE ai_research air
SET album_id = dm.keep_id
FROM dup_map dm
WHERE air.album_id = dm.dup_id;

-- finally, delete duplicate album_groups
DELETE FROM album_groups ag
USING dup_map dm
WHERE ag.album_group_id = dm.dup_id;

COMMIT;
`;

const result = spawnSync(
  "docker",
  ["exec", "-i", "sonic_db", "psql", "-U", "sonic", "-d", "sonic_db", "-v", "ON_ERROR_STOP=1"],
  { input: sql, stdio: ["pipe", "inherit", "inherit"] }
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
