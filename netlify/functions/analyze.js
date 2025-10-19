exports.handler = async (event) => {
  try {
    const { text } = JSON.parse(event.body || '{}');
    if (!text || typeof text !== 'string') {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing text' }) };
    }
    const redFlags = ['gift card', 'wire', 'urgent', 'dm', 'credit card', 'short link', 'match 500', 'privacy'];
    const score = redFlags.reduce((s, kw) => s + (text.toLowerCase().includes(kw) ? 12 : 0), 5);
    const clipped = Math.max(0, Math.min(100, score));
    const label = clipped >= 55 ? 'Likely Scam' : 'Likely Legitimate';
    const reasons = redFlags.filter(kw => text.toLowerCase().includes(kw));
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, score: clipped, reasons: reasons.length ? reasons : ['No major red flags detected'] })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
  }
};
