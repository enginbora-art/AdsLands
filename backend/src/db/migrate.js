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

    // status kolonu — 'connected' | 'disconnected' | 'expiring'
    await client.query(`
      ALTER TABLE integrations ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'connected';
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

    // Platform constraint'ini güncelle (adform + linkedin + dv360 ekle)
    await client.query(`
      DO $$
      BEGIN
        ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_platform_check;
        ALTER TABLE integrations ADD CONSTRAINT integrations_platform_check
          CHECK (platform IN ('google_ads', 'meta', 'tiktok', 'google_analytics', 'appsflyer', 'adjust', 'adform', 'linkedin', 'dv360', 'cm360'));
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);

    // ── Platform Mappings (öğrenen eşleştirme sistemi) ───────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS platform_mappings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
        raw_value TEXT NOT NULL,
        platform VARCHAR(50) NOT NULL,
        ad_model_prefix TEXT,
        ad_model TEXT,
        match_count INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(company_id, raw_value)
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS platform_mappings_company_idx
        ON platform_mappings (company_id);
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

    // tv_detections ve tv_early_access tabloları kaldırıldı (TV Ad Verification özelliği silindi)
    // Mevcut veritabanlarında varsa tutulur, yeni kurulumda oluşturulmaz.

    // tv_plan_items için AI öneri etiketi kolonu
    await client.query(`
      ALTER TABLE tv_plan_items ADD COLUMN IF NOT EXISTS ai_suggestion_id TEXT;
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

    // ── Ajans şirketleri için varsayılan sektör ───────────────────────────────────
    await client.query(`
      UPDATE companies SET sector = 'Ajans'
      WHERE type = 'agency' AND (sector IS NULL OR sector = '');
    `);

    // ── trial_ends_at (şirket kaydından 30 gün) ──────────────────────────────────
    await client.query(`
      ALTER TABLE companies ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
    `);

    // ── cancel_at_period_end (iptal, dönem sonuna kadar erişim açık) ─────────────
    await client.query(`
      ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;
    `);

    // ── Faturalar ─────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        transaction_id UUID REFERENCES payment_transactions(id) ON DELETE SET NULL,
        invoice_number VARCHAR(30) NOT NULL UNIQUE,
        amount NUMERIC(10,2) NOT NULL,
        currency VARCHAR(5) NOT NULL DEFAULT 'TRY',
        plan VARCHAR(20),
        period_start TIMESTAMPTZ,
        period_end TIMESTAMPTZ,
        pdf_path TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── KPI kolonları budget_channels tablosuna ──────────────────────────────
    await client.query(`
      ALTER TABLE budget_channels ADD COLUMN IF NOT EXISTS kpi_roas       DECIMAL;
      ALTER TABLE budget_channels ADD COLUMN IF NOT EXISTS kpi_cpa        DECIMAL;
      ALTER TABLE budget_channels ADD COLUMN IF NOT EXISTS kpi_ctr        DECIMAL;
      ALTER TABLE budget_channels ADD COLUMN IF NOT EXISTS kpi_impression BIGINT;
      ALTER TABLE budget_channels ADD COLUMN IF NOT EXISTS kpi_conversion INTEGER;
    `);

    // ── AI kullanım logları ───────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_usage_logs (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
        feature       VARCHAR(50) NOT NULL,
        input_tokens  INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        cost_usd      NUMERIC(10,6) NOT NULL DEFAULT 0,
        cost_try      NUMERIC(10,4) NOT NULL DEFAULT 0,
        wait_ms       INTEGER,
        process_ms    INTEGER,
        status        VARCHAR(20) DEFAULT 'completed',
        created_at    TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS ai_usage_logs_company_date
        ON ai_usage_logs (company_id, created_at);
    `);
    // timing columns for existing tables (idempotent)
    await client.query(`
      ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS wait_ms    INTEGER;
      ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS process_ms INTEGER;
      ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS status     VARCHAR(20) DEFAULT 'completed';
      ALTER TABLE ai_usage_logs ADD COLUMN IF NOT EXISTS plan_id    UUID REFERENCES tv_media_plans(id) ON DELETE SET NULL;
    `);

    // Genişletilmiş plan listesi — superseded by rename migration below; keep DROP only for idempotency
    await client.query(`ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check`);

    // ── Plan rename migration ─────────────────────────────────────────────────
    // starter→agency_basic, growth→agency_pro, scale→agency_enterprise
    // brand_direct→brand_pro, brand_pro→brand_enterprise
    // NOTE: DROP constraint first so intermediate values are allowed.
    //       brand_pro→brand_enterprise MUST run before brand_direct→brand_pro.
    await client.query(`ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check`);
    await client.query(`UPDATE subscriptions SET plan = 'agency_basic'      WHERE plan = 'starter'`);
    await client.query(`UPDATE subscriptions SET plan = 'agency_pro'        WHERE plan = 'growth'`);
    await client.query(`UPDATE subscriptions SET plan = 'agency_enterprise' WHERE plan = 'scale'`);
    await client.query(`UPDATE subscriptions SET plan = 'brand_enterprise'  WHERE plan = 'brand_pro'`);
    await client.query(`UPDATE subscriptions SET plan = 'brand_pro'         WHERE plan = 'brand_direct'`);
    await client.query(`UPDATE payment_transactions SET plan = 'agency_basic'      WHERE plan = 'starter'`);
    await client.query(`UPDATE payment_transactions SET plan = 'agency_pro'        WHERE plan = 'growth'`);
    await client.query(`UPDATE payment_transactions SET plan = 'agency_enterprise' WHERE plan = 'scale'`);
    await client.query(`UPDATE payment_transactions SET plan = 'brand_enterprise'  WHERE plan = 'brand_pro'`);
    await client.query(`UPDATE payment_transactions SET plan = 'brand_pro'         WHERE plan = 'brand_direct'`);
    await client.query(`ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_check
      CHECK (plan IN ('agency_basic','agency_pro','agency_enterprise','brand_basic','brand_pro','brand_enterprise'))`);

    // ── Şifre sıfırlama token'ları ────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token      VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used       BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS prt_token_idx ON password_reset_tokens (token);
    `);

    // ── Gün içi metrik güncellemesi için updated_at ───────────────────────────
    await client.query(`
      ALTER TABLE ad_metrics ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    `);

    // ── Kampanyalar ───────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        brand_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        total_budget NUMERIC(12,2) NOT NULL DEFAULT 0,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft', 'ready', 'active', 'completed')),
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS campaign_channels (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
        platform VARCHAR(30) NOT NULL,
        external_campaign_id VARCHAR(255),
        external_campaign_name VARCHAR(255),
        allocated_budget NUMERIC(12,2) DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(campaign_id, platform)
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS campaigns_brand_id_idx ON campaigns (brand_id);`);
    await client.query(`
      ALTER TABLE campaign_channels ADD COLUMN IF NOT EXISTS kpi_roas       DECIMAL;
      ALTER TABLE campaign_channels ADD COLUMN IF NOT EXISTS kpi_cpa        DECIMAL;
      ALTER TABLE campaign_channels ADD COLUMN IF NOT EXISTS kpi_ctr        DECIMAL;
      ALTER TABLE campaign_channels ADD COLUMN IF NOT EXISTS kpi_impression BIGINT;
      ALTER TABLE campaign_channels ADD COLUMN IF NOT EXISTS kpi_conversion INTEGER;
    `);
    await client.query(`
      ALTER TABLE campaign_channels ADD COLUMN IF NOT EXISTS planned_kpi        INTEGER;
      ALTER TABLE campaign_channels ADD COLUMN IF NOT EXISTS kpi_type           VARCHAR(20);
      ALTER TABLE campaign_channels ADD COLUMN IF NOT EXISTS buying_type        VARCHAR(10);
      ALTER TABLE campaign_channels ADD COLUMN IF NOT EXISTS unit_price         DECIMAL(10,4);
      ALTER TABLE campaign_channels ADD COLUMN IF NOT EXISTS targeting          TEXT;
      ALTER TABLE campaign_channels ADD COLUMN IF NOT EXISTS frequency          VARCHAR(50);
      ALTER TABLE campaign_channels ADD COLUMN IF NOT EXISTS imported_from_plan BOOLEAN DEFAULT false;
      ALTER TABLE campaign_channels ADD COLUMN IF NOT EXISTS match_status       VARCHAR(10) DEFAULT NULL;
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS campaign_logs (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id      UUID REFERENCES campaigns(id) ON DELETE SET NULL,
        user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        brand_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        actor_company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        action           VARCHAR(50) NOT NULL,
        campaign_name    VARCHAR(255),
        platform         VARCHAR(30),
        new_value        JSONB,
        created_at       TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS campaign_logs_brand_idx ON campaign_logs (brand_company_id);
      CREATE INDEX IF NOT EXISTS campaign_logs_actor_idx ON campaign_logs (actor_company_id);
    `);

    // ── Plan fiyatları tablosu ────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS plan_prices (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_key            VARCHAR(40) NOT NULL UNIQUE,
        monthly_price       NUMERIC(12,2) NOT NULL,
        yearly_price        NUMERIC(12,2) NOT NULL,
        yearly_discount_pct NUMERIC(5,2) NOT NULL DEFAULT 20,
        is_active           BOOLEAN NOT NULL DEFAULT true,
        updated_at          TIMESTAMPTZ DEFAULT NOW(),
        updated_by          UUID REFERENCES users(id) ON DELETE SET NULL
      );
    `);

    // ── Seed: plan_prices (insert only if row missing) ────────────────────────
    const planSeeds = [
      ['agency_basic',      20000, 16000, 20],
      ['agency_pro',        45000, 36000, 20],
      ['agency_enterprise', 70000, 56000, 20],
      ['brand_basic',       20000, 16000, 20],
      ['brand_pro',          1500,  1200, 20],
      ['brand_enterprise',  45000, 36000, 20],
    ];
    for (const [key, monthly, yearly, discount] of planSeeds) {
      await client.query(
        `INSERT INTO plan_prices (plan_key, monthly_price, yearly_price, yearly_discount_pct)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (plan_key) DO NOTHING`,
        [key, monthly, yearly, discount]
      );
    }

    // ── Uygulama ayarları tablosu ─────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key         VARCHAR(80) PRIMARY KEY,
        value       TEXT NOT NULL,
        description TEXT,
        updated_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_by  UUID REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    const appSeeds = [
      ['trial_duration_days',             '30',   'Yeni şirket trial süresi (gün)'],
      ['kdv_rate',                         '0.20', 'Fatura KDV oranı (0.20 = %20)'],
      ['jwt_expires_in',                   '7d',   'JWT token geçerlilik süresi (ör: 7d, 24h)'],
      ['setup_link_expiry_hours',          '72',   'Şirket kurulum linki geçerlilik süresi (saat)'],
      ['password_reset_expiry_hours',      '1',    'Şifre sıfırlama linki geçerlilik süresi (saat)'],
      ['auth_rate_limit_max',              '20',   'Auth endpoint başına 15 dakikada max istek sayısı'],
      ['auth_rate_limit_window_minutes',   '15',   'Auth rate limit penceresi (dakika)'],
      ['notification_dedup_hours',         '20',   'Aynı bildirim tekrar gönderim engeli (saat)'],
      ['meta_token_warning_days',          '15',   'Meta token süresi dolmadan kaç gün önce uyarı'],
      ['trial_warning_days',               '7',    'Trial bitiminden kaç gün önce uyarı'],
      ['anomaly_budget_delta',             '50',   'Anomali: bütçe sapma eşiği (%)'],
      ['anomaly_cpa_delta',                '30',   'Anomali: CPA sapma eşiği (%)'],
      ['anomaly_roas_delta',               '25',   'Anomali: ROAS sapma eşiği (%)'],
    ];
    for (const [key, value, description] of appSeeds) {
      await client.query(
        `INSERT INTO app_settings (key, value, description)
         VALUES ($1, $2, $3)
         ON CONFLICT (key) DO NOTHING`,
        [key, value, description]
      );
    }

    // ── Sektör benchmarkları tablosu ──────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS sector_benchmarks (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sector     VARCHAR(60) NOT NULL,
        metric     VARCHAR(30) NOT NULL,
        value      NUMERIC(10,4) NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE (sector, metric)
      )
    `);

    const benchSeeds = [
      ['E-Ticaret',   'roas', 2.9],  ['E-Ticaret',   'cpa', 85],  ['E-Ticaret',   'ctr', 2.5], ['E-Ticaret',   'conv_rate', 2.8],
      ['Finans',      'roas', 2.1],  ['Finans',      'cpa', 220], ['Finans',      'ctr', 1.8], ['Finans',      'conv_rate', 1.5],
      ['Perakende',   'roas', 3.2],  ['Perakende',   'cpa', 65],  ['Perakende',   'ctr', 2.8], ['Perakende',   'conv_rate', 3.1],
      ['Teknoloji',   'roas', 2.5],  ['Teknoloji',   'cpa', 150], ['Teknoloji',   'ctr', 1.9], ['Teknoloji',   'conv_rate', 2.1],
      ['Sağlık',      'roas', 2.3],  ['Sağlık',      'cpa', 130], ['Sağlık',      'ctr', 2.0], ['Sağlık',      'conv_rate', 2.0],
      ['Turizm',      'roas', 2.7],  ['Turizm',      'cpa', 95],  ['Turizm',      'ctr', 2.3], ['Turizm',      'conv_rate', 2.4],
      ['Eğitim',      'roas', 2.0],  ['Eğitim',      'cpa', 110], ['Eğitim',      'ctr', 2.2], ['Eğitim',      'conv_rate', 1.8],
      ['Otomotiv',    'roas', 1.8],  ['Otomotiv',    'cpa', 180], ['Otomotiv',    'ctr', 1.5], ['Otomotiv',    'conv_rate', 1.2],
      ['Gayrimenkul', 'roas', 1.9],  ['Gayrimenkul', 'cpa', 250], ['Gayrimenkul', 'ctr', 1.4], ['Gayrimenkul', 'conv_rate', 1.0],
    ];
    for (const [sector, metric, value] of benchSeeds) {
      await client.query(
        `INSERT INTO sector_benchmarks (sector, metric, value)
         VALUES ($1, $2, $3)
         ON CONFLICT (sector, metric) DO NOTHING`,
        [sector, metric, value]
      );
    }

    // campaign_logs.user_id nullable yap (cron anomali tespiti user_id olmadan yazar)
    await client.query(`
      DO $$
      BEGIN
        ALTER TABLE campaign_logs ALTER COLUMN user_id DROP NOT NULL;
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);

    // ── campaign_channels: ad_model kolonu ve yeni unique constraint ─────────
    await client.query(`
      ALTER TABLE campaign_channels ADD COLUMN IF NOT EXISTS ad_model VARCHAR(100) NOT NULL DEFAULT '';
    `);
    await client.query(`
      DO $$
      BEGIN
        ALTER TABLE campaign_channels DROP CONSTRAINT IF EXISTS campaign_channels_campaign_id_platform_key;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'campaign_channels_campaign_id_platform_ad_model_key'
        ) THEN
          ALTER TABLE campaign_channels
            ADD CONSTRAINT campaign_channels_campaign_id_platform_ad_model_key
            UNIQUE (campaign_id, platform, ad_model);
        END IF;
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);

    // ── Kampanya Gerçekleşenleri (Planlanan vs Gerçekleşen) ───────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS campaign_actuals (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_channel_id UUID NOT NULL REFERENCES campaign_channels(id) ON DELETE CASCADE,
        date                DATE NOT NULL,
        actual_spend        NUMERIC(12,2) DEFAULT 0,
        actual_impressions  BIGINT DEFAULT 0,
        actual_clicks       INTEGER DEFAULT 0,
        actual_views        INTEGER DEFAULT 0,
        vcr                 NUMERIC(5,2) DEFAULT 0,
        cpc                 NUMERIC(10,4) DEFAULT 0,
        cpm                 NUMERIC(10,4) DEFAULT 0,
        cpv                 NUMERIC(10,4) DEFAULT 0,
        source              VARCHAR(20) DEFAULT 'api',
        fetched_at          TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(campaign_channel_id, date)
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS campaign_actuals_channel_date_idx
        ON campaign_actuals (campaign_channel_id, date);
    `);

    // ── campaigns.status constraint: 'ready' ekle ────────────────────────────
    await client.query(`
      DO $$
      BEGIN
        ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_status_check;
        ALTER TABLE campaigns ADD CONSTRAINT campaigns_status_check
          CHECK (status IN ('draft', 'ready', 'active', 'completed'));
      EXCEPTION WHEN others THEN NULL;
      END $$;
    `);

    // ── Seed: Platform Admin ──────────────────────────────────────────────────
    const adminEmail    = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_SEED_PASSWORD;

    if (!adminEmail) {
      console.warn('[migrate] ADMIN_EMAIL tanımlı değil — platform admin seed atlandı.');
    } else {
      const { rows: [adminUser] } = await client.query(
        `SELECT id FROM users WHERE email = $1`, [adminEmail]
      );

      if (!adminUser) {
        if (!adminPassword) throw new Error('ADMIN_SEED_PASSWORD env var zorunludur (ilk kurulum).');
        const passwordHash = await bcrypt.hash(adminPassword, 12);
        const { rows: [company] } = await client.query(
          `INSERT INTO companies (name, type) VALUES ('AdsLands', 'admin') RETURNING id`
        );
        await client.query(
          `INSERT INTO users (company_id, email, password_hash, is_platform_admin, is_company_admin, is_active)
           VALUES ($1, $2, $3, true, true, true)`,
          [company.id, adminEmail, passwordHash]
        );
        console.log(`✅ Platform admin oluşturuldu: ${adminEmail}`);
      }
    }

    console.log('✅ Veritabanı şeması hazır.');
  } finally {
    client.release();
  }
}

module.exports = migrate;
