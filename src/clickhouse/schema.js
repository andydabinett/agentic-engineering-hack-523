export const NYC_RENT_LEDGER_DDL = `
CREATE TABLE IF NOT EXISTS nyc_rent_ledger (
  listing_id UInt64,
  source String,
  borough String,
  url String,
  listing_link String,
  title String,
  rent UInt32,
  beds String,
  baths String,
  agent_phone Nullable(String),
  agent_email Nullable(String),
  status String,
  scraped_at DateTime64(3, 'UTC'),
  zip_code String DEFAULT '',
  borough_median_rent UInt32 DEFAULT 0,
  price_delta_pct Float64 DEFAULT 0,
  is_high_priority UInt8 DEFAULT 0,
  is_rent_stabilized_match UInt8 DEFAULT 0
) ENGINE = ReplacingMergeTree(scraped_at)
ORDER BY (borough, url)
`;
