-- Creates the test database alongside the main one.
-- Runs automatically on first docker compose up via initdb.d.
SELECT 'CREATE DATABASE ecommerce_test OWNER ecommerce'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ecommerce_test')\gexec
