const pool = require('../db');
const { getAiLimit } = require('../config/plans');

// $/M tokens per model
const MODEL_RATES = {
  'claude-sonnet-4-6': { input: 3,  output: 15 },
  'claude-opus-4-7':   { input: 15, output: 75 },
};

async function getCompanyPlan(companyId) {
  const { rows: [sub] } = await pool.query(
    `SELECT plan, status FROM subscriptions
     WHERE company_id = $1 AND status IN ('active','trialing')
     ORDER BY created_at DESC LIMIT 1`,
    [companyId]
  );
  if (!sub) return 'none';
  return sub.status === 'trialing' ? 'trial' : sub.plan;
}

function checkAiLimit(feature) {
  return async (req, res, next) => {
    const companyId = req.user.company_id;
    try {
      const plan  = await getCompanyPlan(companyId);
      const limit = getAiLimit(plan, feature);

      const { rows: [row] } = await pool.query(
        `SELECT COUNT(*)::int AS count FROM ai_usage_logs
         WHERE company_id = $1
           AND feature    = $2
           AND created_at >= date_trunc('month', CURRENT_DATE)`,
        [companyId, feature]
      );
      const used = row?.count ?? 0;

      if (used >= limit) {
        return res.status(429).json({
          error:       'Bu ay için AI kullanım limitinize ulaştınız.',
          feature,
          limit,
          used,
          plan,
          reset:       'ay başı',
          upgrade_url: '/pricing',
        });
      }

      req.aiCtx = { companyId, userId: req.user.user_id, feature, plan, limit, used };
      next();
    } catch (err) {
      console.error('[aiLimit]', err.message);
      // Conservative fallback — block on error instead of allowing through
      return res.status(503).json({ error: 'Kullanım limiti kontrol edilemedi, lütfen tekrar deneyin.' });
    }
  };
}

async function logAiUsage(companyId, userId, feature, inputTokens, outputTokens, model, timing = {}, context = {}) {
  try {
    const usdRate   = parseFloat(process.env.USDTRY_RATE) || 38;
    const rates     = MODEL_RATES[model] || MODEL_RATES['claude-sonnet-4-6'];
    const costUsd   = (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000;
    const costTry   = costUsd * usdRate;
    const { waitMs = null, processMs = null, status = 'completed' } = timing;
    const { plan_id = null } = context;
    await pool.query(
      `INSERT INTO ai_usage_logs
         (company_id, user_id, feature, input_tokens, output_tokens, cost_usd, cost_try, wait_ms, process_ms, status, plan_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [companyId, userId, feature, inputTokens, outputTokens, costUsd, costTry, waitMs, processMs, status, plan_id]
    );
  } catch (err) {
    console.error('[logAiUsage]', err.message);
  }
}

module.exports = { checkAiLimit, logAiUsage, getCompanyPlan };
