const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

function getKey() {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY env değişkeni eksik veya yanlış formatta (64 hex char gerekli).');
  }
  return Buffer.from(hex, 'hex');
}

function encrypt(text) {
  if (!text) return null;
  const key = getKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decrypt(encryptedText) {
  if (!encryptedText) return null;
  // Plaintext migration path: eğer eski format ise (: içermiyorsa) direkt dön
  if (!encryptedText.includes(':')) return encryptedText;
  try {
    const key = getKey();
    const parts = encryptedText.split(':');
    if (parts.length !== 3) return encryptedText;
    const [ivHex, authTagHex, encrypted] = parts;
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('[tokenEncryption] Decrypt hatası — plaintext fallback:', err.message);
    return encryptedText;
  }
}

// DB'den okunan integration nesnesini decrypt eder (platform servislerine geçmeden önce çağır)
function decryptIntegration(integration) {
  if (!integration) return integration;
  const result = { ...integration };
  if (result.access_token)  result.access_token  = decrypt(result.access_token);
  if (result.refresh_token) result.refresh_token = decrypt(result.refresh_token);
  if (result.extra?.password) {
    result.extra = { ...result.extra, password: decrypt(result.extra.password) };
  }
  return result;
}

module.exports = { encrypt, decrypt, decryptIntegration };
