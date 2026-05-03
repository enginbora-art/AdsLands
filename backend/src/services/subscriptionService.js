const pool = require('../db');

// Şirketin aktif aboneliği veya devam eden trial'ı var mı?
// Marka, ajans altındaysa ajansın aboneliğine bakar.
async function checkCompanyActive(companyId) {
  const { rows: [result] } = await pool.query(`
    SELECT 1
    FROM companies c
    WHERE c.id = $1
      AND (
        c.trial_ends_at > NOW()
        OR EXISTS (
          SELECT 1 FROM subscriptions s
          WHERE s.company_id = c.id
            AND s.status = 'active'
            AND s.current_period_end > NOW()
        )
        OR EXISTS (
          SELECT 1 FROM connections conn
          JOIN companies agency ON agency.id = conn.agency_company_id
          WHERE conn.brand_company_id = c.id
            AND (
              agency.trial_ends_at > NOW()
              OR EXISTS (
                SELECT 1 FROM subscriptions s2
                WHERE s2.company_id = agency.id
                  AND s2.status = 'active'
                  AND s2.current_period_end > NOW()
              )
            )
        )
      )
    LIMIT 1
  `, [companyId]);
  return !!result;
}

// Aktif şirketlerin entegrasyonlarını çeken SQL (metricsFetcher için)
// companyId verilirse sadece o şirketin entegrasyonlarına filtreler
const ACTIVE_INTEGRATIONS_SQL = (withCompanyFilter = false) => `
  SELECT i.*
  FROM integrations i
  JOIN companies c ON c.id = i.company_id
  WHERE i.is_active = true
    AND i.status != 'disconnected'
  ${withCompanyFilter ? 'AND i.company_id = $1' : ''}
    AND (
      c.trial_ends_at > NOW()
      OR EXISTS (
        SELECT 1 FROM subscriptions s
        WHERE s.company_id = c.id
          AND s.status = 'active'
          AND s.current_period_end > NOW()
      )
      OR EXISTS (
        SELECT 1 FROM connections conn
        JOIN companies agency ON agency.id = conn.agency_company_id
        WHERE conn.brand_company_id = c.id
          AND (
            agency.trial_ends_at > NOW()
            OR EXISTS (
              SELECT 1 FROM subscriptions s2
              WHERE s2.company_id = agency.id
                AND s2.status = 'active'
                AND s2.current_period_end > NOW()
            )
          )
      )
    )
`;

module.exports = { checkCompanyActive, ACTIVE_INTEGRATIONS_SQL };
