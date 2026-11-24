// backend/routes/render.js
const express = require('express');
const router = express.Router();


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
        const resp = await fetchWithTimeout(healthUrl, {}, 8000);
        const data = await resp.json();               // assume JSON health payload
        // Forward exactly what the analyzer returns (status 200)
        res.status(resp.status).json(data);
    } catch (err) {
        console.error('Render health check failed:', err.message);
        res.status(502).json({
            error: 'Analyzer service unreachable',
            detail: err.message,
        });
    }
});

module.exports = router;
