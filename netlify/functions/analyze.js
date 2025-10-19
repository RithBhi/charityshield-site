exports.handler = async (event) => {
  try {
    const { text } = JSON.parse(event.body || '{}');
    if (!text || typeof text !== 'string') {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing text' }) };
    }

    const t = text.toLowerCase();

    // Red flags with weights
    const flags = [
      {re: /(gift\s*card|apple\s*card|steam\s*card|google\s*play)/, w: 30, why: 'Requests gift cards'},
      {re: /\bwire\b|\bwestern\s+union\b|moneygram/, w: 22, why: 'Asks for wire/money transfer'},
      {re: /\bcrypto|bitcoin|usdt|wallet address|metamask|binance\b/, w: 22, why: 'Requests crypto payment'},
      {re: /(cashapp|venmo|zelle)\b.*(dm|pm|message)/, w: 16, why: 'Peer-to-peer app via DM'},
      {re: /\burgent|now|immediately|today only|last chance|deadline|within\s+\d+\s*(minutes?|hours?)\b/, w: 12, why: 'High-pressure urgency'},
      {re: /\bmatch(?:ed)?\s*\d{2,3}%|match\s*(\d+x|[2-9]00%)\b/, w: 12, why: 'Unrealistic match promise'},
      {re: /\bprivacy\b.*(cannot|can.?t)\s*(show|share|provide)\s*(receipts|proof)/, w: 18, why: 'Claims privacy prevents receipts'},
      {re: /\b(no|cannot|won'?t)\s*(provide|show)\s*(ein|receipt|501\(c\)3)\b/, w: 16, why: 'Refuses EIN/receipts'},
      {re: /\b(dm|pm|direct message|telegram|whatsapp)\b/, w: 10, why: 'Moves to private messaging'},
      {re: /(bit\.ly|tinyurl\.com|shorturl|goo\.gl|t\.co|is\.gd|ow\.ly|rb\.gy)/, w: 14, why: 'Uses a URL shortener'},
      {re: /\bimpersonat(e|ing)|official support team|admin team\b/, w: 12, why: 'Possible impersonation'},
      {re: /\bhelpless child|widow|war orphan|terminal\b/, w: 8,  why: 'Emotion bait'},
    ];

    // Legit signals (subtract)
    const legit = [
      {re: /\b(501\s*\(c\)\s*3|501c3|non[-\s]?profit)\b/, w: 12, why: 'Mentions nonprofit status'},
      {re: /\bein\b[:\s]*\d{2}-\d{7}\b/, w: 20, why: 'Provides EIN format'},
      {re: /\b(receipt|tax[-\s]?deductible|donation receipt)\b/, w: 10, why: 'Mentions receipts/tax-deductible'},
      {re: /\b(donate|giving|support)\b.*\b(portal|official site|website)\b/, w: 8,  why: 'Directs to official portal'},
    ];

    let score = 0;
    const reasons = [];

    for (const f of flags){ if (f.re.test(t)) { score += f.w; reasons.push(f.why); } }
    for (const g of legit){ if (g.re.test(t)) { score -= g.w; reasons.push(`Counter-signal: ${g.why}`); } }

    // Short text & ALL-CAPS nudges
    if (t.split(/\s+/).length < 6) score = Math.min(60, score + 10);
    if (/[A-Z]{6,}/.test(text))   score = Math.min(100, score + 6);

    score = Math.max(0, Math.min(100, score));
    const label = score >= 45 ? 'Likely Scam' : 'Likely Legitimate';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, score, reasons: reasons.length ? reasons : ['No strong signals detected'] })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error' }) };
  }
};

