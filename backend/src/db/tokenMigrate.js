/**
 * Tek seferlik migration: plaintext token'ları AES-256-GCM ile şifrele.
 * Çalıştır: node src/db/tokenMigrate.js
 * ENCRYPTION_KEY .env'de set edilmiş olmalı.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const pool   = require('../db');
const { encrypt, decrypt } = require('../services/tokenEncryption');

async function migrate() {
  console.log('🔐 Token migration başlıyor...');

  const { rows } = await pool.query(`
    SELECT id, platform, access_token, refresh_token, extra
    FROM integrations
    WHERE is_active = true
  `);

  console.log(`  ${rows.length} entegrasyon bulundu.`);
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    // Zaten şifreli mi? (iv:authTag:data formatı)
    const isEncrypted = v => v && v.includes(':') && v.split(':').length === 3;

    const newAccess  = (!row.access_token  || isEncrypted(row.access_token))  ? null : encrypt(row.access_token);
    const newRefresh = (!row.refresh_token || isEncrypted(row.refresh_token)) ? null : encrypt(row.refresh_token);

    // Adform extra.password şifreleme
    let newExtra = null;
    if (row.extra?.password && !isEncrypted(row.extra.password)) {
      newExtra = { ...row.extra, password: encrypt(row.extra.password) };
    }

    if (!newAccess && !newRefresh && !newExtra) { skipped++; continue; }

    await pool.query(
      `UPDATE integrations SET
         access_token  = COALESCE($1, access_token),
         refresh_token = COALESCE($2, refresh_token),
         extra         = COALESCE($3::jsonb, extra)
       WHERE id = $4`,
      [newAccess, newRefresh, newExtra ? JSON.stringify(newExtra) : null, row.id]
    );
    updated++;
    console.log(`  ✅ ${row.platform} (${row.id.slice(0, 8)}…) şifrelendi`);
  }

  console.log(`\n✅ Migration tamamlandı: ${updated} güncellendi, ${skipped} atlandı (zaten şifreli).`);
  await pool.end();
}

migrate().catch(err => {
  console.error('Migration hatası:', err.message);
  process.exit(1);
});
