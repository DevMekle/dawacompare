-- DawaCompare catalogue schema (PostgreSQL 14+).
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS medicines (
  medicine_id          text PRIMARY KEY,
  brand_name           text NOT NULL,
  -- Lower-case first word of the brand ("Glucora SR 500" -> "glucora"); used to find candidates for a photo reading.
  brand_family         text NOT NULL,
  manufacturer         text,
  active_ingredients   text[] NOT NULL CHECK (cardinality(active_ingredients) > 0),
  -- Canonical lower-case salt names ("Metformin Hydrochloride" -> "metformin"), sorted. Used for matching.
  ingredients_norm     text[] NOT NULL CHECK (cardinality(ingredients_norm) > 0),
  strength             text NOT NULL,
  dosage_form          text NOT NULL CHECK (dosage_form IN ('Tablet', 'Capsule')),
  release_type         text NOT NULL CHECK (release_type IN ('IR', 'SR', 'ER', 'MR', 'DR')),
  verification_status  text NOT NULL CHECK (verification_status IN ('verified', 'unverified')),
  review_status        text NOT NULL CHECK (review_status IN ('approved', 'pending', 'rejected')),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS medicines_brand_family_idx ON medicines (brand_family);
CREATE INDEX IF NOT EXISTS medicines_ingredients_norm_idx ON medicines USING gin (ingredients_norm);

CREATE TABLE IF NOT EXISTS price_records (
  price_id             text PRIMARY KEY,
  medicine_id          text NOT NULL REFERENCES medicines (medicine_id) ON DELETE CASCADE,
  price_type           text NOT NULL CHECK (price_type IN ('MRP', 'SELLING_PRICE')),
  amount               numeric(10, 2) NOT NULL CHECK (amount > 0),
  pack_quantity        integer NOT NULL CHECK (pack_quantity > 0),
  price_source         text NOT NULL,
  verification_status  text NOT NULL CHECK (verification_status IN ('verified', 'unverified')),
  last_verified_at     date,
  created_at           timestamptz NOT NULL DEFAULT now(),
  -- A verified price must say when it was verified.
  CHECK (verification_status = 'unverified' OR last_verified_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS price_records_medicine_idx ON price_records (medicine_id, price_type, last_verified_at DESC);

-- Anonymous feedback and usage events. No names, phone numbers or health details are collected.
CREATE TABLE IF NOT EXISTS feedback (
  id                 bigserial PRIMARY KEY,
  created_at         timestamptz NOT NULL DEFAULT now(),
  helpful            boolean,
  comment            text CHECK (comment IS NULL OR length(comment) <= 1000),
  medicine_name      text,
  alternative_name   text,
  monthly_saving     numeric(10, 2),
  lang               text
);

CREATE TABLE IF NOT EXISTS events (
  id          bigserial PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now(),
  name        text NOT NULL CHECK (name IN ('comparison_viewed', 'savings_viewed', 'summary_ready', 'shared_whatsapp', 'saved_medicine')),
  meta        jsonb
);

CREATE INDEX IF NOT EXISTS events_name_idx ON events (name, created_at);
