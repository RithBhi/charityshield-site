// Smooth scroll helpers
function scrollToDemo(){ document.querySelector('#demo')?.scrollIntoView({behavior:'smooth'}); }
function scrollToAbout(){ document.querySelector('#about')?.scrollIntoView({behavior:'smooth'}); }

// Typed headline
document.addEventListener('DOMContentLoaded', () => {
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
    entries.forEach(e => {
      if (e.isIntersecting) e.target.classList.add('visible');
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

  // Counters
  document.querySelectorAll('.counter').forEach(counter => {
    const target = +counter.dataset.target;
    let current = 0;
    const step = Math.max(1, Math.floor(target / 60));
    const tick = () => {
      current += step;
      if (current >= target) { current = target; }
      counter.textContent = current;
      if (current < target) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  // Charts
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

// Samples
function loadSample(n){
  const el = document.getElementById('demoInput');
  const samples = {
    1: 'URGENT! Help my cousin’s surgery TODAY. Send gift cards or wire money to this account. We cannot show receipts due to privacy.',
    2: 'Limited-time fundraiser! If you donate in the next 30 minutes we will match 500%. Click this short link and DM your credit card details.',
    3: 'Our 501(c)(3) after-school program is raising funds for laptops. EIN 12-3456789. Donate via our verified portal; receipts are automatically sent.'
  };
  el.value = samples[n] || '';
}

// Analyze: tries serverless function first; falls back to local mock
async function analyzeText(){
  const input = document.getElementById('demoInput').value.trim();
  const results = document.getElementById('demoResults');

  if (!input) {
    results.innerHTML = '<p class="text-slate-500">Please paste some text first.</p>';
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
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
    // non-OK → mock
  } catch(e){
    // fetch failed → mock
  }
  renderResult(mockAnalyze(input));
}

function mockAnalyze(text){
  // Tiny heuristic just for demo
  const redFlags = ['gift card','wire','urgent','dm','credit card','short link','match 500','privacy'];
  const score = redFlags.reduce((s, kw) => s + (text.toLowerCase().includes(kw) ? 12 : 0), 5);
  const clipped = Math.max(0, Math.min(100, score));
  const label = clipped >= 55 ? 'Likely Scam' : 'Likely Legitimate';
  const reasons = redFlags.filter(kw => text.toLowerCase().includes(kw));
  return { label, score: clipped, reasons: reasons.length ? reasons : ['No major red flags detected'] };
}

function renderResult({ label, score, reasons }){
  const isScam = /scam/i.test(label) || score >= 55;
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
      <h5 class="font-semibold mb-2">Why:</h5>
      <ul class="text-slate-700">${reasonList}</ul>
    </div>
  `;
}
