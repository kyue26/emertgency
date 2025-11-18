
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'emertgency' AND pid <> pg_backend_pid();

DROP DATABASE IF EXISTS emertgency;
DROP USER IF EXISTS emert;

CREATE USER emert WITH PASSWORD 'emertpass';
CREATE DATABASE emertgency OWNER emert;
GRANT ALL PRIVILEGES ON DATABASE emertgency TO emert;