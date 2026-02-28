-- Add resource_requests table
CREATE TABLE IF NOT EXISTS resource_requests (
    resource_request_id VARCHAR(50) PRIMARY KEY,
    event_id VARCHAR(50) NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    resource_name VARCHAR(255) NOT NULL,
    confirmed BOOLEAN DEFAULT false,
    time_of_arrival TIMESTAMP,
    requested_by VARCHAR(50) REFERENCES professionals(professional_id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_resource_requests_event ON resource_requests(event_id);
CREATE INDEX IF NOT EXISTS idx_resource_requests_confirmed ON resource_requests(confirmed);

-- Add trigger for updated_at
CREATE TRIGGER update_resource_requests_updated_at BEFORE UPDATE ON resource_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
