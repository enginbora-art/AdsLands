const { checkCompanyActive } = require('../services/subscriptionService');

async function requireActiveSubscription(req, res, next) {
  try {
    const companyId = req.user?.company_id;
    if (!companyId) return res.status(401).json({ error: 'Kimlik doğrulama gerekli.' });

    const active = await checkCompanyActive(companyId);
    if (!active) {
      return res.status(403).json({
        error: 'Bu özellik için aktif abonelik gereklidir.',
        redirect: '/pricing',
      });
    }
    next();
  } catch (err) {
    console.error('[requireActiveSubscription] Hata:', err.message);
    next(); // hata durumunda bloklamadan devam et
  }
}

module.exports = requireActiveSubscription;
