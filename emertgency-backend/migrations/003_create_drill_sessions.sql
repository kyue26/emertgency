-- Create drill_sessions table
CREATE TABLE IF NOT EXISTS drill_sessions (
  id SERIAL PRIMARY KEY,
  drill_name VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  drill_date DATE NOT NULL,
  created_by VARCHAR(50) REFERENCES professionals(professional_id) ON DELETE CASCADE,
  group_id VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  role_assignments JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX idx_drill_sessions_active ON drill_sessions(is_active);
CREATE INDEX idx_drill_sessions_group ON drill_sessions(group_id);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_drill_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_drill_sessions_updated_at
  BEFORE UPDATE ON drill_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_drill_sessions_updated_at();
