-- Sprint 10: Add last_read_at to social_conversations for unread badge
ALTER TABLE social_conversations ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_conversations_unread ON social_conversations (last_message_at, last_read_at);
