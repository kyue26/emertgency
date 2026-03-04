-- Migration: 002_add_missing_tables.sql
-- Purpose: Add drill_sessions table and expand the professional role constraint
--          to match the webapp backend (e2/emertgency).
--
-- Changes:
--   1. drill_sessions table + indexes + updated_at trigger
--   2. Widen check_professional_role to include Staging / Triage / Treatment /
--      Transport Officer roles

-- ---------------------------------------------------------------------------
-- drill_sessions
-- ---------------------------------------------------------------------------
CREATE TABLE drill_sessions (
    id SERIAL PRIMARY KEY,
    drill_name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    drill_date DATE NOT NULL,
    created_by VARCHAR(50) REFERENCES professionals(professional_id) ON DELETE CASCADE,
    group_id VARCHAR(50),
    is_active BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'draft',
    role_assignments JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_drill_status CHECK (status IN ('draft', 'active', 'completed'))
);

CREATE INDEX idx_drill_sessions_active ON drill_sessions(is_active);
CREATE INDEX idx_drill_sessions_group ON drill_sessions(group_id);
CREATE INDEX idx_drill_sessions_status ON drill_sessions(status);

CREATE TRIGGER update_drill_sessions_updated_at BEFORE UPDATE ON drill_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Expand professional roles
-- ---------------------------------------------------------------------------
ALTER TABLE professionals
    DROP CONSTRAINT check_professional_role;

ALTER TABLE professionals
    ADD CONSTRAINT check_professional_role
    CHECK (role IN (
        'MERT Member',
        'Commander',
        'Medical Officer',
        'Staging Officer',
        'Triage Officer',
        'Treatment Officer',
        'Transport Officer'
    ));
