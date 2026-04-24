-- Mevcut veritabanı için migration (user_type → role, is_active, connections)
-- Yeni kurulum yapıyorsanız schema.sql yeterli, bunu çalıştırmanıza gerek yok.

ALTER TABLE users RENAME COLUMN user_type TO role;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_user_type_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'brand', 'agency'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

CREATE TABLE IF NOT EXISTS connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agency_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brand_id, agency_id)
);
