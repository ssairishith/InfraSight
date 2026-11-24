// backend/routes/render.js
const express = require('express');
const router = express.Router();

// Node ≥18 already provides a global fetch
// (no import needed)

// ------------------------------------------------------------------
// Helper: fetch with timeout (optional)
async function fetchWithTimeout(url, opts = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...opts, signal: controller.signal });
    return resp;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * GET /render/health
 * Proxies the health check of the AI Analyzer.
 *   - Returns 200 + JSON on success.
 *   - Returns 502 with a clear message on any failure
 *     (rate‑limit, non‑JSON, network error, etc.).
 */
router.get('/health', async (req, res) => {
  const analyzerUrl = process.env.ANALYZER_URL || 'http://localhost:5000';
  const healthUrl = `${analyzerUrl}/health`;

  try {
    // Add a sensible User‑Agent; some CDNs block default “node-fetch”.
    const resp = await fetchWithTimeout(
      healthUrl,
      { headers: { 'User-Agent': 'infra-sight-backend/1.0' } },
      8000
    );

    // ------------------------------------------------------------
    // 1️⃣ Non‑OK status (e.g., 429 Too Many Requests)
    // ------------------------------------------------------------
    if (!resp.ok) {
      const body = await resp.text();
      const errMsg =
        resp.status === 429
          ? 'Rate limit exceeded – Analyzer returned 429 Too Many Requests'
          : `Analyzer returned ${resp.status}`;
      return res.status(502).json({ error: errMsg, detail: body.trim() });
    }

    // ------------------------------------------------------------
    // 2️⃣ Verify we really got JSON
    // ------------------------------------------------------------
    const ct = resp.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      const raw = await resp.text();
      return res.status(502).json({
        error: 'Analyzer returned non‑JSON payload',
        detail: raw.trim().slice(0, 200) + (raw.length > 200 ? '…' : ''),
      });
    }

    // ------------------------------------------------------------
    // 3️⃣ Parse JSON (with a safety‑net)
    // ------------------------------------------------------------
    let data;
    try {
      data = await resp.json();
    } catch (jsonErr) {
      const raw = await resp.text();
      return res.status(502).json({
        error: 'Invalid JSON from Analyzer',
        detail: raw.trim().slice(0, 200) + (raw.length > 200 ? '…' : ''),
      });
    }

    // ------------------------------------------------------------
    // 4️⃣ Success – forward the payload
    // ------------------------------------------------------------
    res.status(resp.status).json(data);
  } catch (err) {
    console.error('Render health check failed:', err.message);
    res
      .status(502)
      .json({ error: 'Analyzer service unreachable', detail: err.message });
  }
});

module.exports = router;
