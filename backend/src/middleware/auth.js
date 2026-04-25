const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Oturum açmanız gerekiyor.' });
  }
  try {
    req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Geçersiz veya süresi dolmuş token.' });
  }
};

// Platform admin (tüm sistemi yönetir)
const platformAdmin = (req, res, next) => {
  authMiddleware(req, res, () => {
    if (!req.user.is_platform_admin) {
      return res.status(403).json({ error: 'Platform yöneticisi yetkisi gerekiyor.' });
    }
    next();
  });
};

// Şirket admini veya belirli bir permission
const requirePermission = (permission) => (req, res, next) => {
  authMiddleware(req, res, () => {
    if (req.user.is_platform_admin || req.user.is_company_admin) return next();
    if (!req.user.permissions?.includes(permission)) {
      return res.status(403).json({ error: 'Bu işlem için yetkiniz yok.' });
    }
    next();
  });
};

module.exports = authMiddleware;
module.exports.platformAdmin = platformAdmin;
module.exports.requirePermission = requirePermission;
