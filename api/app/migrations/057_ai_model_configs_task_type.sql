-- Migration 056: Rebuild ai_model_configs for per-task-type LLM routing
--
-- The old table stored generic model records (model_name, model_id, is_active).
-- The new ai_router.py expects one row per task_type with columns:
--   task_type, provider, model, temperature, max_tokens, enabled
--
-- Strategy: rename old table → backup, create new table with correct schema.

ALTER TABLE ai_model_configs RENAME TO ai_model_configs_legacy;

CREATE TABLE ai_model_configs (
    id          SERIAL PRIMARY KEY,
    task_type   TEXT NOT NULL UNIQUE,
    provider    TEXT NOT NULL DEFAULT 'auto',
    model       TEXT,
    temperature REAL DEFAULT 0.7,
    max_tokens  INTEGER DEFAULT 500,
    enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ai_model_configs_task_type ON ai_model_configs(task_type);
