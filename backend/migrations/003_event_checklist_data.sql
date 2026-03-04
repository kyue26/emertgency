-- Migration: 003_event_checklist_data.sql
-- Purpose: Store Officer Checklist data per event for multi-device sync.
-- Run: psql $DATABASE_URL -f migrations/003_event_checklist_data.sql
--          Resources, agencies, locations, treatment counts, radio checks, etc.

CREATE TABLE IF NOT EXISTS event_checklist_data (
    event_id VARCHAR(50) PRIMARY KEY REFERENCES events(event_id) ON DELETE CASCADE,
    payload JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_event_checklist_data_updated ON event_checklist_data(updated_at);
