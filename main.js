// ===== Smooth scroll helpers =====
function scrollToDemo(){ document.querySelector('#demo')?.scrollIntoView({behavior:'smooth'}); }
function scrollToAbout(){ document.querySelector('#about')?.scrollIntoView({behavior:'smooth'}); }

// ===== On load: typed headline, fade-ins, counters, charts =====
document.addEventListener('DOMContentLoaded', () => {
  // Typed headline
  if (window.Typed) {
    new Typed('#typed-headline', {
      strings: [
        'Protecting donors.',
        'Spotting fake campaigns.',
        'CharityShield&nbsp;AI: Trust first.'
      ],
      typeSpeed: 35,
      backSpeed: 20,
      backDelay: 1200,
      loop: true
    });
  }

  // Fade-in on scroll
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => e.isIntersecting && e.target.classList.add('visible'));
  }, { threshold: 0.15 });
  document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

  // Counters
  document.querySelectorAll('.counter').forEach(counter => {
    const target = +counter.dataset.target;
    let current = 0;
    const step = Math.max(1, Math.floor(target / 60));
    const tick = () => {
      current += step;
      if (current >= target) current = target;
      counter.textContent = current;
      if (current < target) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  // ECharts: trends
  const trendsEl = document.getElementById('fraudTrendsChart');
  if (trendsEl && window.echarts) {
    const chart = echarts.init(trendsEl);
    chart.setOption({
      tooltip: {},
      xAxis: { type: 'category', data: ['2019','2020','2021','2022','2023','2024'] },
      yAxis: { type: 'value' },
      series: [{ type: 'line', data: [60, 75, 90, 120, 180, 220] }]
    });
  }
  // ECharts: methods
  const methodsEl = document.getElementById('fraudMethodsChart');
  if (methodsEl && window.echarts) {
    const chart2 = echarts.init(methodsEl);
    chart2.setOption({
      tooltip: {},
      xAxis: { type: 'category', data: ['Fake pages','Phishing','Impersonation','Emotion bait'] },
      yAxis: { type: 'value' },
      series: [{ type: 'bar', data: [65, 50, 70, 40] }]
    });
  }
});

// ===== Sample loader for demo =====
function loadSample(n){
  const el = document.getElementById('demoInput');
  const samples = {
    1: 'URGENT! Help my cousin’s surgery TODAY. Send gift cards or wire money to this account. We cannot show receipts due to privacy.',
    2: 'Limited-time fundraiser! If you donate in the next 30 minutes we will match 500%. Click this short link and DM your credit card details.',
    3: 'Our 501(c)(3) after-school program is raising funds for laptops. EIN 12-3456789. Donate via our verified portal; receipts are automatically sent.'
  };
  el.value = samples[n] || '';
}

// ===== Analyze with serverless first; fallback to heuristic mock =====
async function analyzeText(){
  const input = (document.getElementById('demoInput').value || '').trim();
  const results = document.getElementById('demoResults');

  if (!input) {
    results.innerHTML = '<p class="text-slate-500">Please paste some text first.</p>';
    return;
  }

  // Try Netlify function
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const resp = await fetch('/.netlify/functions/analyze', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ text: input }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (resp.ok) {
      const data = await resp.json();
      renderResult(data);
      return;
    }
  } catch(e){
    // ignore → fallback
  }

  // Fallback mock (client-side)
  renderResult(mockAnalyze(input));
}

// ===== Heuristic mock classifier (client) =====
function mockAnalyze(text){
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

  return { label, score, reasons: reasons.length ? reasons : ['No strong signals detected'] };
}

// ===== Render result =====
function renderResult({ label, score, reasons }){
  const isScam = /scam/i.test(label) || score >= 45;
  const badge = isScam ? 'scam-indicator' : 'legit-indicator';
  const emoji = isScam ? '⚠️' : '✅';
  const reasonList = (reasons || []).map(r => `<li class="list-disc ml-6">${r}</li>`).join('');
  document.getElementById('demoResults').innerHTML = `
    <div class="rounded-xl p-6 text-white ${badge}">
      <div class="flex items-center justify-between">
        <h4 class="text-xl font-bold">${emoji} ${label}</h4>
        <span class="text-sm bg-white/20 px-3 py-1 rounded-full">Confidence: ${score}%</span>
      </div>
    </div>
    <div class="mt-4 bg-white rounded-xl p-6">
      <h5 class="font-semibold mb-2">Signals:</h5>
      <ul class="text-slate-700">${reasonList}</ul>
    </div>
  `;
}
