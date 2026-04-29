const pool = require('./index');
const bcrypt = require('bcrypt');
const { ALL_PERMISSIONS } = require('../constants');

async function migrate() {
  const client = await pool.connect();
  try {
    // Eski şema varsa (users.role kolonu) temizle ve yeniden oluştur
    const { rows: oldCols } = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'role'
    `);

    if (oldCols.length > 0) {
      console.log('🔄 Eski şema tespit edildi, temizleniyor...');
      await client.query(`
        DROP TABLE IF EXISTS agency_brand_invitations CASCADE;
        DROP TABLE IF EXISTS budget_logs CASCADE;
        DROP TABLE IF EXISTS budgets CASCADE;
        DROP TABLE IF EXISTS anomalies CASCADE;
        DROP TABLE IF EXISTS ad_metrics CASCADE;
        DROP TABLE IF EXISTS integrations CASCADE;
        DROP TABLE IF EXISTS connections CASCADE;
        DROP TABLE IF EXISTS invitations CASCADE;
        DROP TABLE IF EXISTS users CASCADE;
      `);
    }

    // ── Şirketler ─────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        type VARCHAR(10) NOT NULL CHECK (type IN ('admin', 'agency', 'brand')),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── Roller ────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        permissions JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── Kullanıcılar ──────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL DEFAULT '',
        is_company_admin BOOLEAN DEFAULT false,
        is_platform_admin BOOLEAN DEFAULT false,
        role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
        is_active BOOLEAN DEFAULT true,
        setup_token VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── Bağlantılar ───────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS connections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        agency_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        brand_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        status VARCHAR(10) NOT NULL DEFAULT 'accepted' CHECK (status IN ('accepted', 'rejected')),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(agency_company_id, brand_company_id)
      );
    `);

    // ── Davetler ──────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS invitations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sender_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        receiver_email VARCHAR(255) NOT NULL,
        receiver_company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
        type VARCHAR(20) NOT NULL CHECK (type IN ('agency_to_brand', 'brand_to_agency', 'user_invite')),
        token VARCHAR(255) UNIQUE,
        status VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── Bildirimler ───────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT,
        meta JSONB DEFAULT '{}',
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── Entegrasyonlar ────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS integrations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        platform VARCHAR(20) NOT NULL CHECK (platform IN ('google_ads', 'meta', 'tiktok', 'google_analytics', 'appsflyer', 'adjust')),
        access_token TEXT,
        refresh_token TEXT,
        token_expiry TIMESTAMPTZ,
        account_id VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(company_id, platform)
      );
    `);

    // full_name kolonu ekle (varsa sessizce geç)
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
    `);

    // extra JSONB kolonu ekle (varsa sessizce geç)
    await client.query(`
      ALTER TABLE integrations ADD COLUMN IF NOT EXISTS extra JSONB DEFAULT '{}';
    `);

    // sector kolonu ekle (varsa sessizce geç)
    await client.query(`
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS sector VARCHAR(100);
    `);

    // reports tablosu
    await client.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        brand_id UUID REFERENCES companies(id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        report_type VARCHAR(50) NOT NULL,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`ALTER TABLE reports ADD COLUMN IF NOT EXISTS format VARCHAR(10);`);
    await client.query(`ALTER TABLE reports ADD COLUMN IF NOT EXISTS file_url TEXT;`);

    // budget_channels tablosu (dinamik kanal dağılımı)
    await client.query(`
      CREATE TABLE IF NOT EXISTS budget_channels (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
        platform VARCHAR(50) NOT NULL,
        amount NUMERIC(12,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(budget_id, platform)
      );
    `);

    // Platform constraint'ini güncelle (adform + linkedin ekle)
    await client.query(`
      DO $$
      BEGIN
        ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_platform_check;
        ALTER TABLE integrations ADD CONSTRAINT integrations_platform_check
          CHECK (platform IN ('google_ads', 'meta', 'tiktok', 'google_analytics', 'appsflyer', 'adjust', 'adform', 'linkedin'));
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);

    // ── OAuth Sessions (MCC / Meta BM import akışı) ───────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS oauth_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
        provider VARCHAR(20) NOT NULL,
        access_token TEXT,
        refresh_token TEXT,
        extra JSONB DEFAULT '{}',
        expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '15 minutes',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── Reklam Metrikleri ─────────────────────────────────────────────────────
    await client.query(`
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
    `);

    // ── Anomaliler ────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS anomalies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        detected_at TIMESTAMPTZ DEFAULT NOW(),
        metric VARCHAR(50) NOT NULL,
        expected_value NUMERIC(12,2),
        actual_value NUMERIC(12,2),
        status VARCHAR(10) DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── Anomali Notları ───────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS anomaly_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        anomaly_id UUID NOT NULL REFERENCES anomalies(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        note TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── Bütçeler ──────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS budgets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
        year INTEGER NOT NULL,
        total_budget NUMERIC(12,2) NOT NULL DEFAULT 0,
        google_ads_budget NUMERIC(12,2) NOT NULL DEFAULT 0,
        meta_ads_budget NUMERIC(12,2) NOT NULL DEFAULT 0,
        tiktok_ads_budget NUMERIC(12,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(company_id, month, year)
      );
    `);

    // ── Bütçe Logları ─────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS budget_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id),
        company_id UUID NOT NULL REFERENCES companies(id),
        action VARCHAR(10) NOT NULL CHECK (action IN ('created', 'updated')),
        old_value JSONB,
        new_value JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS integration_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        integration_id UUID REFERENCES integrations(id) ON DELETE CASCADE,
        company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
        platform VARCHAR(20) NOT NULL,
        account_name VARCHAR(255),
        brand_name VARCHAR(255),
        similarity NUMERIC(5,3),
        matched BOOLEAN,
        action VARCHAR(20) NOT NULL DEFAULT 'auto_accepted'
          CHECK (action IN ('auto_accepted', 'user_confirmed', 'user_cancelled')),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // notification_prefs kolonu ekle (varsa sessizce geç)
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_prefs JSONB DEFAULT '{}';
    `);

    // ── Anomali Ayarları ──────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS anomaly_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        budget_delta INTEGER NOT NULL DEFAULT 50,
        cpa_delta INTEGER NOT NULL DEFAULT 30,
        roas_delta INTEGER NOT NULL DEFAULT 25,
        email_on BOOLEAN NOT NULL DEFAULT true,
        platform_on BOOLEAN NOT NULL DEFAULT true,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(company_id)
      );
    `);

    // ── TV Kampanyaları ───────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS tv_campaigns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        brand_id UUID REFERENCES companies(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        video_filename VARCHAR(255),
        audio_fingerprint_hash VARCHAR(255),
        status VARCHAR(20) NOT NULL DEFAULT 'active'
          CHECK (status IN ('active', 'inactive', 'pending')),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── TV Medya Planları ─────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS tv_media_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id UUID REFERENCES tv_campaigns(id) ON DELETE SET NULL,
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        brand_id UUID REFERENCES companies(id) ON DELETE SET NULL,
        plan_name VARCHAR(255) NOT NULL,
        month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
        year INTEGER NOT NULL,
        total_budget NUMERIC(12,2) DEFAULT 0,
        total_grp NUMERIC(8,2) DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft', 'active', 'completed')),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── TV Plan Kalemleri ─────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS tv_plan_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_id UUID NOT NULL REFERENCES tv_media_plans(id) ON DELETE CASCADE,
        channel_name VARCHAR(100) NOT NULL,
        channel_code VARCHAR(50) NOT NULL,
        broadcast_date DATE,
        daypart VARCHAR(20),
        broadcast_time_start TIME,
        broadcast_time_end TIME,
        spot_duration INTEGER DEFAULT 30,
        grp NUMERIC(8,2) DEFAULT 0,
        spot_price NUMERIC(12,2) DEFAULT 0,
        total_cost NUMERIC(12,2) DEFAULT 0,
        status VARCHAR(20) NOT NULL DEFAULT 'planned'
          CHECK (status IN ('planned', 'detected', 'missed', 'pending')),
        detected_at TIMESTAMPTZ,
        screenshot_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── TV Tespitler ──────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS tv_detections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id UUID NOT NULL REFERENCES tv_campaigns(id) ON DELETE CASCADE,
        plan_item_id UUID REFERENCES tv_plan_items(id) ON DELETE SET NULL,
        channel_name VARCHAR(100) NOT NULL,
        detected_at TIMESTAMPTZ NOT NULL,
        confidence_score NUMERIC(5,4),
        screenshot_url TEXT,
        screenshot_expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── TV Erken Erişim ───────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS tv_early_access (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── Abonelikler ───────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        plan VARCHAR(20) NOT NULL CHECK (plan IN ('starter','growth','scale','brand_direct')),
        interval VARCHAR(10) NOT NULL CHECK (interval IN ('monthly','yearly')),
        amount NUMERIC(10,2) NOT NULL,
        currency VARCHAR(5) NOT NULL DEFAULT 'TRY',
        status VARCHAR(15) NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled','past_due','trialing')),
        sipay_recurring_id TEXT,
        current_period_start TIMESTAMPTZ,
        current_period_end TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── Ödeme İşlemleri ───────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        order_id VARCHAR(100) UNIQUE NOT NULL,
        sipay_invoice_id TEXT,
        amount NUMERIC(10,2) NOT NULL,
        currency VARCHAR(5) NOT NULL DEFAULT 'TRY',
        status VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','success','failed','refunded')),
        plan VARCHAR(20),
        interval VARCHAR(10),
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── Seed: Platform Admin ──────────────────────────────────────────────────
    const { rows: [adminUser] } = await client.query(
      `SELECT id FROM users WHERE email = 'enginborasahin@gmail.com'`
    );

    if (!adminUser) {
      const passwordHash = await bcrypt.hash('Admin2026!', 12);
      const { rows: [company] } = await client.query(
        `INSERT INTO companies (name, type) VALUES ('AdsLands', 'admin') RETURNING id`
      );
      await client.query(
        `INSERT INTO users (company_id, email, password_hash, is_platform_admin, is_company_admin, is_active)
         VALUES ($1, 'enginborasahin@gmail.com', $2, true, true, true)`,
        [company.id, passwordHash]
      );
      console.log('✅ Platform admin oluşturuldu: enginborasahin@gmail.com / Admin2026!');
    }

    console.log('✅ Veritabanı şeması hazır.');
  } finally {
    client.release();
  }
}

module.exports = migrate;
