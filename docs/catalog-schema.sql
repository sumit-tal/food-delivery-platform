-- SwiftEats Catalog: Read-Optimized Schema (PostgreSQL)
-- Generated: 2025-08-19

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1) Restaurants: core metadata, denormalized for read speed
CREATE TABLE IF NOT EXISTS restaurants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  cuisine_types TEXT[] NOT NULL DEFAULT '{}',
  city TEXT NOT NULL,
  area TEXT,
  is_open BOOLEAN NOT NULL DEFAULT TRUE,
  rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  eta_min INTEGER NOT NULL DEFAULT 20,
  eta_max INTEGER NOT NULL DEFAULT 40,
  latest_menu_version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_restaurants_city ON restaurants (city);
CREATE INDEX IF NOT EXISTS idx_restaurants_is_open ON restaurants (is_open);
CREATE INDEX IF NOT EXISTS idx_restaurants_cuisine_gin ON restaurants USING GIN (cuisine_types);

-- 2) Menu versions: append-only for consistency and cache invalidation via version bump
CREATE TABLE IF NOT EXISTS menu_versions (
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (restaurant_id, version)
);

-- 3) Menu items: versioned rows for each menu snapshot
CREATE TABLE IF NOT EXISTS menu_items (
  restaurant_id UUID NOT NULL,
  version INTEGER NOT NULL,
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  currency CHAR(3) NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  tags TEXT[] NOT NULL DEFAULT '{}',
  image_url TEXT,
  PRIMARY KEY (restaurant_id, version, id),
  CONSTRAINT fk_menu_version FOREIGN KEY (restaurant_id, version)
    REFERENCES menu_versions(restaurant_id, version)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_version ON menu_items (restaurant_id, version);
CREATE INDEX IF NOT EXISTS idx_menu_items_tags_gin ON menu_items USING GIN (tags);

-- Helper view for latest menus (optional; Redis is primary read path)
CREATE OR REPLACE VIEW latest_menu_items AS
SELECT mi.*
FROM menu_items mi
JOIN restaurants r ON r.id = mi.restaurant_id AND r.latest_menu_version = mi.version;

-- When upserting a new menu:
-- 1) BEGIN;
-- 2) INSERT INTO menu_versions(restaurant_id, version) VALUES ($rid, $new_ver);
-- 3) INSERT INTO menu_items(...) VALUES (..., $new_ver, ...);
-- 4) UPDATE restaurants SET latest_menu_version = $new_ver, updated_at = now() WHERE id = $rid;
-- 5) COMMIT;

-- Read path (DB fallback if cache miss):
-- SELECT * FROM latest_menu_items WHERE restaurant_id = $rid;
