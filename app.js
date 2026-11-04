let DATA = [];
let filtered = [];
let chartKat, chartSec;
let currentPage = 1;
const PAGE_SIZE = 50;
let sortState = { key: 'pbv', dir: 'asc' };

async function init() {
  let loaded = false;
  try {
    const res = await fetch('api/companies.php', { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json) && json.length > 0) {
        DATA = json.map(normalize);
        loaded = true;
      }
    }
  } catch (e) { loaded = false; }
  if (!loaded) DATA = (window.DATASET || []).map(normalize);
  populateSectors();
  populateGroups();
  document.querySelectorAll('#tbl th[data-sort]').forEach(th => {
    th.addEventListener('click', () => sortByColumn(th.dataset.sort));
  });
  // tabs
  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => switchTab(t.dataset.tab));
  });
  applyFilters();
  loadGroups();
  loadNews();
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('hidden', c.id !== 'tab-' + tab));
  const tb = document.getElementById('toolbarEmiten');
  if (tb) tb.style.display = (tab === 'emiten') ? '' : 'none';
  if (tab === 'grup') loadGroups();
  if (tab === 'pemegang') loadPemegang();
  if (tab === 'jenis') loadJenis();
  if (tab === 'ihsg') renderIHSG();
  if (tab === 'valuasi') initValuasi();
}

function populateGroups() {
  const groups = [...new Set(DATA.map(d => d.group).filter(Boolean))].sort();
  const sel = document.getElementById('groupFilter');
  if (!sel) return;
  groups.forEach(g => {
    const o = document.createElement('option');
    o.value = g; o.textContent = g;
    sel.appendChild(o);
  });
}

async function loadGroups() {
  const el = document.getElementById('grupWrap');
  if (!el) return;
  el.innerHTML = '<p>Memuat grup...</p>';
  let groups = [];
  try {
    const res = await fetch('api/groups.php');
    if (res.ok) groups = await res.json();
  } catch (e) { groups = []; }
  if (!Array.isArray(groups) || groups.length === 0) {
    // fallback: build from DATA
    const byGroup = {};
    DATA.forEach(d => {
      if (!d.group) return;
      if (!byGroup[d.group]) byGroup[d.group] = { name: d.group, companies: [] };
      byGroup[d.group].companies.push(d);
    });
    groups = Object.values(byGroup).map(g => ({ name: g.name, description: '', companies: g.companies.map(d => ({ code: d.code, company_name: d.name, sector: d.sector, mcap: d.mcap, pbv: d.pbv, klas: d.klas })) }));
  }
  let html = '';
  groups.forEach(g => {
    const totalMC = g.companies.reduce((s,c)=>s+(c.mcap||0),0);
    html += `<div class="group-card"><h3>${g.name} <span class="group-mc">(${fmt(totalMC,0)} miliar)</span></h3>`;
    if (g.description) html += `<p class="group-desc">${g.description}</p>`;
    html += '<table><thead><tr><th>Kode</th><th>Nama</th><th>Sektor</th><th>Market Cap</th><th>PBV</th><th>Klasifikasi</th></tr></thead><tbody>';
    g.companies.sort((a,b)=>(b.mcap||0)-(a.mcap||0)).forEach(c => {
      html += `<tr><td><b>${c.code}</b></td><td>${c.company_name||c.name||''}</td><td>${c.sector||''}</td><td class="num">${fmt(c.mcap,0)}</td><td class="num">${fmt(c.pbv)}</td><td>${badgeKlas(c.klas)}</td></tr>`;
    });
    html += '</tbody></table></div>';
  });
  el.innerHTML = html || '<p>Tidak ada data grup.</p>';
}

async function loadPemegang() {
  const el = document.getElementById('pemegangWrap');
  if (!el) return;
  el.innerHTML = '<p>Memuat data pemegang saham...</p>';
  // Build from companies with parent_company (major shareholder proxy)
  try {
    const res = await fetch('api/companies.php');
    const data = res.ok ? await res.json() : DATA;
    // group by parent_company
    const byParent = {};
    data.forEach(d => {
      if (!d.parent_company) return;
      if (!byParent[d.parent_company]) byParent[d.parent_company] = [];
      byParent[d.parent_company].push(d);
    });
    const parents = Object.entries(byParent).sort((a,b)=> b[1].reduce((s,x)=>s+(x.mcap||0),0) - a[1].reduce((s,x)=>s+(x.mcap||0),0));
    let html = '<h3>Pemegang Saham / Perusahaan Induk (Major Shareholders)</h3>';
    html += '<table><thead><tr><th>Perusahaan Induk</th><th>Jumlah Emiten</th><th>Total Market Cap</th><th>Emiten</th></tr></thead><tbody>';
    parents.forEach(([p, comps]) => {
      const mc = comps.reduce((s,x)=>s+(x.mcap||0),0);
      html += `<tr><td><b>${p}</b></td><td>${comps.length}</td><td class="num">${fmt(mc,0)}</td><td>${comps.map(c=>c.code).join(', ')}</td></tr>`;
    });
    html += '</tbody></table>';
    // also show directors sample for top companies
    html += '<h3 style="margin-top:20px">Direksi (contoh: BBCA)</h3><div id="dirSample"></div>';
    el.innerHTML = html;
    // fetch BBCA detail
    try {
      const r = await fetch('api/company.php?code=BBCA');
      if (r.ok) {
        const det = await r.json();
        const ds = document.getElementById('dirSample');
        if (ds && det.directors) {
          ds.innerHTML = '<ul>' + det.directors.map(x=>`<li><b>${x.name}</b> — ${x.position}</li>`).join('') + '</ul>';
        }
      }
    } catch(e){}
  } catch (e) {
    el.innerHTML = '<p>Gagal memuat: ' + e.message + '</p>';
  }
}

function normalize(d) {
  return {
    code: d.code, name: d.name, sector: d.sector, date: d.date,
    price: n(d.price), shares: n(d.shares), mcap: n(d.mcap),
    assets: n(d.assets), liab: n(d.liab), equity: n(d.equity),
    bvps: n(d.bvps), pbv: n(d.pbv), disc: n(d.disc),
    kategori: d.kategori, laba: n(d.laba), eps: n(d.eps),
    graham: n(d.graham), klas: d.klas, fairValue: n(d.fairValue),
    upside: n(d.upside), group: d.group_name || null,
    parent: d.parent_company || null,
    catatan: d.catatan_khusus || null,
    riwayat: d.riwayat_kasus || null,
    soliditas: d.soliditas || null,
    jenis: d.jenis_saham || null,
  };
}
function n(x) { return (x == null || isNaN(x)) ? null : Number(x); }

function populateSectors() {
  const sectors = [...new Set(DATA.map(d => d.sector).filter(Boolean))].sort();
  const sel = document.getElementById('sectorFilter');
  sectors.forEach(s => {
    const o = document.createElement('option');
    o.value = s; o.textContent = s;
    sel.appendChild(o);
  });
}

const SORT_KEYS = {
  code: (a,b,dir) => dir==='asc' ? a.code.localeCompare(b.code) : b.code.localeCompare(a.code),
  name: (a,b,dir) => dir==='asc' ? (a.name||'').localeCompare(b.name||'') : (b.name||'').localeCompare(a.name||''),
  sector: (a,b,dir) => dir==='asc' ? (a.sector||'').localeCompare(b.sector||'') : (b.sector||'').localeCompare(a.sector||''),
  price: (a,b,dir) => dir==='asc' ? (a.price??0)-(b.price??0) : (b.price??0)-(a.price??0),
  pbv: (a,b,dir) => dir==='asc' ? (a.pbv??999)-(b.pbv??999) : (b.pbv??-999)-(a.pbv??-999),
  kategori: (a,b,dir) => dir==='asc' ? (a.kategori||'').localeCompare(b.kategori||'') : (b.kategori||'').localeCompare(a.kategori||''),
  klas: (a,b,dir) => dir==='asc' ? (a.klas||'').localeCompare(b.klas||'') : (b.klas||'').localeCompare(a.klas||''),
  graham: (a,b,dir) => dir==='asc' ? (a.graham??0)-(b.graham??0) : (b.graham??0)-(a.graham??0),
  fairValue: (a,b,dir) => dir==='asc' ? (a.fairValue??0)-(b.fairValue??0) : (b.fairValue??0)-(a.fairValue??0),
  upside: (a,b,dir) => dir==='asc' ? (a.upside??-999)-(b.upside??-999) : (b.upside??-999)-(a.upside??-999),
  equity: (a,b,dir) => dir==='asc' ? (a.equity??0)-(b.equity??0) : (b.equity??0)-(a.equity??0),
  laba: (a,b,dir) => dir==='asc' ? (a.laba??0)-(b.laba??0) : (b.laba??0)-(a.laba??0),
  mcap: (a,b,dir) => dir==='asc' ? (a.mcap??0)-(b.mcap??0) : (b.mcap??0)-(a.mcap??0),
  group: (a,b,dir) => dir==='asc' ? (a.group||'').localeCompare(b.group||'') : (b.group||'').localeCompare(a.group||''),
  soliditas: (a,b,dir) => dir==='asc' ? (a.soliditas||'').localeCompare(b.soliditas||'') : (b.soliditas||'').localeCompare(a.soliditas||''),
};

function applyFilters() {
  const q = document.getElementById('search').value.toLowerCase();
  const sec = document.getElementById('sectorFilter').value;
  const grp = document.getElementById('groupFilter').value;
  const kat = document.getElementById('katFilter').value;
  const klas = document.getElementById('klasFilter').value;
  const sol = document.getElementById('solFilter').value;
  filtered = DATA.filter(d => {
    if (q && !(d.code.toLowerCase().includes(q) || (d.name||'').toLowerCase().includes(q))) return false;
    if (sec && d.sector !== sec) return false;
    if (grp && d.group !== grp) return false;
    if (kat && d.kategori !== kat) return false;
    if (klas && d.klas !== klas) return false;
    if (sol && d.soliditas !== sol) return false;
    return true;
  });
  sortData(sortState.key, sortState.dir);
  currentPage = 1;
  renderTable();
  renderSummary();
  renderCharts();
  renderPagination();
  renderIHSG();
  updateSortIndicators();
}

function sortData(key, dir) {
  const fn = SORT_KEYS[key] || SORT_KEYS.code;
  filtered.sort((a,b) => fn(a,b,dir));
}

function sortByColumn(key) {
  if (sortState.key === key) sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
  else { sortState.key = key; sortState.dir = 'asc'; }
  // sync dropdown
  const dd = document.getElementById('sortBy');
  if (dd) dd.value = sortState.key;
  applyFilters();
}

function updateSortIndicators() {
  document.querySelectorAll('#tbl th').forEach(th => {
    th.classList.remove('sort-asc','sort-desc');
    if (th.dataset.sort === sortState.key) th.classList.add(sortState.dir === 'asc' ? 'sort-asc' : 'sort-desc');
  });
}

function fmt(x, d=2) {
  if (x == null) return '-';
  return Number(x).toLocaleString('id-ID', { maximumFractionDigits: d });
}

function badgeKat(k) {
  if (!k) return '-';
  if (k.includes('Diskon')) return `<span class="badge b-diskon">${k}</span>`;
  if (k.includes('Mahal')) return `<span class="badge b-mahal">${k}</span>`;
  if (k.includes('Ekuitas')) return `<span class="badge b-ekuitas">${k}</span>`;
  return `<span class="badge">${k}</span>`;
}
function badgeKlas(k) {
  if (k === 'Layak Beli') return `<span class="badge b-layak">${k}</span>`;
  if (k === 'Tidak Layak') return `<span class="badge b-tidak">${k}</span>`;
  if (k === 'Netral') return `<span class="badge b-netral">${k}</span>`;
  return `<span class="badge">${k||'-'}</span>`;
}
function badgeSolid(k) {
  if (k === 'Solid') return `<span class="badge b-layak">${k}</span>`;
  if (k === 'Rawan Gorengan') return `<span class="badge b-tidak">${k}</span>`;
  return `<span class="badge b-netral">${k||'-'}</span>`;
}

function renderTable() {
  const tbody = document.querySelector('#tbl tbody');
  const start = (currentPage-1)*PAGE_SIZE;
  const page = filtered.slice(start, start+PAGE_SIZE);
  tbody.innerHTML = page.map(d => `
    <tr onclick="showDetail('${d.code}')">
      <td><b>${d.code}</b></td>
      <td>${d.name||''}</td>
      <td>${d.sector||''}</td>
      <td class="num">${fmt(d.price,0)}</td>
      <td class="num">${fmt(d.pbv)}</td>
      <td>${badgeKat(d.kategori)}</td>
      <td>${badgeKlas(d.klas)}</td>
      <td>${badgeSolid(d.soliditas)}</td>
      <td class="num">${fmt(d.graham,0)}</td>
      <td class="num">${fmt(d.fairValue,0)}</td>
      <td class="num">${d.upside!=null?d.upside.toFixed(2)+'%':'-'}</td>
      <td class="num">${fmt(d.equity,0)}</td>
      <td class="num">${fmt(d.laba,0)}</td>
      <td><a href="https://www.tradingview.com/chart/?symbol=IDX:${d.code}" target="_blank" rel="noopener" title="Chart ${d.code}">📈</a></td>
    </tr>
  `).join('');
  document.getElementById('countInfo').textContent = `Menampilkan ${page.length} dari ${filtered.length} emiten (total ${DATA.length})`;
}

function renderSummary() {
  const el = document.getElementById('summary');
  const total = filtered.length;
  const layak = filtered.filter(d => d.klas === 'Layak Beli').length;
  const tidak = filtered.filter(d => d.klas === 'Tidak Layak').length;
  const netral = filtered.filter(d => d.klas === 'Netral').length;
  const diskon = filtered.filter(d => (d.kategori||'').includes('Diskon')).length;
  const mahal = filtered.filter(d => (d.kategori||'').includes('Mahal')).length;
  const pbvArr = filtered.filter(d=>d.pbv!=null);
  const avgPbv = pbvArr.length ? (pbvArr.reduce((a,d)=>a+d.pbv,0)/pbvArr.length) : null;
  el.innerHTML = `
    <div class="card"><div class="num">${total}</div><div class="lbl">Emiten</div></div>
    <div class="card"><div class="num">${layak}</div><div class="lbl">Layak Beli</div></div>
    <div class="card"><div class="num">${netral}</div><div class="lbl">Netral</div></div>
    <div class="card"><div class="num">${tidak}</div><div class="lbl">Tidak Layak</div></div>
    <div class="card"><div class="num">${diskon}</div><div class="lbl">Diskon</div></div>
    <div class="card"><div class="num">${mahal}</div><div class="lbl">Mahal</div></div>
    <div class="card"><div class="num">${avgPbv?avgPbv.toFixed(2):'-'}</div><div class="lbl">Avg PBV</div></div>
  `;
}

function renderCharts() {
  const katCount = {};
  filtered.forEach(d => { const k = d.kategori||'Lain'; katCount[k]=(katCount[k]||0)+1; });
  if (chartKat) chartKat.destroy();
  chartKat = new Chart(document.getElementById('chartKat'), {
    type: 'doughnut',
    data: { labels: Object.keys(katCount), datasets: [{ data: Object.values(katCount), backgroundColor: ['#22c55e','#86efac','#94a3b8','#f87171','#ef4444','#fbbf24'] }] },
    options: { plugins: { title: { display: true, text: 'Kategori Valuasi' }, legend: { position: 'bottom' } } }
  });
  const secCount = {};
  filtered.forEach(d => { const s = d.sector||'Lain'; secCount[s]=(secCount[s]||0)+1; });
  const topSec = Object.entries(secCount).sort((a,b)=>b[1]-a[1]).slice(0,10);
  if (chartSec) chartSec.destroy();
  chartSec = new Chart(document.getElementById('chartSector'), {
    type: 'bar',
    data: { labels: topSec.map(x=>x[0]), datasets: [{ label: 'Jumlah', data: topSec.map(x=>x[1]), backgroundColor: '#1f3864' }] },
    options: { plugins: { title: { display: true, text: 'Top Sektor' } }, indexAxis: 'y', responsive: true }
  });
}

function renderPagination() {
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const el = document.getElementById('pagination');
  if (totalPages <= 1) { el.innerHTML = ''; return; }
  let html = '';
  const maxBtns = 7;
  let start = Math.max(1, currentPage - 3);
  let end = Math.min(totalPages, start + maxBtns - 1);
  if (end - start < maxBtns - 1) start = Math.max(1, end - maxBtns + 1);
  if (currentPage > 1) html += `<button onclick="goPage(${currentPage-1})">‹</button>`;
  for (let p = start; p <= end; p++) {
    html += `<button class="${p===currentPage?'active':''}" onclick="goPage(${p})">${p}</button>`;
  }
  if (currentPage < totalPages) html += `<button onclick="goPage(${currentPage+1})">›</button>`;
  el.innerHTML = html;
}
function goPage(p) { currentPage = p; renderTable(); renderPagination(); window.scrollTo(0,0); }

async function showDetail(code) {
  const d = DATA.find(x => x.code === code);
  if (!d) return;
  const el = document.getElementById('detail');
  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="modal-header">
      <h5 class="modal-title">${d.code} - ${d.name}</h5>
      <button type="button" class="btn-close" onclick="closeDetail()">&times;</button>
    </div>
    <div class="modal-body">
    <table>
      <tr><td>Sektor</td><td>${d.sector||'-'}</td></tr>
      <tr><td>Harga (Rp)</td><td>${fmt(d.price,2)}</td></tr>
      <tr><td>Jumlah Saham (miliar)</td><td>${fmt(d.shares,2)}</td></tr>
      <tr><td>Market Cap (Rp miliar)</td><td>${fmt(d.mcap,0)}</td></tr>
      <tr><td>Total Aset (Rp miliar)</td><td>${fmt(d.assets,0)}</td></tr>
      <tr><td>Total Liabilitas (Rp miliar)</td><td>${fmt(d.liab,0)}</td></tr>
      <tr><td>Ekuitas (Rp miliar)</td><td>${fmt(d.equity,0)}</td></tr>
      <tr><td>BVPS (Rp)</td><td>${fmt(d.bvps,2)}</td></tr>
      <tr><td>PBV (x)</td><td>${fmt(d.pbv,2)}</td></tr>
      <tr><td>Diskon vs BV (%)</td><td>${d.disc!=null?(d.disc*100).toFixed(2)+'%':'-'}</td></tr>
      <tr><td>Kategori Valuasi</td><td>${d.kategori||'-'}</td></tr>
      <tr><td>Laba Bersih (Rp miliar)</td><td>${fmt(d.laba,0)}</td></tr>
      <tr><td>EPS (Rp)</td><td>${fmt(d.eps,2)}</td></tr>
      <tr><td>Graham Number (Rp)</td><td>${fmt(d.graham,0)}</td></tr>
      <tr><td>Fair Value (Rp)</td><td>${fmt(d.fairValue,0)}</td></tr>
      <tr><td>Upside (%)</td><td>${d.upside!=null?d.upside.toFixed(2)+'%':'-'}</td></tr>
      <tr><td>Klasifikasi</td><td>${d.klas||'-'}</td></tr>
      <tr><td>Soliditas</td><td>${d.soliditas||'-'}</td></tr>
      <tr><td>Chart</td><td><a href="https://www.tradingview.com/chart/?symbol=IDX:${d.code}" target="_blank" rel="noopener">📈 Lihat Chart (TradingView)</a></td></tr>
    </table>
    <div id="detailExtra"><p style="color:#64748b;font-size:13px">Memuat data perusahaan...</p></div>
    </div>
    <div class="modal-footer">
      <button class="btn secondary" onclick="refreshStock('${d.code}')">↻ Refresh Data</button>
      <button class="btn secondary" onclick="closeDetail()">Tutup</button>
    </div>
  `;
  // overlay
  if (!document.getElementById('overlay')) {
    const ov = document.createElement('div');
    ov.id = 'overlay'; ov.className = 'overlay';
    ov.onclick = closeDetail;
    document.body.appendChild(ov);
  }
  document.getElementById('overlay').classList.remove('hidden');
  // fetch extra detail
  loadDetailExtra(code);
}
async function loadDetailExtra(code) {
  const el = document.getElementById('detailExtra');
  if (!el) return;
  let detail = null;
  try {
    const res = await fetch('api/company.php?code=' + encodeURIComponent(code));
    if (res.ok) detail = await res.json();
  } catch (e) { detail = null; }
  if (!detail) { el.innerHTML = ''; return; }
  let html = '';
  if (detail.parent_company) html += `<h3>Perusahaan Induk</h3><p>${detail.parent_company}</p>`;
  if (detail.catatan_khusus) html += `<h3>Catatan Khusus</h3><p>${detail.catatan_khusus}</p>`;
  if (detail.riwayat_kasus) html += `<h3>Riwayat Kasus</h3><p>${detail.riwayat_kasus}</p>`;
  if (detail.directors && detail.directors.length) {
    html += '<h3>Direksi / Key Executives</h3><ul>' + detail.directors.map(x=>`<li><b>${x.name}</b> — ${x.position}</li>`).join('') + '</ul>';
  }
  if (detail.shareholders && detail.shareholders.length) {
    html += '<h3>Pemegang Saham</h3><ul>' + detail.shareholders.map(x=>`<li>${x.name} ${x.percentage!=null?x.percentage+'%':''}</li>`).join('') + '</ul>';
  }
  el.innerHTML = html || '<p style="color:#64748b;font-size:13px">Tidak ada data tambahan.</p>';
}

async function refreshStock(code) {
  toast('Memperbarui ' + code + '...');
  try {
    const res = await fetch('api/refresh.php?code=' + encodeURIComponent(code));
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.data) {
        const d = json.data;
        // update DATA
        const idx = DATA.findIndex(x => x.code === code);
        const norm = normalize(d);
        if (idx >= 0) DATA[idx] = norm; else DATA.push(norm);
        applyFilters();
        toast(code + ' diperbarui');
        showDetail(code);
      } else {
        toast('Gagal: ' + (json.error || 'unknown'));
      }
    } else {
      toast('Gagal refresh (HTTP ' + res.status + ')');
    }
  } catch (e) {
    toast('Gagal refresh: ' + e.message);
  }
}
function closeDetail() {
  document.getElementById('detail').classList.add('hidden');
  const ov = document.getElementById('overlay');
  if (ov) ov.classList.add('hidden');
}

// Export to Excel (lengkap & informatif)
function exportExcel() {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Data lengkap
  const rows = (filtered.length ? filtered : DATA).map(d => ({
    'Kode Saham': d.code, 'Nama Emiten': d.name, 'Sektor': d.sector,
    'Tanggal Harga': d.date, 'Harga (Rp)': d.price, 'Jumlah Saham (miliar)': d.shares,
    'Market Cap (Rp miliar)': d.mcap, 'Total Aset (Rp miliar)': d.assets,
    'Total Liabilitas (Rp miliar)': d.liab, 'Ekuitas (Rp miliar)': d.equity,
    'BVPS (Rp)': d.bvps, 'PBV (x)': d.pbv, 'Diskon vs BV (%)': d.disc,
    'Kategori Valuasi': d.kategori, 'Laba Bersih (Rp miliar)': d.laba,
    'EPS (Rp)': d.eps, 'Graham Number (Rp)': d.graham,
    'Klasifikasi': d.klas, 'Soliditas': d.soliditas,
    'Fair Value (Rp)': d.fairValue, 'Upside (%)': d.upside,
    'Grup': d.group, 'Perusahaan Induk': d.parent,
  }));
  const wsData = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, wsData, 'Data Emiten');

  // Sheet 2: Ringkasan
  const total = filtered.length ? filtered.length : DATA.length;
  const layak = (filtered.length?filtered:DATA).filter(d=>d.klas==='Layak Beli').length;
  const tidak = (filtered.length?filtered:DATA).filter(d=>d.klas==='Tidak Layak').length;
  const netral = (filtered.length?filtered:DATA).filter(d=>d.klas==='Netral').length;
  const diskon = (filtered.length?filtered:DATA).filter(d=>(d.kategori||'').includes('Diskon')).length;
  const mahal = (filtered.length?filtered:DATA).filter(d=>(d.kategori||'').includes('Mahal')).length;
  const ekuitasNeg = (filtered.length?filtered:DATA).filter(d=>(d.kategori||'').includes('Ekuitas')).length;
  const solid = (filtered.length?filtered:DATA).filter(d=>d.soliditas==='Solid').length;
  const rawan = (filtered.length?filtered:DATA).filter(d=>d.soliditas==='Rawan Gorengan').length;
  const pbvArr = (filtered.length?filtered:DATA).filter(d=>d.pbv!=null);
  const avgPbv = pbvArr.length ? pbvArr.reduce((a,d)=>a+d.pbv,0)/pbvArr.length : 0;
  const totalMC = (filtered.length?filtered:DATA).reduce((s,d)=>s+(d.mcap||0),0);
  const totalNI = (filtered.length?filtered:DATA).reduce((s,d)=>s+(d.laba||0),0);
  const aggPE = totalNI>0 ? totalMC/totalNI : 0;
  const totalEq = (filtered.length?filtered:DATA).reduce((s,d)=>s+(d.equity||0),0);
  const aggPBV = totalEq>0 ? totalMC/totalEq : 0;
  const fairMC = totalNI>0 ? totalNI*15 : 0;
  const upside = (fairMC && totalMC>0) ? (fairMC-totalMC)/totalMC*100 : 0;
  const summaryRows = [
    ['Ringkasan Valuasi Emiten BEI', ''],
    ['Jumlah Emiten', total],
    ['Layak Beli', layak],
    ['Netral', netral],
    ['Tidak Layak', tidak],
    ['Diskon', diskon],
    ['Mahal', mahal],
    ['Ekuitas Negatif', ekuitasNeg],
    ['Solid', solid],
    ['Rawan Gorengan', rawan],
    ['Avg PBV (x)', Number(avgPbv.toFixed(2))],
    ['', ''],
    ['Valuasi Agregat (Proxy IHSG)', ''],
    ['Total Market Cap (Rp miliar)', Number(totalMC.toFixed(2))],
    ['Total Laba (Rp miliar)', Number(totalNI.toFixed(2))],
    ['Aggregate PE (x)', Number(aggPE.toFixed(2))],
    ['Total Ekuitas (Rp miliar)', Number(totalEq.toFixed(2))],
    ['Aggregate PBV (x)', Number(aggPBV.toFixed(2))],
    ['Fair Value Market Cap PE 15x (Rp miliar)', Number(fairMC.toFixed(2))],
    ['Upside ke Fair Value (%)', Number(upside.toFixed(2))],
  ];
  const wsSum = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSum['A1'].s = { font: { bold: true, size: 14 } };
  XLSX.utils.book_append_sheet(wb, wsSum, 'Ringkasan');

  // Sheet 3: Top Diskon
  const topDiskon = (filtered.length?filtered:DATA).filter(d=>d.pbv!=null).sort((a,b)=>(a.pbv??999)-(b.pbv??999)).slice(0,30).map(d=>({
    'Kode': d.code, 'Nama': d.name, 'Sektor': d.sector, 'Harga': d.price, 'PBV': d.pbv,
    'Kategori': d.kategori, 'Klasifikasi': d.klas, 'Soliditas': d.soliditas,
    'Graham': d.graham, 'Fair Value': d.fairValue, 'Upside %': d.upside,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(topDiskon), 'Top Diskon');

  // Sheet 4: Top Mahal
  const topMahal = (filtered.length?filtered:DATA).filter(d=>d.pbv!=null).sort((a,b)=>(b.pbv??-999)-(a.pbv??-999)).slice(0,30).map(d=>({
    'Kode': d.code, 'Nama': d.name, 'Sektor': d.sector, 'Harga': d.price, 'PBV': d.pbv,
    'Kategori': d.kategori, 'Klasifikasi': d.klas, 'Soliditas': d.soliditas,
    'Graham': d.graham, 'Fair Value': d.fairValue, 'Upside %': d.upside,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(topMahal), 'Top Mahal');

  // Sheet 5: Grup Korporasi
  // fetch groups from API not available offline; build from DATA
  const byGroup = {};
  (filtered.length?filtered:DATA).forEach(d => {
    if (!d.group) return;
    if (!byGroup[d.group]) byGroup[d.group] = { grup: d.group, jumlah: 0, marketCap: 0, emiten: [] };
    byGroup[d.group].jumlah++;
    byGroup[d.group].marketCap += d.mcap || 0;
    byGroup[d.group].emiten.push(d.code);
  });
  const grupRows = Object.values(byGroup).sort((a,b)=>b.marketCap-a.marketCap).map(g=>({
    'Grup': g.grup, 'Jumlah Emiten': g.jumlah, 'Total Market Cap (Rp miliar)': Number(g.marketCap.toFixed(2)),
    'Emiten': g.emiten.join(', '),
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(grupRows), 'Grup Korporasi');

  // Sheet 6: Jenis Saham distribution
  const jenisCount = {};
  (filtered.length?filtered:DATA).forEach(d => { const j = d.jenis||'Lain'; jenisCount[j]=(jenisCount[j]||0)+1; });
  const jenisRows = Object.entries(jenisCount).sort((a,b)=>b[1]-a[1]).map(([j,c])=>({ 'Jenis Saham': j, 'Jumlah': c, 'Persen': Number((c/(filtered.length?filtered.length:DATA.length)*100).toFixed(2)) }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(jenisRows), 'Jenis Saham');

  // Sheet 7: Chart teks (bar chart sederhana)
  const chartRows = [['Kategori', 'Jumlah', 'Bar']];
  const katCount = {};
  (filtered.length?filtered:DATA).forEach(d => { const k = d.kategori||'Lain'; katCount[k]=(katCount[k]||0)+1; });
  const maxC = Math.max(...Object.values(katCount));
  Object.entries(katCount).sort((a,b)=>b[1]-a[1]).forEach(([k,c]) => {
    const bar = '█'.repeat(Math.round(c/maxC*40));
    chartRows.push([k, c, bar]);
  });
  chartRows.push(['', '', '']);
  chartRows.push(['Jenis Saham', 'Jumlah', 'Bar']);
  const jc = {};
  (filtered.length?filtered:DATA).forEach(d => { const j = d.jenis||'Lain'; jc[j]=(jc[j]||0)+1; });
  const maxJ = Math.max(...Object.values(jc));
  Object.entries(jc).sort((a,b)=>b[1]-a[1]).forEach(([j,c]) => {
    const bar = '█'.repeat(Math.round(c/maxJ*40));
    chartRows.push([j, c, bar]);
  });
  const wsChart = XLSX.utils.aoa_to_sheet(chartRows);
  XLSX.utils.book_append_sheet(wb, wsChart, 'Chart Teks');

  XLSX.writeFile(wb, 'valuasi_emiten_export.xlsx');
  toast('Export Excel (7 sheet) berhasil');
}

function initValuasi() {
  const sel = document.getElementById('valStockSelect');
  if (!sel) return;
  if (sel.options.length <= 1) {
    sel.innerHTML = '<option value="">-- Pilih Emiten --</option>';
    DATA.sort((a,b) => a.code.localeCompare(b.code)).forEach(d => {
      const o = document.createElement('option');
      o.value = d.code;
      o.textContent = d.code + ' - ' + (d.name || '');
      sel.appendChild(o);
    });
  }
  const btn = document.getElementById('valLoadBtn');
  if (btn && !btn._bound) {
    btn._bound = true;
    btn.addEventListener('click', () => loadValuation(sel.value));
  }
  // auto-load first if empty
  if (sel.value) loadValuation(sel.value);
}

async function loadValuation(code) {
  if (!code) return;
  const summaryEl = document.getElementById('valSummary');
  const tableEl = document.getElementById('valTable');
  if (summaryEl) summaryEl.innerHTML = '<p>Memuat valuasi...</p>';
  if (tableEl) tableEl.innerHTML = '';
  try {
    const res = await fetch('api/valuation.php?code=' + encodeURIComponent(code));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const v = await res.json();
    if (v.error) throw new Error(v.error);

    // summary
    let html = `<div class="ihsg-grid" style="margin-bottom:16px">`;
    html += `<div class="ihsg-card"><div class="lbl">Kode</div><div class="val">${v.code}</div></div>`;
    html += `<div class="ihsg-card"><div class="lbl">Harga Saat Ini</div><div class="val">${fmt(v.price,0)}</div></div>`;
    html += `<div class="ihsg-card"><div class="lbl">EPS</div><div class="val">${fmt(v.eps,2)}</div></div>`;
    html += `<div class="ihsg-card"><div class="lbl">BVPS</div><div class="val">${fmt(v.bvps,2)}</div></div>`;
    html += `<div class="ihsg-card"><div class="lbl">PE (x)</div><div class="val">${v.pe != null ? v.pe : '-'}</div></div>`;
    html += `<div class="ihsg-card"><div class="lbl">ROE (%)</div><div class="val">${v.roe != null ? v.roe : '-'}</div></div>`;
    html += `<div class="ihsg-card"><div class="lbl">PBV (x)</div><div class="val">${v.pbv != null ? v.pbv.toFixed(2) : '-'}</div></div>`;
    html += `<div class="ihsg-card"><div class="lbl">Avg Fair Value</div><div class="val">${v.summary.avg_fair_value != null ? fmt(v.summary.avg_fair_value,0) : '-'}</div></div>`;
    html += `<div class="ihsg-card"><div class="lbl">Median Fair Value</div><div class="val">${v.summary.median_fair_value != null ? fmt(v.summary.median_fair_value,0) : '-'}</div></div>`;
    html += `<div class="ihsg-card"><div class="lbl">Avg Upside %</div><div class="val" style="color:${v.summary.avg_upside_pct!=null && v.summary.avg_upside_pct>0?'#006100':'#9c0006'}">${v.summary.avg_upside_pct != null ? v.summary.avg_upside_pct.toFixed(2)+'%' : '-'}</div></div>`;
    html += `</div>`;
    if (summaryEl) summaryEl.innerHTML = html;

    // table of methods
    const methods = Object.entries(v.methods);
    let thead = `<table><thead><tr><th>Metode</th><th>Formula</th><th class="num">Fair Value (Rp)</th><th class="num">vs Harga (%)</th><th>Keterangan</th><th></th></tr></thead><tbody>`;
    let tbody = '';
    methods.forEach(([key, m]) => {
      const fv = m.value != null ? fmt(m.value, 2) : '-';
      const up = m.upside_pct != null ? (m.upside_pct > 0 ? '+' : '') + m.upside_pct.toFixed(2) + '%' : (m.value != null && v.price > 0 && !['earnings_yield','magic_formula'].includes(key) ? ((m.value - v.price)/v.price*100).toFixed(2)+'%' : '-');
      const color = m.upside_pct != null ? (m.upside_pct > 0 ? 'color:#006100' : 'color:#9c0006') : '';
      const signal = m.upside_pct != null ? (m.upside_pct > 0 ? '🟢' : '🔴') : (['earnings_yield','magic_formula'].includes(key) ? '📊' : '');
      tbody += `<tr data-method="${key}">
        <td><b>${m.name}</b> ${signal}</td>
        <td style="font-size:11px;color:#64748b">${m.formula}</td>
        <td class="num">${fv}</td>
        <td class="num" style="${color}">${up}</td>
        <td style="font-size:11px">${m.description}</td>
        <td><button class="btn primary" style="padding:2px 8px;font-size:11px" onclick="event.stopPropagation();showMethodPopup('${key}')">Hasil Analisa</button></td>
      </tr>`;
    });
    // add summary row
    tbody += `<tr style="background:#f1f5f9;font-weight:bold">
      <td colspan="2">Rata-rata (${v.summary.num_methods} metode harga)</td>
      <td class="num">${v.summary.avg_fair_value != null ? fmt(v.summary.avg_fair_value,2) : '-'}</td>
      <td class="num">${v.summary.avg_upside_pct != null ? v.summary.avg_upside_pct.toFixed(2)+'%' : '-'}</td>
      <td></td>
    </tr>`;
    tbody += `<tr style="background:#f1f5f9;font-weight:bold">
      <td colspan="2">Median</td>
      <td class="num">${v.summary.median_fair_value != null ? fmt(v.summary.median_fair_value,2) : '-'}</td>
      <td class="num">${v.summary.median_upside_pct != null ? v.summary.median_upside_pct.toFixed(2)+'%' : '-'}</td>
      <td></td>
    </tr>`;
    if (tableEl) tableEl.innerHTML = thead + tbody + '</tbody></table>';
    // store valuation data globally for method popups
    window._lastValuation = v;
    // make method rows clickable
    tableEl.querySelectorAll('tbody tr[data-method]').forEach(tr => {
      tr.style.cursor = 'pointer';
      tr.addEventListener('click', () => showMethodPopup(tr.dataset.method));
    });
  } catch (e) {
    if (summaryEl) summaryEl.innerHTML = '<p style="color:#9c0006">Gagal memuat: ' + e.message + '</p>';
  }
}

// removed - replaced by per-method popups (showMethodPopup)
function _showValuationPopup_unused(v) {
  // remove existing popup
  const existing = document.getElementById('valPopup');
  if (existing) existing.remove();
  const existingOv = document.getElementById('valOverlay');
  if (existingOv) existingOv.remove();

  // determine recommendation
  const avgUp = v.summary.avg_upside_pct;
  const soliditas = (DATA.find(d => d.code === v.code) || {}).soliditas || '';
  let rec = 'HOLD', recColor = '#f59e0b', recBg = '#fef3c7';
  const numMethods = v.summary.num_methods;
  const undervaluedCount = Object.values(v.methods).filter(m => m.upside_pct != null && m.upside_pct > 0 && !['earnings_yield','magic_formula'].includes(m.name.toLowerCase().replace(/ /g,'_'))).length;
  // simpler: count methods with positive upside
  let posCount = 0, totalValMethods = 0;
  Object.entries(v.methods).forEach(([key, m]) => {
    if (['earnings_yield','magic_formula'].includes(key)) return;
    totalValMethods++;
    if (m.upside_pct != null && m.upside_pct > 0) posCount++;
  });
  const pctUndervalued = totalValMethods > 0 ? (posCount / totalValMethods * 100) : 0;
  if (pctUndervalued >= 70 && soliditas === 'Solid') { rec = 'STRONG BUY'; recColor = '#166534'; recBg = '#dcfce7'; }
  else if (pctUndervalued >= 50) { rec = 'BUY'; recColor = '#166534'; recBg = '#dcfce7'; }
  else if (pctUndervalued <= 30 || soliditas === 'Rawan Gorengan') { rec = 'AVOID/SELL'; recColor = '#991b1b'; recBg = '#fee2e2'; }
  else { rec = 'HOLD'; recColor = '#92400e'; recBg = '#fef3c7'; }

  // build method rows
  let methodRows = '';
  Object.entries(v.methods).forEach(([key, m]) => {
    if (['earnings_yield','magic_formula'].includes(key)) {
      methodRows += `<tr><td><b>${m.name}</b></td><td style="font-size:11px;color:#64748b">${m.formula}</td><td class="num">${m.value != null ? (key==='earnings_yield' ? m.value.toFixed(2)+'%' : m.value.toFixed(2)) : '-'}</td><td class="num">-</td><td style="font-size:11px">${m.description}</td></tr>`;
    } else {
      const up = m.upside_pct != null ? (m.upside_pct > 0 ? '+' : '') + m.upside_pct.toFixed(2) + '%' : '-';
      const color = m.upside_pct != null ? (m.upside_pct > 0 ? '#006100' : '#9c0006') : '';
      methodRows += `<tr><td><b>${m.name}</b></td><td style="font-size:11px;color:#64748b">${m.formula}</td><td class="num">${m.value != null ? fmt(m.value,2) : '-'}</td><td class="num" style="color:${color}">${up}</td><td style="font-size:11px">${m.description}</td></tr>`;
    }
  });

  const ov = document.createElement('div');
  ov.id = 'valOverlay';
  ov.className = 'overlay';
  ov.onclick = closeValuationPopup;
  document.body.appendChild(ov);

  const popup = document.createElement('div');
  popup.id = 'valPopup';
  popup.className = 'detail';
  popup.style.cssText = 'max-width:900px;max-height:85vh;overflow-y:auto;';
  popup.innerHTML = `
    <div class="modal-header">
      <h5 class="modal-title">📊 Analisa Valuasi: ${v.code} - ${v.name}</h5>
      <button type="button" class="btn-close" onclick="closeValuationPopup()">&times;</button>
    </div>
    <div class="modal-body">
      <div style="text-align:center;margin-bottom:16px">
        <span style="display:inline-block;padding:8px 24px;border-radius:8px;font-size:18px;font-weight:bold;background:${recBg};color:${recColor}">${rec}</span>
        <p style="margin-top:8px;color:#64748b;font-size:13px">${posCount} dari ${totalValMethods} metode menunjukkan undervalued (${pctUndervalued.toFixed(0)}%) | Soliditas: ${soliditas || '-'}</p>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:16px">
        <div class="ihsg-card"><div class="lbl">Harga</div><div class="val">${fmt(v.price,0)}</div></div>
        <div class="ihsg-card"><div class="lbl">EPS</div><div class="val">${fmt(v.eps,2)}</div></div>
        <div class="ihsg-card"><div class="lbl">BVPS</div><div class="val">${fmt(v.bvps,2)}</div></div>
        <div class="ihsg-card"><div class="lbl">PE (x)</div><div class="val">${v.pe != null ? v.pe : '-'}</div></div>
        <div class="ihsg-card"><div class="lbl">ROE (%)</div><div class="val">${v.roe != null ? v.roe : '-'}</div></div>
        <div class="ihsg-card"><div class="lbl">PBV (x)</div><div class="val">${v.pbv != null ? v.pbv.toFixed(2) : '-'}</div></div>
        <div class="ihsg-card"><div class="lbl">Avg FV</div><div class="val">${v.summary.avg_fair_value != null ? fmt(v.summary.avg_fair_value,0) : '-'}</div></div>
        <div class="ihsg-card"><div class="lbl">Median FV</div><div class="val">${v.summary.median_fair_value != null ? fmt(v.summary.median_fair_value,0) : '-'}</div></div>
        <div class="ihsg-card"><div class="lbl">Avg Upside</div><div class="val" style="color:${avgUp!=null && avgUp>0?'#006100':'#9c0006'}">${avgUp != null ? avgUp.toFixed(2)+'%' : '-'}</div></div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:#1f3864;color:white"><th>Metode</th><th>Formula</th><th class="num">Fair Value</th><th class="num">vs Harga</th><th>Keterangan</th></tr></thead>
        <tbody>${methodRows}
          <tr style="background:#f1f5f9;font-weight:bold"><td colspan="2">Rata-rata (${v.summary.num_methods} metode)</td><td class="num">${v.summary.avg_fair_value != null ? fmt(v.summary.avg_fair_value,2) : '-'}</td><td class="num">${v.summary.avg_upside_pct != null ? v.summary.avg_upside_pct.toFixed(2)+'%' : '-'}</td><td></td></tr>
          <tr style="background:#f1f5f9;font-weight:bold"><td colspan="2">Median</td><td class="num">${v.summary.median_fair_value != null ? fmt(v.summary.median_fair_value,2) : '-'}</td><td class="num">${v.summary.median_upside_pct != null ? v.summary.median_upside_pct.toFixed(2)+'%' : '-'}</td><td></td></tr>
        </tbody>
      </table>
      <div style="margin-top:12px;padding:10px;background:#f8fafc;border-radius:6px;font-size:12px">
        <b>Interpretasi:</b> ${rec === 'STRONG BUY' ? 'Mayoritas metode valuasi menunjukkan saham undervalued dengan soliditas kuat. Potensi upside tinggi.' : rec === 'BUY' ? 'Lebih dari setengah metode menunjukkan undervalued. Pertimbangkan untuk beli dengan posisi bertahap.' : rec === 'HOLD' ? 'Metode valuasi campuran. Tidak ada sinyal beli/jual kuat. Tahan posisi existing.' : 'Mayoritas metode menunjukkan overvalued atau soliditas lemah. Hindari atau pertimbangkan jual.'}
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn secondary" onclick="closeValuationPopup()">Tutup</button>
    </div>
  `;
  document.body.appendChild(popup);
  ov.classList.remove('hidden');
  popup.classList.remove('hidden');
}

function closeValuationPopup() {
  const p = document.getElementById('valPopup');
  if (p) p.remove();
  const o = document.getElementById('valOverlay');
  if (o) o.remove();
}

function showMethodPopup(methodKey) {
  const v = window._lastValuation;
  if (!v) return;
  const m = v.methods[methodKey];
  if (!m) return;

  // remove existing
  const existing = document.getElementById('methodPopup');
  if (existing) existing.remove();
  const existingOv = document.getElementById('methodOverlay');
  if (existingOv) existingOv.remove();

  const price = v.price;
  const fv = m.value;
  const isPriceMethod = !['earnings_yield','magic_formula'].includes(methodKey);

  // determine verdict per method
  let verdict = '', verdictColor = '', verdictBg = '', explanation = '';
  if (methodKey === 'earnings_yield') {
    const ey = m.value;
    if (ey > 10) { verdict = 'SANGAT MURAH (STRONG BUY)'; verdictColor = '#0f5132'; verdictBg = '#d1e7dd'; explanation = `Earnings Yield ${ey.toFixed(2)}% > 10% (PE < 10x). Saham sangat murah relatif laba. Return dari laba jauh di atas risk-free rate (6.5%). Potensi upside tinggi.`; }
    else if (ey > 6.5) { verdict = 'MURAH (BUY)'; verdictColor = '#0f5132'; verdictBg = '#d1e7dd'; explanation = `Earnings Yield ${ey.toFixed(2)}% > risk-free rate (6.5%). Saham murah — laba per saham cukup tinggi relatif harga. Good entry point.`; }
    else if (ey > 4) { verdict = 'FAIR (HOLD)'; verdictColor = '#664d03'; verdictBg = '#fff3cd'; explanation = `Earnings Yield ${ey.toFixed(2)}% (PE ~${(100/ey).toFixed(1)}x). Valuasi wajar. Tidak ada sinyal beli/jual kuat.`; }
    else { verdict = 'MAHAL (AVOID)'; verdictColor = '#842029'; verdictBg = '#f8d7da'; explanation = `Earnings Yield ${ey.toFixed(2)}% < 4% (PE > 25x). Saham mahal relatif laba. Hindari kecuali growth sangat tinggi.`; }
  } else if (methodKey === 'magic_formula') {
    const score = m.value;
    if (score > 30) { verdict = 'EXCELLENT (STRONG BUY)'; verdictColor = '#0f5132'; verdictBg = '#d1e7dd'; explanation = `Magic Score ${score.toFixed(2)} = Earnings Yield + ROE. Skor tinggi = saham murah (EY tinggi) DAN efisien (ROE tinggi). Kombinasi ideal Greenblatt.`; }
    else if (score > 15) { verdict = 'BAGUS (BUY)'; verdictColor = '#0f5132'; verdictBg = '#d1e7dd'; explanation = `Magic Score ${score.toFixed(2)}. Saham cukup murah dan efisien. Pertimbangkan untuk beli.`; }
    else { verdict = 'KURANG (AVOID)'; verdictColor = '#842029'; verdictBg = '#f8d7da'; explanation = `Magic Score ${score.toFixed(2)} rendah. Saham mahal atau tidak efisien (ROE rendah). Hindari.`; }
  } else {
    const upside = m.upside_pct != null ? m.upside_pct : ((fv - price) / price * 100);
    if (upside > 30) { verdict = 'UNDERVALUED (BUY)'; verdictColor = '#0f5132'; verdictBg = '#d1e7dd'; }
    else if (upside > 0) { verdict = 'SEDikit UNDERVALUED (BUY)'; verdictColor = '#0f5132'; verdictBg = '#d1e7dd'; }
    else if (upside > -20) { verdict = 'FAIR (HOLD)'; verdictColor = '#664d03'; verdictBg = '#fff3cd'; }
    else { verdict = 'OVERVALUED (AVOID/SELL)'; verdictColor = '#842029'; verdictBg = '#f8d7da'; }

    // method-specific explanations
    const explanations = {
      graham_number: `Graham Number = √(22.5 × EPS × BVPS) = Rp ${fmt(fv,2)}. Harga pasar Rp ${fmt(price,0)}. ${upside > 0 ? `Harga di BAWAH Graham Number → saham undervalued, margin of safety ${upside.toFixed(1)}%. BELI.` : `Harga di ATAS Graham Number → saham overvalued. HINDARI.`} Cocok untuk value investing konservatif.`,
      pe_15x: `Fair Value = EPS × 15 = Rp ${fmt(fv,2)}. Harga Rp ${fmt(price,0)}. PE saat ini ${(price/v.eps).toFixed(1)}x. ${upside > 0 ? `PE < 15x → saham murah relatif laba. BELI.` : `PE > 15x → saham mahal. AVOID.`} Standar Graham untuk perusahaan normal.`,
      pe_12x: `Fair Value = EPS × 12 = Rp ${fmt(fv,2)}. Harga Rp ${fmt(price,0)}. PE pasar IDX rata-rata ~12x. ${upside > 0 ? `Di bawah rata-rata pasar → MURAH. BELI.` : `Di atas rata-rata pasar → MAHAL. AVOID.`}`,
      pbv_1x: `Fair Value = BVPS × 1.0 = Rp ${fmt(fv,2)}. Harga Rp ${fmt(price,0)}. PBV saat ini ${v.pbv.toFixed(2)}x. ${upside > 0 ? `PBV < 1.0 → saham di bawah nilai buku → MURAH (margin of safety tinggi). BELI.` : `PBV > 1.0 → premium. Perlu justifikasi ROE tinggi.`}`,
      pbv_1_5x: `Fair Value = BVPS × 1.5 = Rp ${fmt(fv,2)}. Harga Rp ${fmt(price,0)}. Premium 1.5x wajar jika ROE > cost of capital (10%). ROE saat ini ${v.roe}%. ${v.roe > 10 ? `ROE ${v.roe}% > 10% → premium justified. ${upside > 0 ? 'BELI.' : 'HOLD.'}` : `ROE ${v.roe}% < 10% → premium tidak justified. AVOID.`}`,
      asset_based: `NAV/share = Ekuitas / Saham = Rp ${fmt(fv,2)}. Harga Rp ${fmt(price,0)}. ${upside > 0 ? `Harga di bawah NAV → saham murah (asset backing). BELI (cocok untuk properti/tambang/manufaktur).` : `Harga di atas NAV → premium. Perlu earning power untuk justify.`} Kurang relevan untuk asset-light (tech/jasa).`,
      liquidation: `Liquidation Value = (Aset - Liab) / Saham = Rp ${fmt(fv,2)}. Harga Rp ${fmt(price,0)}. ${upside > 0 ? `Harga < nilai likuidasi → "net-net" (Graham). STRONG BUY — margin of safety sangat tinggi.` : `Harga > nilai likuidasi → normal (valued as going concern).`} Cocok untuk deep value screening.`,
      epv: `EPV = EPS / 10% = Rp ${fmt(fv,2)}. Harga Rp ${fmt(price,0)}. ${upside > 0 ? `Laba cukup untuk justify harga → MURAH. BELI.` : `Perlu growth untuk justify harga → MAHAL. AVOID (terlalu bergantung pada growth).`} Asumsi laba stabil tanpa growth.`,
      ddm: `DDM (Gordon) = D1/(r-g) = Rp ${fmt(fv,2)}. Harga Rp ${fmt(price,0)}. ${upside > 0 ? `Dividen cukup tinggi → MURAH. BELI (cocok untuk dividend stocks).` : `Dividen yield rendah → MAHAL. AVOID (growth play, bukan income play).`} Parameter: payout 30%, growth 3%, required return 10%.`,
      residual_income: `RI = BVPS + (ROE-r)×BVPS/(r-g) = Rp ${fmt(fv,2)}. Harga Rp ${fmt(price,0)}. ROE ${v.roe}% vs required return 10%. ${v.roe > 10 ? `ROE > 10% → perusahaan menciptakan value (value creator). ${upside > 0 ? 'BELI.' : 'HOLD.'}` : `ROE < 10% → perusahaan menghancurkan value (value destroyer). AVOID.`}`,
      graham_revised: `Graham's Revised = EPS × (8.5 + 2×5%) = Rp ${fmt(fv,2)}. Harga Rp ${fmt(price,0)}. ${upside > 0 ? `Growth tidak terharga sepenuhnya → MURAH. BELI.` : `Growth sudah terharga penuh → MAHAL. AVOID.`} Cocok untuk growth moderate (5-15%).`,
      peg_based: `PEG-Based = EPS × Growth% = Rp ${fmt(fv,2)}. Harga Rp ${fmt(price,0)}. PEG = PE/Growth = ${v.pe != null ? (v.pe/5).toFixed(2) : '-'}. ${upside > 0 ? `PEG < 1 → undervalued relatif growth. BELI.` : `PEG > 1 → overvalued. AVOID.`} Cocok untuk growth stocks.`,
      dcf: `DCF = EPS×(1+g)/(r-g) = Rp ${fmt(fv,2)}. Harga Rp ${fmt(price,0)}. ${upside > 0 ? `Cash flow masa depan cukup tinggi → MURAH. BELI.` : `Cash flow tidak cukup justify harga → MAHAL. AVOID.`} Sensitif terhadap asumsi growth (5%) dan discount rate (10%).`,
      ncav: `NCAV = (0.8×Aset - Liab)/Saham = Rp ${fmt(fv,2)}. Harga Rp ${fmt(price,0)}. ${upside > 0 ? `Harga < NCAV → "net-net" (Graham). STRONG BUY — margin of safety sangat tinggi.` : fv < 0 ? `NCAV negatif → liabilitas > aset. Tidak cocok (leverage tinggi). AVOID (terutama bank/financial).` : `Harga > NCAV → normal. Tidak ada margin of safety ekstrem.`} Cocok untuk deep value, asset-heavy.`,
    };
    explanation = explanations[methodKey] || `${m.name}: Fair Value Rp ${fmt(fv,2)} vs Harga Rp ${fmt(price,0)}. ${upside > 0 ? 'Undervalued — BELI.' : 'Overvalued — AVOID.'}`;
  }

  const ov = document.createElement('div');
  ov.id = 'methodOverlay';
  ov.className = 'overlay';
  ov.onclick = closeMethodPopup;
  document.body.appendChild(ov);

  const popup = document.createElement('div');
  popup.id = 'methodPopup';
  popup.className = 'detail';
  popup.style.cssText = 'max-width:600px;';
  popup.innerHTML = `
    <div class="modal-header">
      <h5 class="modal-title">${m.name}</h5>
      <button type="button" class="btn-close" onclick="closeMethodPopup()">&times;</button>
    </div>
    <div class="modal-body">
      <div style="text-align:center;margin-bottom:14px">
        <span style="display:inline-block;padding:6px 20px;border-radius:4px;font-size:15px;font-weight:600;background:${verdictBg};color:${verdictColor}">${verdict}</span>
      </div>
      <table>
        <tr><td>Formula</td><td style="font-family:monospace;font-size:12px">${m.formula}</td></tr>
        <tr><td>Fair Value</td><td class="num" style="font-weight:600">${isPriceMethod ? 'Rp ' + fmt(fv,2) : (methodKey==='earnings_yield' ? fv.toFixed(2)+'%' : fv.toFixed(2))}</td></tr>
        <tr><td>Harga Pasar</td><td class="num">Rp ${fmt(price,0)}</td></tr>
        ${isPriceMethod ? `<tr><td>Selisih (vs Harga)</td><td class="num" style="color:${fv>price?'#0f5132':'#842029'};font-weight:600">${fv>price?'+':''}${((fv-price)/price*100).toFixed(2)}%</td></tr>` : ''}
        <tr><td>Deskripsi</td><td style="font-size:12px">${m.description}</td></tr>
      </table>
      <div style="margin-top:12px;padding:12px;background:#f8f9fa;border-radius:4px;border-left:3px solid ${verdictColor};font-size:13px;line-height:1.6">
        <b>Analisa:</b><br>${explanation}
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn secondary" onclick="closeMethodPopup()">Tutup</button>
    </div>
  `;
  document.body.appendChild(popup);
  ov.classList.remove('hidden');
  popup.classList.remove('hidden');
}

function closeMethodPopup() {
  const p = document.getElementById('methodPopup');
  if (p) p.remove();
  const o = document.getElementById('methodOverlay');
  if (o) o.remove();
}

function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}


function renderIHSG() {
  const el = document.getElementById('ihsgGrid');
  if (!el) return;
  const rows = filtered.length ? filtered : DATA;
  const totalMC = rows.reduce((s,d)=>s+(d.mcap||0),0);
  const totalNI = rows.reduce((s,d)=>s+(d.laba||0),0);
  const totalEq = rows.reduce((s,d)=>s+(d.equity||0),0);
  const aggPE = (totalNI>0) ? totalMC/totalNI : null;
  const aggPBV = (totalEq>0) ? totalMC/totalEq : null;
  const fairMC = (totalNI>0) ? totalNI*15 : null; // fair PE 15x
  const upside = (fairMC && totalMC>0) ? (fairMC-totalMC)/totalMC*100 : null;
  const diskon = rows.filter(d=>(d.kategori||'').includes('Diskon')).length;
  const mahal = rows.filter(d=>(d.kategori||'').includes('Mahal')).length;
  el.innerHTML = `
    <div class="ihsg-card"><div class="lbl">Total Market Cap (Rp miliar)</div><div class="val">${fmt(totalMC,0)}</div></div>
    <div class="ihsg-card"><div class="lbl">Total Laba (Rp miliar)</div><div class="val">${fmt(totalNI,0)}</div></div>
    <div class="ihsg-card"><div class="lbl">Aggregate PE (x)</div><div class="val">${aggPE?aggPE.toFixed(2):'-'}</div></div>
    <div class="ihsg-card"><div class="lbl">Total Ekuitas (Rp miliar)</div><div class="val">${fmt(totalEq,0)}</div></div>
    <div class="ihsg-card"><div class="lbl">Aggregate PBV (x)</div><div class="val">${aggPBV?aggPBV.toFixed(2):'-'}</div></div>
    <div class="ihsg-card"><div class="lbl">Fair Value Market Cap (PE 15x)</div><div class="val">${fairMC?fmt(fairMC,0):'-'}</div></div>
    <div class="ihsg-card"><div class="lbl">Upside ke Fair Value (%)</div><div class="val" style="color:${upside!=null && upside>0?'#006100':'#9c0006'}">${upside!=null?upside.toFixed(2)+'%':'-'}</div></div>
    <div class="ihsg-card"><div class="lbl">Emiten Diskon / Mahal</div><div class="val">${diskon} / ${mahal}</div></div>
  `;
}

async function loadJenis() {
  const el = document.getElementById('jenisWrap');
  if (!el) return;
  // build distribution from DATA
  const counts = {};
  DATA.forEach(d => { const j = d.jenis || 'Lain'; counts[j] = (counts[j]||0)+1; });
  const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  let html = '<h2 style="color:#1f3864;margin:0 0 12px">Klasifikasi Jenis Saham (16 Jenis)</h2>';
  html += '<div class="ihsg-grid" style="margin-bottom:16px">';
  sorted.forEach(([name, cnt]) => {
    html += `<div class="ihsg-card"><div class="lbl">${name}</div><div class="val">${cnt}</div><div class="lbl">${(cnt/DATA.length*100).toFixed(1)}%</div></div>`;
  });
  html += '</div>';
  // descriptions
  const desc = {
    'Saham Kapal Induk': 'Bank besar & stabil dengan fundamental kuat, pertumbuhan konsisten (blue-chip bank).',
    'Saham Death Star': 'Ekuitas negatif / laba negatif, saham yang sudah habis masanya, hindari.',
    'Saham Patriot': 'BUMN, aturan main ditentukan pemerintah; tidak selalu bagus/jelek.',
    'Saham Siput': 'Perubahan harga sangat lambat, capital gain kecil (5-10%/thn), butuh waktu lama.',
    'Saham Blue Chip': 'Perusahaan besar, mapan, catatan keuangan kuat, stabil dan aman.',
    'Saham Siklikal': 'Kinerja terkait kondisi ekonomi & siklus bisnis, fluktuatif.',
    'Saham Pertumbuhan': 'Pertumbuhan laba tinggi vs rata-rata industri, nilai terus meningkat.',
    'Saham Nilai': 'Diperdagangkan murah vs nilai intrinsik, harga diharapkan naik.',
    'Saham Pendapatan Tetap': 'Memberikan pendapatan tetap (dividen) dari pendapatan stabil.',
    'Saham Perusahaan Kecil': 'Small-cap, berisiko tinggi tapi potensi keuntungan besar.',
    'Saham Perusahaan Menengah': 'Mid-cap, risiko sedang, potensi pertumbuhan cukup baik.',
    'Saham Perusahaan Besar': 'Large-cap, stabil dan aman, catatan keuangan kuat.',
    'Saham Pilihan Karyawan': 'Diberikan ke karyawan sebagai remunerasi (ESOP), ada periode vesting.',
    'Saham Aksi': 'Saham yang dibeli kembali perusahaan (treasury), strategi internal.',
    'Saham Spekulatif': 'Risiko tinggi, potensi imbal hasil besar, butuh pengetahuan pasar.',
    'Saham Pendiri': 'Dimiliki pendiri/pemegang utama, pengaruh besar pada arah perusahaan.',
  };
  html += '<h3 style="color:#1f3864;margin:16px 0 8px">Keterangan Jenis</h3>';
  html += '<table><thead><tr><th>Jenis Saham</th><th>Jumlah</th><th>Keterangan</th></tr></thead><tbody>';
  sorted.forEach(([name, cnt]) => {
    html += `<tr><td><b>${name}</b></td><td class="num">${cnt}</td><td>${desc[name]||'-'}</td></tr>`;
  });
  html += '</tbody></table>';
  // list emiten by selected type? show all with jenis in table
  html += '<h3 style="color:#1f3864;margin:16px 0 8px">Daftar Emiten per Jenis</h3>';
  html += '<div style="margin-bottom:8px"><select id="jenisFilter" class="btn secondary"><option value="">Semua Jenis</option>' + sorted.map(([n])=>`<option>${n}</option>`).join('') + '</select></div>';
  html += '<table id="tblJenis"><thead><tr><th>Kode</th><th>Nama</th><th>Jenis</th><th>Sektor</th><th>PBV</th><th>Market Cap</th><th>Klasifikasi</th></tr></thead><tbody></tbody></table>';
  el.innerHTML = html;
  const renderJenisTable = (filter) => {
    const tbody = document.querySelector('#tblJenis tbody');
    const rows = DATA.filter(d => !filter || d.jenis === filter);
    tbody.innerHTML = rows.map(d => `<tr onclick="showDetail('${d.code}')"><td><b>${d.code}</b></td><td>${d.name||''}</td><td>${d.jenis||'-'}</td><td>${d.sector||''}</td><td class="num">${fmt(d.pbv)}</td><td class="num">${fmt(d.mcap,0)}</td><td>${badgeKlas(d.klas)}</td></tr>`).join('');
  };
  renderJenisTable('');
  document.getElementById('jenisFilter').addEventListener('change', (e) => renderJenisTable(e.target.value));
}

async function loadNews() {
  const el = document.getElementById('newsList');
  if (!el) return;
  try {
    const res = await fetch('api/news.php');
    if (res.ok) {
      const json = await res.json();
      const items = json.items || [];
      if (items.length === 0) { el.innerHTML = '<p>Tidak ada berita.</p>'; return; }
      el.innerHTML = items.map(it => `
        <div class="news-item">
          <a href="${it.link}" target="_blank" rel="noopener">${it.title}</a>
          <div class="news-meta">${it.source||''} ${it.pubDate?'· '+new Date(it.pubDate).toLocaleDateString('id-ID'):''}</div>
        </div>
      `).join('');
      return;
    }
  } catch (e) {}
  el.innerHTML = '<p>Gagal memuat berita.</p>';
}

document.getElementById('search').addEventListener('input', applyFilters);
document.getElementById('sectorFilter').addEventListener('change', applyFilters);
document.getElementById('groupFilter').addEventListener('change', applyFilters);
document.getElementById('katFilter').addEventListener('change', applyFilters);
document.getElementById('klasFilter').addEventListener('change', applyFilters);
document.getElementById('solFilter').addEventListener('change', applyFilters);
document.getElementById('sortBy').addEventListener('change', (e) => {
  sortState.key = e.target.value;
  sortState.dir = 'asc';
  applyFilters();
});
document.getElementById('resetBtn').addEventListener('click', () => {
  document.getElementById('search').value = '';
  document.getElementById('sectorFilter').value = '';
  document.getElementById('groupFilter').value = '';
  document.getElementById('katFilter').value = '';
  document.getElementById('klasFilter').value = '';
  document.getElementById('solFilter').value = '';
  document.getElementById('sortBy').value = 'pbv';
  applyFilters();
});
document.getElementById('exportBtn').addEventListener('click', exportExcel);
document.getElementById('refreshBtn').addEventListener('click', async () => {
  try {
    const res = await fetch('api/companies.php', { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json) && json.length > 0) {
        DATA = json.map(normalize);
        applyFilters();
        toast('Data diperbarui dari API');
      }
    }
  } catch (e) { toast('Gagal refresh: ' + e.message); }
});

// Auto-refresh from API every 60s
setInterval(async () => {
  try {
    const res = await fetch('api/companies.php', { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json) && json.length > 0) {
        DATA = json.map(normalize);
        applyFilters();
        toast('Data diperbarui dari API');
      }
    }
  } catch (e) {}
}, 60000);

init();
