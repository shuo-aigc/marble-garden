CREATE TABLE IF NOT EXISTS daily_event_counts (
  day TEXT NOT NULL,
  event TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, event)
);

-- No raw address, device identifier, or complete user agent is kept. visitor_hash
-- is secret-salted and changes each day, so it cannot be used for cross-day tracking.
CREATE TABLE IF NOT EXISTS daily_visitors (
  day TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  device TEXT NOT NULL,
  browser TEXT NOT NULL,
  PRIMARY KEY (day, visitor_hash)
);

CREATE TABLE IF NOT EXISTS daily_device_counts (
  day TEXT NOT NULL,
  device TEXT NOT NULL,
  browser TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, device, browser)
);
