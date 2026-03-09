-- =============================================================================
-- PYMES Data Strategy - PostgreSQL Initialization
-- =============================================================================
-- This script runs automatically on first database creation

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'PostgreSQL initialization complete - Extensions installed: uuid-ossp, pg_trgm';
END $$;
