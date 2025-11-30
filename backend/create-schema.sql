
DROP TABLE IF EXISTS task_audit_log CASCADE;
DROP TABLE IF EXISTS group_audit_log CASCADE;
DROP TABLE IF EXISTS event_audit_log CASCADE;
DROP TABLE IF EXISTS casualty_audit_log CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS injured_persons CASCADE;
DROP TABLE IF EXISTS professional_groups CASCADE;
DROP TABLE IF EXISTS professional_passwords CASCADE;
DROP TABLE IF EXISTS professionals CASCADE;
DROP TABLE IF EXISTS event_groups CASCADE;
DROP TABLE IF EXISTS camps CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS events CASCADE;

CREATE TABLE events (
    event_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(500),
    start_time TIMESTAMP,
    finish_time TIMESTAMP,
    status VARCHAR(50) DEFAULT 'upcoming',
    created_by VARCHAR(50),
    updated_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_event_status CHECK (status IN ('upcoming', 'in_progress', 'finished', 'cancelled')),
    CONSTRAINT check_event_times CHECK (finish_time IS NULL OR finish_time > start_time)
);

CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_start_time ON events(start_time);
CREATE INDEX idx_events_created_by ON events(created_by);

CREATE TABLE camps (
    camp_id VARCHAR(50) PRIMARY KEY,
    event_id VARCHAR(50) NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    location_name VARCHAR(200) NOT NULL,
    capacity INTEGER CHECK (capacity >= 0 AND capacity <= 10000),
    created_by VARCHAR(50),
    updated_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_camps_event_id ON camps(event_id);
CREATE INDEX idx_camps_location_name ON camps(location_name);

CREATE TABLE groups (
    group_id VARCHAR(50) PRIMARY KEY,
    group_name VARCHAR(100) NOT NULL,
    lead_professional_id VARCHAR(50),
    max_members INTEGER DEFAULT 10 CHECK (max_members >= 1 AND max_members <= 50),
    created_by VARCHAR(50),
    updated_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_group_name UNIQUE (group_name)
);

CREATE INDEX idx_groups_lead ON groups(lead_professional_id);
CREATE INDEX idx_groups_name ON groups(LOWER(group_name));

CREATE TABLE professionals (
    professional_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL CHECK (length(name) >= 2),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(20),
    role VARCHAR(100) DEFAULT 'MERT Member',
    group_id VARCHAR(50) REFERENCES groups(group_id) ON DELETE SET NULL,
    current_camp_id VARCHAR(50) REFERENCES camps(camp_id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_professional_role CHECK (role IN ('MERT Member', 'Commander', 'Medical Officer'))
);

CREATE INDEX idx_professionals_email ON professionals(email);
CREATE INDEX idx_professionals_group ON professionals(group_id);
CREATE INDEX idx_professionals_camp ON professionals(current_camp_id);
CREATE INDEX idx_professionals_role ON professionals(role);

ALTER TABLE groups 
ADD CONSTRAINT fk_lead_professional 
FOREIGN KEY (lead_professional_id) 
REFERENCES professionals(professional_id) ON DELETE SET NULL;

ALTER TABLE events
ADD CONSTRAINT fk_events_created_by 
FOREIGN KEY (created_by) 
REFERENCES professionals(professional_id) ON DELETE SET NULL;

ALTER TABLE events
ADD CONSTRAINT fk_events_updated_by 
FOREIGN KEY (updated_by) 
REFERENCES professionals(professional_id) ON DELETE SET NULL;

ALTER TABLE camps
ADD CONSTRAINT fk_camps_created_by 
FOREIGN KEY (created_by) 
REFERENCES professionals(professional_id) ON DELETE SET NULL;

ALTER TABLE camps
ADD CONSTRAINT fk_camps_updated_by 
FOREIGN KEY (updated_by) 
REFERENCES professionals(professional_id) ON DELETE SET NULL;

ALTER TABLE groups
ADD CONSTRAINT fk_groups_created_by 
FOREIGN KEY (created_by) 
REFERENCES professionals(professional_id) ON DELETE SET NULL;

ALTER TABLE groups
ADD CONSTRAINT fk_groups_updated_by 
FOREIGN KEY (updated_by) 
REFERENCES professionals(professional_id) ON DELETE SET NULL;

CREATE TABLE professional_passwords (
    professional_id VARCHAR(50) PRIMARY KEY REFERENCES professionals(professional_id) ON DELETE CASCADE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_password_change TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP
);

CREATE INDEX idx_passwords_locked ON professional_passwords(locked_until) WHERE locked_until IS NOT NULL;

CREATE TABLE event_groups (
    event_id VARCHAR(50) REFERENCES events(event_id) ON DELETE CASCADE,
    group_id VARCHAR(50) REFERENCES groups(group_id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (event_id, group_id)
);

CREATE INDEX idx_event_groups_event ON event_groups(event_id);
CREATE INDEX idx_event_groups_group ON event_groups(group_id);

CREATE TABLE injured_persons (
    injured_person_id VARCHAR(50) PRIMARY KEY,
    event_id VARCHAR(50) NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    camp_id VARCHAR(50) REFERENCES camps(camp_id) ON DELETE SET NULL,
    color VARCHAR(20) NOT NULL,
    breathing BOOLEAN,
    conscious BOOLEAN,
    bleeding BOOLEAN,
    hospital_status VARCHAR(255),
    other_information TEXT CHECK (length(other_information) <= 1000),
    created_by VARCHAR(50) REFERENCES professionals(professional_id) ON DELETE SET NULL,
    updated_by VARCHAR(50) REFERENCES professionals(professional_id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_casualty_color CHECK (color IN ('green', 'yellow', 'red', 'black'))
);

CREATE INDEX idx_injured_event ON injured_persons(event_id);
CREATE INDEX idx_injured_camp ON injured_persons(camp_id);
CREATE INDEX idx_injured_color ON injured_persons(color);
CREATE INDEX idx_injured_hospital_status ON injured_persons(hospital_status);
CREATE INDEX idx_injured_created_at ON injured_persons(created_at DESC);

CREATE TABLE tasks (
    task_id VARCHAR(50) PRIMARY KEY,
    created_by VARCHAR(50) NOT NULL REFERENCES professionals(professional_id) ON DELETE CASCADE,
    assigned_to VARCHAR(50) NOT NULL REFERENCES professionals(professional_id) ON DELETE CASCADE,
    event_id VARCHAR(50) NOT NULL REFERENCES events(event_id) ON DELETE CASCADE,
    task_description TEXT NOT NULL CHECK (length(task_description) >= 5 AND length(task_description) <= 1000),
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(20) DEFAULT 'pending',
    due_date TIMESTAMP,
    notes TEXT CHECK (length(notes) <= 2000),
    completed_at TIMESTAMP,
    updated_by VARCHAR(50) REFERENCES professionals(professional_id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_task_priority CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT check_task_status CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled'))
);

CREATE INDEX idx_tasks_created_by ON tasks(created_by);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_event ON tasks(event_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);


CREATE TABLE event_audit_log (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(50),
    action VARCHAR(50) NOT NULL,
    performed_by VARCHAR(50) REFERENCES professionals(professional_id) ON DELETE SET NULL,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_event_audit_event ON event_audit_log(event_id);
CREATE INDEX idx_event_audit_created_at ON event_audit_log(created_at DESC);
CREATE INDEX idx_event_audit_action ON event_audit_log(action);

CREATE TABLE group_audit_log (
    id SERIAL PRIMARY KEY,
    group_id VARCHAR(50) REFERENCES groups(group_id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    performed_by VARCHAR(50) REFERENCES professionals(professional_id) ON DELETE SET NULL,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_group_audit_group ON group_audit_log(group_id);
CREATE INDEX idx_group_audit_created_at ON group_audit_log(created_at DESC);

CREATE TABLE casualty_audit_log (
    id SERIAL PRIMARY KEY,
    casualty_id VARCHAR(50) REFERENCES injured_persons(injured_person_id) ON DELETE CASCADE,
    changed_by VARCHAR(50) REFERENCES professionals(professional_id) ON DELETE SET NULL,
    changes JSONB NOT NULL,
    previous_state JSONB,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_casualty_audit_casualty ON casualty_audit_log(casualty_id);
CREATE INDEX idx_casualty_audit_changed_at ON casualty_audit_log(changed_at DESC);

CREATE TABLE task_audit_log (
    id SERIAL PRIMARY KEY,
    task_id VARCHAR(50) REFERENCES tasks(task_id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    changed_by VARCHAR(50) REFERENCES professionals(professional_id) ON DELETE SET NULL,
    details JSONB,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_task_audit_task ON task_audit_log(task_id);
CREATE INDEX idx_task_audit_changed_at ON task_audit_log(changed_at DESC);

CREATE TABLE hospitals (
    hospital_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    distance VARCHAR(50),
    trauma_level INTEGER CHECK (trauma_level BETWEEN 1 AND 4),
    capacity INTEGER,
    contact_number VARCHAR(20),
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_hospitals_active ON hospitals(is_active) WHERE is_active = true;
CREATE INDEX idx_hospitals_trauma_level ON hospitals(trauma_level);

INSERT INTO hospitals (name, distance, trauma_level, is_active) VALUES
    ('Hospital of the University of Pennsylvania (HUP)', '0.5 miles', 1, true),
    ('Penn Presbyterian Medical Center', '2.3 miles', 1, true),
    ('Children''s Hospital of Philadelphia', '1.2 miles', 1, true),
    ('Pennsylvania Hospital', '1.8 miles', 2, true),
    ('Jefferson Hospital', '2.5 miles', 1, true);


CREATE VIEW active_events_view AS
SELECT 
    e.*,
    COUNT(DISTINCT c.camp_id) as camp_count,
    COUNT(DISTINCT ip.injured_person_id) as casualty_count,
    COUNT(DISTINCT p.professional_id) as professional_count
FROM events e
LEFT JOIN camps c ON e.event_id = c.event_id
LEFT JOIN injured_persons ip ON e.event_id = ip.event_id
LEFT JOIN professionals p ON p.current_camp_id = c.camp_id
WHERE e.status = 'in_progress'
GROUP BY e.event_id;

CREATE VIEW professional_task_summary AS
SELECT 
    p.professional_id,
    p.name,
    p.email,
    COUNT(CASE WHEN t.status = 'pending' THEN 1 END) as pending_tasks,
    COUNT(CASE WHEN t.status = 'in_progress' THEN 1 END) as in_progress_tasks,
    COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN t.priority = 'critical' AND t.status != 'completed' THEN 1 END) as critical_tasks
FROM professionals p
LEFT JOIN tasks t ON p.professional_id = t.assigned_to
GROUP BY p.professional_id, p.name, p.email;

-- Group membership view
CREATE VIEW group_membership_view AS
SELECT 
    g.group_id,
    g.group_name,
    g.lead_professional_id,
    lead.name as lead_name,
    COUNT(p.professional_id) as member_count,
    g.max_members,
    ARRAY_AGG(p.name ORDER BY p.name) FILTER (WHERE p.professional_id IS NOT NULL) as member_names
FROM groups g
LEFT JOIN professionals lead ON g.lead_professional_id = lead.professional_id
LEFT JOIN professionals p ON p.group_id = g.group_id
GROUP BY g.group_id, g.group_name, g.lead_professional_id, lead.name, g.max_members;

CREATE VIEW casualty_statistics_view AS
SELECT 
    e.event_id,
    e.name as event_name,
    e.status as event_status,
    COUNT(ip.injured_person_id) as total_casualties,
    COUNT(CASE WHEN ip.color = 'green' THEN 1 END) as green_count,
    COUNT(CASE WHEN ip.color = 'yellow' THEN 1 END) as yellow_count,
    COUNT(CASE WHEN ip.color = 'red' THEN 1 END) as red_count,
    COUNT(CASE WHEN ip.color = 'black' THEN 1 END) as black_count,
    COUNT(CASE WHEN ip.hospital_status IS NOT NULL AND ip.hospital_status != '' THEN 1 END) as transferred_count
FROM events e
LEFT JOIN injured_persons ip ON e.event_id = ip.event_id
GROUP BY e.event_id, e.name, e.status;


-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_camps_updated_at BEFORE UPDATE ON camps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_professionals_updated_at BEFORE UPDATE ON professionals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_injured_persons_updated_at BEFORE UPDATE ON injured_persons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hospitals_updated_at BEFORE UPDATE ON hospitals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION check_group_capacity()
RETURNS TRIGGER AS $$
DECLARE
    current_count INTEGER;
    max_count INTEGER;
BEGIN
    IF NEW.group_id IS NOT NULL THEN
        SELECT max_members INTO max_count
        FROM groups
        WHERE group_id = NEW.group_id;
        
        SELECT COUNT(*) INTO current_count
        FROM professionals
        WHERE group_id = NEW.group_id;
        
        IF current_count >= max_count THEN
            RAISE EXCEPTION 'Group is at maximum capacity of % members', max_count;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_group_capacity_trigger
    BEFORE INSERT OR UPDATE OF group_id ON professionals
    FOR EACH ROW
    EXECUTE FUNCTION check_group_capacity();

CREATE OR REPLACE FUNCTION check_camp_capacity()
RETURNS TRIGGER AS $$
DECLARE
    current_count INTEGER;
    max_count INTEGER;
BEGIN
    IF NEW.current_camp_id IS NOT NULL THEN
        SELECT capacity INTO max_count
        FROM camps
        WHERE camp_id = NEW.current_camp_id;
        
        IF max_count IS NOT NULL THEN
            SELECT COUNT(*) INTO current_count
            FROM professionals
            WHERE current_camp_id = NEW.current_camp_id;
            
            IF current_count >= max_count THEN
                RAISE EXCEPTION 'Camp is at maximum capacity of % professionals', max_count;
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_camp_capacity_trigger
    BEFORE INSERT OR UPDATE OF current_camp_id ON professionals
    FOR EACH ROW
    EXECUTE FUNCTION check_camp_capacity();

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO emert;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO emert;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO emert;

SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

SELECT 
    'events' as table_name, COUNT(*) as row_count FROM events
UNION ALL SELECT 'camps', COUNT(*) FROM camps
UNION ALL SELECT 'groups', COUNT(*) FROM groups
UNION ALL SELECT 'professionals', COUNT(*) FROM professionals
UNION ALL SELECT 'professional_passwords', COUNT(*) FROM professional_passwords
UNION ALL SELECT 'injured_persons', COUNT(*) FROM injured_persons
UNION ALL SELECT 'tasks', COUNT(*) FROM tasks
UNION ALL SELECT 'hospitals', COUNT(*) FROM hospitals;

SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;