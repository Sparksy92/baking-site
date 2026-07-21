-- Add brand owner pronouns and cultural identity to brand_persona
-- Used by AI image prompts to generate correctly gendered and culturally
-- accurate representation (e.g. he/him, Mohawk Haudenosaunee)

ALTER TABLE brand_persona
    ADD COLUMN IF NOT EXISTS brand_owner_pronouns TEXT DEFAULT 'he/him',
    ADD COLUMN IF NOT EXISTS cultural_identity TEXT DEFAULT '';
