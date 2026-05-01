require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const bcrypt = require('bcrypt');
const pool = require('./index');

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL || 'admin@adslands.com';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const company_name = 'AdsLands';

  try {
    const exists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length > 0) {
      console.log('Admin zaten mevcut:', email);
      process.exit(0);
    }

    const password_hash = await bcrypt.hash(password, 12);
    await pool.query(
      "INSERT INTO users (email, password_hash, role, company_name) VALUES ($1, $2, 'admin', $3)",
      [email, password_hash, company_name]
    );
    console.log('Admin oluşturuldu:', email, '(şifre loglara yazılmaz)'); // güvenlik: şifreyi loga yazmıyoruz
    process.exit(0);
  } catch (err) {
    console.error('Hata:', err.message);
    process.exit(1);
  }
}

seedAdmin();
