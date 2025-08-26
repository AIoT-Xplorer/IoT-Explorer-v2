-- Enable extensions
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Devices catalog
CREATE TABLE IF NOT EXISTS devices (
  tenant_id TEXT NOT NULL,
  app_id    TEXT NOT NULL,
  device_id TEXT NOT NULL,
  meta      JSONB DEFAULT '{}'::jsonb,
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, app_id, device_id)
);

-- Generic measurements time-series
CREATE TABLE IF NOT EXISTS measurements (
  tenant_id TEXT NOT NULL,
  app_id    TEXT NOT NULL,
  device_id TEXT NOT NULL,
  signal    TEXT NOT NULL,
  ts        TIMESTAMPTZ NOT NULL,
  value     DOUBLE PRECISION,
  extra     JSONB,
  PRIMARY KEY (tenant_id, app_id, device_id, signal, ts)
);

-- Date de la tenanți

CREATE TABLE IF NOT EXISTS device_data (
    id SERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL,           -- din header X-Tenant-ID
    app_name TEXT NOT NULL,            -- ex: "glove", "energy", "medical"
    topic TEXT NOT NULL,
    payload JSONB NOT NULL,
    received_at TIMESTAMPTZ DEFAULT now()
);


SELECT create_hypertable('measurements', by_range('ts'), if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS idx_meas_tenant_app_signal_ts ON measurements (tenant_id, app_id, signal, ts DESC);
