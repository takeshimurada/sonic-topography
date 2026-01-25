# Target Schema Overview

This document summarizes the refactored schema and migration outputs.

## Key Changes

- `persons` → `creators` (namespaced IDs)
- `artist_details` → `creator_spotify_profile`
- `albums` → `album_groups`
- `album_details` → decomposed into `releases`, `tracks`, `album_links`, `track_credits`, with optional `album_details_cache`
- `album_credits` role → normalized via `roles`
- `user_ratings` → `user_album_actions` + `user_creator_actions`

## New Tables (Selected)

- `creator_id_map`
- `creators`
- `creator_spotify_profile`
- `album_groups`
- `releases`
- `tracks`
- `roles`
- `album_credits`
- `track_credits`
- `album_links`
- `creator_links`
- `cultural_assets`
- `asset_links`
- `map_nodes`
- `album_details_cache`
- `user_album_actions`
- `user_creator_actions`

## Migration Scripts

- `scripts/db/migrate/migrate-to-target-schema.py`
- `scripts/db/seed/seed-roles.py`
- `scripts/db/import/import-album-groups.py`
- `scripts/db/import/import-metadata.py`
- `scripts/db/migrate/validate-target-schema.py`
