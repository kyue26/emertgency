-- Migration: 001_offline_sync.sql
-- Purpose: Add tables required for offline sync support.
-- Must be run against the database before deploying the application changes.
--
-- Tables added:
--   idempotency_keys  — cache POST/PUT/DELETE responses for 24 h to prevent duplicate records
--   deleted_casualties — permanent deletion log for delta sync (replaces relying on
--                        casualty_audit_log, whose rows are cascade-deleted with the casualty)

-- ---------------------------------------------------------------------------
-- idempotency_keys
-- ---------------------------------------------------------------------------
CREATE TABLE idempotency_keys (
    key VARCHAR(100) PRIMARY KEY,
    professional_id VARCHAR(50) NOT NULL
        REFERENCES professionals(professional_id) ON DELETE CASCADE,
    method VARCHAR(10) NOT NULL,
    path VARCHAR(200) NOT NULL,
    response_status INTEGER NOT NULL,
    response_body JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);
CREATE INDEX idx_idempotency_professional ON idempotency_keys(professional_id);

-- ---------------------------------------------------------------------------
-- deleted_casualties
-- Populated by the DELETE /casualties/:casualtyId handler before the row is
-- removed from injured_persons.  Using a separate table avoids the problem
-- that casualty_audit_log.casualty_id has ON DELETE CASCADE, which would wipe
-- the audit entry the moment the injured_person row is deleted.
-- ---------------------------------------------------------------------------
CREATE TABLE deleted_casualties (
    id SERIAL PRIMARY KEY,
    casualty_id VARCHAR(50) NOT NULL,
    event_id VARCHAR(50) NOT NULL
        REFERENCES events(event_id) ON DELETE CASCADE,
    deleted_by VARCHAR(50)
        REFERENCES professionals(professional_id) ON DELETE SET NULL,
    deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_deleted_casualties_event ON deleted_casualties(event_id);
CREATE INDEX idx_deleted_casualties_deleted_at ON deleted_casualties(deleted_at DESC);
