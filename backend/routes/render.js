// backend/routes/render.js
const express = require('express');
const router = express.Router();
// Using the built‑in global fetch (Node ≥18)

// Helper: simple fetch with timeout (optional)
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
 * Returns 200 + JSON if the analyzer replies,
 * otherwise returns 502 (Bad Gateway) with a short error payload.
 */
router.get('/health', async (req, res) => {
    const analyzerUrl = process.env.ANALYZER_URL || 'http://localhost:5000';
    const healthUrl = `${analyzerUrl}/health`;

    try {
        const resp = await fetchWithTimeout(
            healthUrl,
            { headers: { 'User-Agent': 'infrasight-backend/1.0', 'Accept': 'application/json' } },
            8000
        );
        // If the analyzer returns 429 (Too Many Requests) or any non‑JSON body,
        // we forward a clear error instead of trying to parse JSON.
        if (!resp.ok) {
            const textBody = await resp.text();
            const errMsg = resp.status === 429
                ? 'Rate limit exceeded – Analyzer returned 429 Too Many Requests'
                : `Analyzer returned ${resp.status}`;
            return res.status(502).json({ error: errMsg, detail: textBody.trim() });
        }
        // Try to parse JSON – if it fails, fall back to plain text.
        let data;
        try {
            data = await resp.json();
        } catch (jsonErr) {
            const txt = await resp.text();
            return res.status(502).json({ error: 'Invalid JSON from Analyzer', detail: txt.trim() });
        }
        res.status(resp.status).json(data);
    } catch (err) {
        console.error('Render health check failed:', err.message);
        res.status(502).json({ error: 'Analyzer service unreachable', detail: err.message });
    }
});


module.exports = router;
