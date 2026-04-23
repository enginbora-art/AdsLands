const pool = require('./index');

async function migrate() {
  const client = await pool.connect();
  try {
    // Yeni kurulum için tabloları oluştur
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL DEFAULT '',
        role VARCHAR(10) NOT NULL DEFAULT 'brand',
        company_name VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        setup_token VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS invitations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        receiver_email VARCHAR(255) NOT NULL,
        token VARCHAR(255) UNIQUE NOT NULL,
        status VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS connections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        brand_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        agency_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(brand_id, agency_id)
      );
    `);

    // Mevcut kurulumlar: user_type → role yeniden adlandır
    await client.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'user_type'
        ) THEN
          ALTER TABLE users RENAME COLUMN user_type TO role;
        END IF;
      END $$;
    `);

    // CHECK kısıtlamasını admin dahil edecek şekilde güncelle
    await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_user_type_check;`);
    await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;`);
    await client.query(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'brand', 'agency'));`);

    // Eksik kolonları ekle
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS setup_token VARCHAR(255);`);
    await client.query(`ALTER TABLE users ALTER COLUMN password_hash SET DEFAULT '';`);

    // Entegrasyon tabloları
    await client.query(`
      CREATE TABLE IF NOT EXISTS integrations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        platform VARCHAR(20) NOT NULL CHECK (platform IN ('google_ads', 'meta', 'tiktok', 'google_analytics')),
        access_token TEXT,
        refresh_token TEXT,
        account_id VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, platform)
      );

      CREATE TABLE IF NOT EXISTS ad_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        spend NUMERIC(10,2) DEFAULT 0,
        impressions INTEGER DEFAULT 0,
        clicks INTEGER DEFAULT 0,
        conversions INTEGER DEFAULT 0,
        roas NUMERIC(6,2) DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(integration_id, date)
      );

      CREATE TABLE IF NOT EXISTS anomalies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
        detected_at TIMESTAMPTZ DEFAULT NOW(),
        metric VARCHAR(50) NOT NULL,
        expected_value NUMERIC(12,2),
        actual_value NUMERIC(12,2),
        action_taken VARCHAR(100),
        notified_at TIMESTAMPTZ
      );
    `);

    // Google OAuth token süresi için kolon
    await client.query(`ALTER TABLE integrations ADD COLUMN IF NOT EXISTS token_expiry TIMESTAMPTZ;`);

    // Bütçe tablosu
    await client.query(`
      CREATE TABLE IF NOT EXISTS budgets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
        year INTEGER NOT NULL,
        total_budget NUMERIC(12,2) NOT NULL DEFAULT 0,
        google_ads_budget NUMERIC(12,2) NOT NULL DEFAULT 0,
        meta_ads_budget NUMERIC(12,2) NOT NULL DEFAULT 0,
        tiktok_ads_budget NUMERIC(12,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, month, year)
      );
    `);

    console.log('✅ Tablolar hazır (users, invitations, connections, integrations, ad_metrics, anomalies)');
  } finally {
    client.release();
  }
}

module.exports = migrate;
