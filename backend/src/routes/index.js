const express = require('express');
const router = express.Router();
const data = require('../data/mockData');

router.get('/hello', (req, res) => res.json({ message: 'Merhaba! Backend çalışıyor.' }));

router.get('/metrics', (req, res) => res.json(data.metrics));
router.get('/weekly-spend', (req, res) => res.json(data.weeklySpend));
router.get('/roas', (req, res) => res.json(data.roasData));
router.get('/sparklines', (req, res) => res.json(data.sparklines));
router.get('/anomalies', (req, res) => res.json(data.anomalies));
router.get('/channels', (req, res) => res.json({ ...data.channels, comparisonTable: data.comparisonTable }));
router.get('/ai-report', (req, res) => res.json(data.aiReport));
router.get('/tv-broadcast', (req, res) => res.json(data.tvBroadcast));
router.get('/budget', (req, res) => res.json(data.budget));
router.get('/benchmark', (req, res) => res.json(data.benchmark));
router.get('/reports', (req, res) => res.json(data.reports));
router.get('/agency', (req, res) => res.json(data.agency));
router.get('/settings', (req, res) => res.json(data.settings));
router.put('/settings', (req, res) => {
  Object.assign(data.settings, req.body);
  res.json(data.settings);
});

module.exports = router;
