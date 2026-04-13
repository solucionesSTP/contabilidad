// ══════════════════════════════════════
// SISTEMA DE CONTABILIDAD — VERSIÓN LOCAL (WINDOWS 10)
// ══════════════════════════════════════

var MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
var curSec = 'dashboard';
var curMes = '';
var editCtx = null;

var SUBCATS = ['Gastos de Distribucion', 'Transporte', 'Publicidad', 'Comisiones', 'Gastos de mantenimiento', 'Reparaciones', 'Gastos de suscripcion', 'Herramientas digitales', 'Gastos de Otros Servicios', 'Alimento y otros Suministros', 'Salario indirecto', 'Renta', 'Servicio de teneduria de libros', 'Intereses de prestamos', 'Perdida cambio monetario'];
var COSTOS_DESC = ['Materia prima', 'Salario Directo', 'Servicio Alimentacion', 'Gastos de Servicios Publicos', 'Gastos de mantenimiento', 'Gastos de Otros Servicios'];
var SH_MAP = { ventas: 'Ventas', gastos: 'Gastos', costos: 'Costos', compras: 'Compras' };

// ── Utilidades ──
function $(id) { return document.getElementById(id); }
function f(n) { var p = Number(n || 0).toFixed(2).split('.'); return '$' + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + p[1]; }
function fp(n) { return (Number(n || 0)).toFixed(2) + '%'; }
function fr(n) { return (Number(n || 0)).toFixed(2); }
function mn(m) { return MESES[Number(m)] || ''; }
function r2(n) { return Math.round(Number(n || 0) * 100) / 100; }

function fd(v) {
  if (!v) return '';
  var s = String(v);
  if (s.indexOf('T') !== -1) { var p = s.split('T')[0].split('-'); if (p.length === 3) return p[2] + '/' + p[1] + '/' + p[0]; }
  return s;
}

function fdI(v) {
  if (!v) return '';
  var s = String(v);
  if (s.indexOf('T') !== -1) return s.split('T')[0];
  if (s.indexOf('/') !== -1) { var p = s.split('/'); if (p.length === 3) return p[2] + '-' + p[1] + '-' + p[0]; }
  return s;
}

function showLoader() { $('loader').classList.remove('hidden'); }
function hideLoader() { $('loader').classList.add('hidden'); }

function toast(msg, t) {
  t = t || 'i'; var d = document.createElement('div'); d.className = 'toast ' + t; d.textContent = msg;
  $('toC').appendChild(d); setTimeout(function () { if (d.parentNode) d.remove(); }, 3100);
}

// ══════════════════════════
// COMUNICACIÓN CON EL SERVIDOR LOCAL
// ══════════════════════════
async function sv(action) {
  var args = Array.prototype.slice.call(arguments, 1);
  var url = '', options = { headers: { 'Content-Type': 'application/json' } };

  if (action === 'getSheetData') {
    url = '/api/data?table=' + encodeURIComponent(args[0]);
  }
  else if (action === 'readConfig') {
    url = '/api/config';
  }
  else if (action === 'writeConfig') {
    url = '/api/config'; options.method = 'POST'; options.body = JSON.stringify(args[0]);
  }
  else if (action === 'addRow') {
    url = '/api/data?table=' + encodeURIComponent(args[0]); options.method = 'POST'; options.body = JSON.stringify(args[1]);
  }
  else if (action === 'editRow') {
    url = '/api/data?table=' + encodeURIComponent(args[0]) + '&id=' + args[1]; options.method = 'PUT'; options.body = JSON.stringify(args[2]);
  }
  else if (action === 'removeRow') {
    url = '/api/data?table=' + encodeURIComponent(args[0]) + '&id=' + args[1]; options.method = 'DELETE';
  }
  else if (action === 'addCompraConStock') {
    await sv('addRow', 'Compras', args[0]);
    if (String(args[0]['Stock'] || '').trim() === 'Sí') { await handleStockLogic(args[0]); }
    return;
  }
  else if (action === 'loadDashboard') {
    return await calcDashboardLocal(args[0] || null);
  }

  const res = await fetch(url, options);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

// ── Lógica de Inventario automático (Navegador) ──
async function handleStockLogic(datos) {
  var cant = Number(datos['Cantidad'] || 0), precio = Number(datos['Precio'] || 0);
  var producto = String(datos['Producto'] || '').trim();
  var um = String(datos['U/M'] || 'unidad').trim();
  var mes = String(datos['Mes'] || '').trim();

  var invData = await sv('getSheetData', 'Inventario_Final');
  var found = false;
  for (var i = 0; i < invData.r.length; i++) {
    if (String(invData.r[i]['Producto'] || '').trim() === producto &&
      String(invData.r[i]['U/M'] || '').trim() === um &&
      String(invData.r[i]['Mes'] || '').trim() === mes) {
      var newCant = Number(invData.r[i]['Cantidad'] || 0) + cant;
      await sv('editRow', 'Inventario_Final', invData.r[i]._row, { 'Cantidad': newCant, 'Precio': precio, 'Valor Total': newCant * precio });
      found = true; break;
    }
  }
  if (!found) {
    await sv('addRow', 'Inventario_Final', { 'Producto': producto, 'U/M': um, 'Cantidad': cant, 'Precio': precio, 'Valor Total': cant * precio, 'Mes': mes });
  }
}

// ══════════════════════════
// CÁLCULOS EN EL NAVEGADOR
// ══════════════════════════
function calcEstadoLocal(mes, vR, cR, gR, iiR, ifR) {
  var m = mes || null;
  var ventas = 0;
  vR.forEach(function (r) { if (!m || String(r['Mes'] || '').trim() === String(m).trim()) ventas += Number(r['Transferencia'] || 0) + Number(r['Efectivo'] || 0) + Number(r['Otros Activos'] || 0); });
  var cv = 0, cf = 0, cvar = 0;
  cR.forEach(function (r) { if (!m || String(r['Mes'] || '').trim() === String(m).trim()) { var v = Number(r['Monto'] || 0); cv += v; if (String(r['Tipo'] || '').trim() === 'Fijo') cf += v; else cvar += v; } });
  var go = 0, gf = 0, ga = 0, imp = 0;
  gR.forEach(function (r) { if (!m || String(r['Mes'] || '').trim() === String(m).trim()) { var v = Number(r['Monto'] || 0); var c = String(r['Categoria'] || '').trim(); if (c === 'Operativo') go += v; else if (c === 'Financiero') gf += v; else if (c === 'Administrativo') ga += v; else if (c === 'Impuestos') imp += v; } });
  var ii = 0, iff = 0;
  iiR.forEach(function (r) { if (!m || String(r['Mes'] || '').trim() === String(m).trim()) ii += Number(r['Valor Total'] || 0); });
  ifR.forEach(function (r) { if (!m || String(r['Mes'] || '').trim() === String(m).trim()) iff += Number(r['Valor Total'] || 0); });
  var gt = go + gf + ga, ub = ventas - cv, mb = ventas > 0 ? ub / ventas * 100 : 0, uo = ub - gt, mo = ventas > 0 ? uo / ventas * 100 : 0, un = uo - imp, mn = ventas > 0 ? un / ventas * 100 : 0;
  return { ventas: ventas, cv: cv, ub: ub, mb: r2(mb), go: go, gf: gf, ga: ga, gt: gt, uo: uo, mo: r2(mo), imp: imp, un: un, mn: r2(mn), cf: cf, cvar: cvar, ii: ii, iff: iff };
}

function calcRatiosLocal(e, cfgR) {
  var p = {}; cfgR.forEach(function (r) { p[String(r['Parametro'] || '').trim().toLowerCase()] = Number(r['Valor'] || 0); });
  var ef = p['efectivo'] || 0, eq = p['equivalentes de efectivo'] || 0, ac = p['activos corrientes'] || 0, pc = p['pasivos corrientes'] || 0, pn = p['patrimonio neto'] || 0, at = p['activos totales'] || 0, pt = p['pasivo total'] || 0, vc = p['ventas a credito'] || 0, cpp = p['cuentas pc promedio'] || 0, ip = (e.ii + e.iff) / 2, tp = pc + pt;
  return { ef: ef, eq: eq, ac: ac, pc: pc, pn: pn, at: at, pt: pt, vc: vc, cpp: cpp, ip: ip, tp: tp, lc: pc > 0 ? ac / pc : 0, tes: pc > 0 ? (ef + eq) / pc : 0, pa: pc > 0 ? (ac - e.iff) / pc : 0, li: pc > 0 ? ef / pc : 0, roe: pn > 0 ? e.un / pn * 100 : 0, roa: at > 0 ? e.un / at * 100 : 0, end: at > 0 ? tp / at * 100 : 0, ci: e.gf > 0 ? e.uo / e.gf : 0, ri: ip > 0 ? e.cv / ip : 0, rcpc: cpp > 0 ? e.go / cpp : 0 };
}

async function calcDashboardLocal(mes) {
  var res = await Promise.all([sv('getSheetData', 'Ventas'), sv('getSheetData', 'Costos'), sv('getSheetData', 'Gastos'), sv('getSheetData', 'Inventario_Inicial'), sv('getSheetData', 'Inventario_Final'), sv('readConfig')]);
  var estado = calcEstadoLocal(mes, res[0].r, res[1].r, res[2].r, res[3].r, res[4].r);
  var ratios = calcRatiosLocal(estado, res[5].r);
  return { estado: estado, ratios: ratios };
}

// ══════════════════════════
// NAVEGACIÓN
// ══════════════════════════
$('nav').addEventListener('click', function (e) { var a = e.target.closest('a[data-s]'); if (!a) return; go(a.dataset.s); $('sb').classList.remove('open'); });
$('mobBtn').addEventListener('click', function () { $('sb').classList.toggle('open'); });
$('mf').addEventListener('change', function (e) { curMes = e.target.value; load(curSec); });

function go(s) {
  curSec = s; var links = document.querySelectorAll('#nav a'); for (var i = 0; i < links.length; i++) links[i].classList.toggle('on', links[i].dataset.s === s);
  var secs = document.querySelectorAll('.sec'); for (var j = 0; j < secs.length; j++) secs[j].classList.toggle('on', secs[j].id === 's-' + s);
  var titles = { dashboard: 'Dashboard', ventas: 'Ventas', gastos: 'Gastos', costos: 'Costos', compras: 'Compras', inventario: 'Inventario', estado: 'Estado de Resultado', ratios: 'Indicadores Financieros', config: 'Configuracion' };
  $('pgT').textContent = titles[s] || s; updActs(s); load(s); window.location.hash = s;
}

function updActs(s) {
  var el = $('topA'); var crud = ['ventas', 'gastos', 'costos', 'compras']; var pdf = ['estado', 'ratios']; var h = '';
  if (crud.indexOf(s) !== -1) h += '<button class="bt bt-p" onclick="openAdd(\'' + s + '\')"><i class="fas fa-plus"></i> Agregar</button>';
  if (pdf.indexOf(s) !== -1) h += '<button class="bt bt-s" onclick="doPrint(\'' + s + '\')"><i class="fas fa-file-pdf"></i> Exportar PDF</button>';
  el.innerHTML = h;
}

function load(s) {
  switch (s) { case 'dashboard': loadDash(); break; case 'ventas': loadTbl('Ventas', 'tbV', rV); break; case 'gastos': loadTbl('Gastos', 'tbG', rG); break; case 'costos': loadTbl('Costos', 'tbC', rC); break; case 'compras': loadTbl('Compras', 'tbCo', rCo); break; case 'inventario': loadInv(); break; case 'estado': loadEst(); break; case 'ratios': loadRat(); break; case 'config': loadCfg(); break; }
}

function kpi(l, v, s, c, cls) { return '<div class="kpi ' + c + '"><div class="kpi-l">' + l + '</div><div class="kpi-v">' + v + '</div>' + (s ? '<div class="kpi-s ' + (cls || '') + '">' + s + '</div>' : '') + '</div>'; }

// ══════════════════════════
// DASHBOARD Y GRÁFICOS
// ══════════════════════════
function loadDash() {
  showLoader();
  sv('loadDashboard', curMes || null).then(function (d) {
    hideLoader();
    var e = d.estado;
    $('kpiG').innerHTML = [kpi('Ventas Netas', f(e.ventas), '', 'c1'), kpi('Utilidad Bruta', f(e.ub), 'Margen: ' + fp(e.mb), 'c2', e.mb >= 50 ? 'ok' : 'no'), kpi('Utilidad Neta', f(e.un), 'Margen: ' + fp(e.mn), 'c3', e.un >= 0 ? 'ok' : 'no'), kpi('Gastos Totales', f(e.gt), 'Oper.+Fin.+Admon.', 'c4')].join('');
    $('mbG').innerHTML = [mb('Margen Bruto', e.mb, 'g'), mb('Margen Operativo', e.mo, 'a'), mb('Margen Neto', e.mn, e.mn >= 0 ? 'g' : 'r')].join('');
    $('dcCosto').innerHTML = '<div class="tc-h"><h3>Costos Fijos vs Variables</h3></div><table><thead><tr><th>Tipo</th><th class="n">Monto</th><th class="n">%</th></tr></thead><tbody><tr><td>Costos Fijos</td><td class="n">' + f(e.cf) + '</td><td class="n">' + (e.cv > 0 ? fp(e.cf / e.cv * 100) : '0%') + '</td></tr><tr><td>Costos Variables</td><td class="n">' + f(e.cvar) + '</td><td class="n">' + (e.cv > 0 ? fp(e.cvar / e.cv * 100) : '0%') + '</td></tr><tr class="tr-t"><td>Total</td><td class="n">' + f(e.cv) + '</td><td class="n">100%</td></tr></tbody></table>';
    $('dcGasto').innerHTML = '<div class="tc-h"><h3>Desglose de Gastos</h3></div><table><thead><tr><th>Categoria</th><th class="n">Monto</th><th class="n">%</th></tr></thead><tbody><tr><td>Operativos</td><td class="n">' + f(e.go) + '</td><td class="n">' + (e.gt > 0 ? fp(e.go / e.gt * 100) : '0%') + '</td></tr><tr><td>Financieros</td><td class="n">' + f(e.gf) + '</td><td class="n">' + (e.gt > 0 ? fp(e.gf / e.gt * 100) : '0%') + '</td></tr><tr><td>Administracion</td><td class="n">' + f(e.ga) + '</td><td class="n">' + (e.gt > 0 ? fp(e.ga / e.gt * 100) : '0%') + '</td></tr><tr class="tr-t"><td>Total</td><td class="n">' + f(e.gt) + '</td><td class="n">100%</td></tr></tbody></table>';
    drawBar(e); drawDon(e);
  }).catch(function (err) { hideLoader(); toast('Error: ' + err.message, 'e'); });
}

function mb(label, pct, c) { var cl = Math.max(0, Math.min(100, pct)); return '<div class="mb-i"><label>' + label + ' <span>' + fp(pct) + '</span></label><div class="mb-track"><div class="mb-fill ' + c + '" style="width:' + cl + '%"></div></div></div>'; }

function drawBar(e) {
  var cv = $('cvBar'); if (!cv) return;
  var ctx = cv.getContext('2d'), dpr = window.devicePixelRatio || 1, rect = cv.parentElement.getBoundingClientRect();
  cv.width = rect.width * dpr; cv.height = 200 * dpr; cv.style.width = rect.width + 'px'; cv.style.height = '200px';
  ctx.scale(dpr, dpr); var W = rect.width, H = 200; ctx.clearRect(0, 0, W, H);
  var vals = [e.ventas, e.cv, e.gt, Math.max(0, e.un)], labels = ['Ventas', 'Costos', 'Gastos', 'Util. Neta'], colors = ['#2d6a4f', '#b8860b', '#c1121f', '#457b9d'];
  var maxV = Math.max.apply(null, vals.concat([1])), pad = { t: 10, b: 36, l: 56, r: 16 }, cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;
  var barW = Math.min(50, (cW / vals.length) * 0.55), gap = (cW - barW * vals.length) / (vals.length + 1);
  ctx.strokeStyle = '#eae8e2'; ctx.lineWidth = 1;
  for (var i = 0; i <= 4; i++) { var y = pad.t + (cH / 4) * i; ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke(); ctx.fillStyle = '#999'; ctx.font = '10px Outfit,sans-serif'; ctx.textAlign = 'right'; ctx.fillText(f(maxV - (maxV / 4) * i), pad.l - 6, y + 3); }
  for (var j = 0; j < vals.length; j++) { var x = pad.l + gap + (barW + gap) * j, bH = (vals[j] / maxV) * cH, yy = pad.t + cH - bH; ctx.fillStyle = colors[j]; ctx.beginPath(); var rad = Math.min(4, barW / 4); ctx.moveTo(x, yy + rad); ctx.arcTo(x, yy, x + rad, yy, rad); ctx.arcTo(x + barW, yy, x + barW, yy + rad, rad); ctx.lineTo(x + barW, pad.t + cH); ctx.lineTo(x, pad.t + cH); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#666'; ctx.font = '10px Outfit,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(labels[j], x + barW / 2, H - 10); ctx.fillStyle = '#333'; ctx.font = '600 10px Outfit,sans-serif'; ctx.fillText(f(vals[j]), x + barW / 2, yy - 4); }
}

function drawDon(e) {
  var cv = $('cvDon'); if (!cv) return;
  var ctx = cv.getContext('2d'), dpr = window.devicePixelRatio || 1, rect = cv.parentElement.getBoundingClientRect();
  cv.width = rect.width * dpr; cv.height = 200 * dpr; cv.style.width = rect.width + 'px'; cv.style.height = '200px';
  ctx.scale(dpr, dpr); var W = rect.width, H = 200; ctx.clearRect(0, 0, W, H);
  var vals = [e.go, e.gf, e.ga], labels = ['Operativos', 'Financieros', 'Administracion'], colors = ['#e07a5f', '#c1121f', '#457b9d'];
  var total = vals.reduce(function (a, b) { return a + b; }, 0);
  if (total === 0) { ctx.fillStyle = '#ccc'; ctx.font = '13px Outfit,sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Sin datos de gastos', W / 2, H / 2); return; }
  var cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 20, r = R * 0.55, angle = -Math.PI / 2;
  for (var i = 0; i < vals.length; i++) { if (vals[i] === 0) continue; var slice = (vals[i] / total) * Math.PI * 2; ctx.beginPath(); ctx.arc(cx, cy, R, angle, angle + slice); ctx.arc(cx, cy, r, angle + slice, angle, true); ctx.closePath(); ctx.fillStyle = colors[i]; ctx.fill(); var mid = angle + slice / 2, lx = cx + Math.cos(mid) * (R + 14), ly = cy + Math.sin(mid) * (R + 14); ctx.fillStyle = '#444'; ctx.font = '10px Outfit,sans-serif'; ctx.textAlign = mid > Math.PI / 2 && mid < Math.PI * 1.5 ? 'right' : 'left'; ctx.fillText(labels[i] + ' ' + fp(vals[i] / total * 100), lx, ly + 3); angle += slice; }
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(cx, cy, r - 1, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#1b1b1b'; ctx.font = '800 18px Outfit,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(f(total), cx, cy + 1); ctx.fillStyle = '#999'; ctx.font = '10px Outfit,sans-serif'; ctx.fillText('Total Gastos', cx, cy + 16);
}

// ══════════════════════════
// TABLAS CRUD
// ══════════════════════════
function loadTbl(sh, tb, fn) { sv('getSheetData', sh).then(function (data) { var rows = curMes ? data.r.filter(function (r) { return String(r['Mes'] || '').trim() === String(curMes).trim(); }) : data.r; var el = $(tb); if (!rows.length) { el.innerHTML = '<tr><td colspan="20" class="empty"><i class="fas fa-inbox"></i>Sin registros para este periodo</td></tr>'; return; } el.innerHTML = rows.map(fn).join(''); }).catch(function (err) { toast('Error: ' + err.message, 'e'); }); }

function ab(sh, r) { return '<td class="acts"><button class="bt bt-s bt-i" onclick="openEdit(\'' + sh + '\',' + r._row + ')" title="Editar"><i class="fas fa-pen"></i></button><button class="bt bt-d bt-i" onclick="delRow(\'' + sh + '\',' + r._row + ')" title="Eliminar"><i class="fas fa-trash"></i></button></td>'; }

function rV(r) { var t = Number(r['Transferencia'] || 0) + Number(r['Efectivo'] || 0) + Number(r['Otros Activos'] || 0); return '<tr><td>' + fd(r['Fecha']) + '</td><td>' + (r['Descripcion'] || '') + '</td><td>' + (r['Tipo'] || '') + '</td><td class="n">' + f(r['Transferencia']) + '</td><td class="n">' + f(r['Efectivo']) + '</td><td class="n">' + f(r['Otros Activos']) + '</td><td class="n" style="font-weight:700">' + f(t) + '</td><td>' + mn(r['Mes']) + '</td>' + ab('Ventas', r) + '</tr>'; }

function rG(r) { return '<tr><td>' + fd(r['Fecha']) + '</td><td>' + (r['Descripcion'] || '') + '</td><td>' + (r['Subcategoria'] || '') + '</td><td class="n">' + f(r['Monto']) + '</td><td>' + (r['Tipo'] || '') + '</td><td>' + (r['Categoria'] || '') + '</td><td>' + (r['Factura'] || '-') + '</td>' + ab('Gastos', r) + '</tr>'; }

function rC(r) { return '<tr><td>' + fd(r['Fecha']) + '</td><td>' + (r['Descripcion'] || '') + '</td><td class="n">' + f(r['Monto']) + '</td><td>' + (r['Clasificacion'] || '') + '</td><td>' + (r['Tipo'] || '') + '</td><td>' + (r['Factura'] || '-') + '</td>' + ab('Costos', r) + '</tr>'; }

function rCo(r) { var stock = String(r['Stock'] || '').trim(); var sh = stock === 'Sí' ? '<span style="color:var(--accent);font-weight:700"><i class="fas fa-check-circle"></i> Sí</span>' : '<span style="color:var(--muted)">No</span>'; return '<tr><td>' + fd(r['Fecha']) + '</td><td>' + (r['Producto'] || '') + '</td><td>' + (r['Cantidad'] || '') + '</td><td>' + (r['U/M'] || '') + '</td><td class="n">' + f(r['Precio']) + '</td><td class="n" style="font-weight:700">' + f(r['Monto']) + '</td><td>' + sh + '</td>' + ab('Compras', r) + '</tr>'; }

// ══════════════════════════
// INVENTARIO
// ══════════════════════════
function loadInv() { Promise.all([sv('getSheetData', 'Inventario_Inicial'), sv('getSheetData', 'Inventario_Final')]).then(function (results) { var ii = results[0], iff = results[1]; var flt = function (r) { return !curMes || String(r['Mes'] || '').trim() === String(curMes).trim(); }; var ir = function (r, shN) { return '<tr><td>' + (r['Producto'] || '') + '</td><td>' + (r['U/M'] || '') + '</td><td>' + (r['Cantidad'] || '') + '</td><td class="n">' + f(r['Precio']) + '</td><td class="n" style="font-weight:700">' + f(r['Valor Total']) + '</td>' + ab(shN, r) + '</tr>'; }; $('tbII').innerHTML = ii.r.filter(flt).map(function (r) { return ir(r, 'Inventario_Inicial'); }).join('') || '<tr><td colspan="6" class="empty"><i class="fas fa-inbox"></i>Sin datos</td></tr>'; $('tbIF').innerHTML = iff.r.filter(flt).map(function (r) { return ir(r, 'Inventario_Final'); }).join('') || '<tr><td colspan="6" class="empty"><i class="fas fa-inbox"></i>Sin datos</td></tr>'; }).catch(function (err) { toast('Error: ' + err.message, 'e'); }); }

// ══════════════════════════
// ESTADO DE RESULTADO
// ══════════════════════════
function loadEst() { sv('loadDashboard', curMes || null).then(function (d) { var e = d.estado; var ml = curMes ? MESES[Number(curMes)] : 'Todos los meses'; $('estT').textContent = 'Estado de Resultado — ' + ml; var row = function (l, v, c) { return '<tr class="' + (c || '') + '"><td>' + l + '</td><td class="n">' + v + '</td></tr>'; }; var note = function (t) { return '<tr><td colspan="2" class="note">' + t + '</td></tr>'; }; var sl = function (t) { return '<tr class="sl"><td colspan="2">' + t + '</td></tr>'; }; var ib = 'Por cada peso vendido te quedan ' + Math.round(e.mb) + ' centavos disponibles para cubrir otros gastos.'; var io = 'La rentabilidad de la operacion antes de impuestos y gastos financieros es ' + (e.mo > 30 ? 'alta.' : 'baja.'); var in_ = 'Por cada peso vendido conservas ' + Math.round(e.mn) + ' centavos de Ganancia.'; if (e.mn >= 15) in_ += ' Empresa altamente competitiva y con gran capacidad de reinversion.'; $('tbE').innerHTML = row('Ventas Netas', f(e.ventas)) + row('Costos de Venta', f(e.cv), 'ind') + row('Utilidad Bruta', f(e.ub), 'sub') + row('Margen Bruto', fp(e.mb), 'mr') + note(ib) + sl('Gastos') + row('Gastos Operativos', f(e.go), 'ind') + row('Gastos Financieros', f(e.gf), 'ind') + row('Gastos Generales y de Administracion', f(e.ga), 'ind') + row('Total Gastos', f(e.gt), 'sub') + row('Utilidad Operativa', f(e.uo), 'sub') + row('Margen Operativo', fp(e.mo), 'mr') + note(io) + row('Impuestos', f(e.imp), 'ind') + row('Utilidad Neta', f(e.un), 'big') + row('Margen Neto', fp(e.mn), 'mr') + note(in_) + sl('Desglose de Costos') + row('Costos Fijos', f(e.cf), 'ind') + row('Costos Variables', f(e.cvar), 'ind') + row('Total Costos', f(e.cv), 'sub') + sl('Inventario') + row('Inventario Inicial', f(e.ii), 'ind') + row('Inventario Final', f(e.iff), 'ind'); }).catch(function (err) { toast('Error: ' + err.message, 'e'); }); }

// ══════════════════════════
// RATIOS
// ══════════════════════════
function loadRat() { sv('loadDashboard', curMes || null).then(function (d) { var r = d.ratios; var ml = curMes ? MESES[Number(curMes)] : 'Todos los meses'; function hc(t, items) { return '<div class="rt-c"><div class="rt-c-t">' + t + ' — ' + ml + '</div>' + items.map(function (i) { return '<div class="rt-r"><span class="l">' + i[0] + '</span><span class="v ' + (i[2] || '') + '">' + i[1] + '</span></div>'; }).join('') + '</div>'; } function rc(v, g, b) { return v >= g ? 'ok' : (v <= b ? 'no' : 'wa'); } $('rtG').innerHTML = hc('Ratios de Liquidez', [['Liquidez Corriente', fr(r.lc), rc(r.lc, 1.5, 0.8)], ['Tesoreria', fr(r.tes), rc(r.tes, 0.5, 0.1)], ['Prueba Acida', fr(r.pa), rc(r.pa, 1, 0.5)], ['Liquidez Inmediata', fr(r.li), rc(r.li, 0.2, 0.05)]]) + hc('Ratios de Rentabilidad', [['ROE (Retorno sobre Patrimonio)', fp(r.roe), rc(r.roe, 15, 0)], ['ROA (Retorno sobre Activos)', fp(r.roa), rc(r.roa, 5, 0)]]) + hc('Ratios de Solvencia', [['Endeudamiento', fp(r.end), r.end < 50 ? 'ok' : (r.end > 80 ? 'no' : 'wa')], ['Cobertura de Intereses', fr(r.ci), rc(r.ci, 3, 1)]]) + hc('Ratios de Eficiencia', [['Rotacion de Inventarios', fr(r.ri), ''], ['Rotacion de CPC', fr(r.rcpc), '']]) + hc('Otros Indicadores', [['Efectivo', f(r.ef)], ['Equivalentes de Efectivo', f(r.eq)], ['Cheques en transito', f(0)], ['Cuentas bancarias de ahorro', f(0)], ['Activos Corrientes', f(r.ac)], ['Pasivos Corrientes', f(r.pc)], ['Patrimonio Neto', f(r.pn)], ['Activos Totales', f(r.at)], ['Pasivo Total', f(r.pt)], ['Inventario Promedio', f(r.ip)], ['Ventas a Credito', f(r.vc)], ['Cuentas PC Promedio', f(r.cpp)]]); }).catch(function (err) { toast('Error: ' + err.message, 'e'); }); }

// ══════════════════════════
// CONFIGURACIÓN
// ══════════════════════════
function loadCfg() {
  sv('readConfig').then(function (d) {
    $('cfgG').innerHTML = d.r.map(function (r) { return '<div class="cfg-i"><label>' + (r['Parametro'] || '') + '</label><input type="number" step="0.01" data-k="' + (r['Parametro'] || '') + '" value="' + (r['Valor'] || 0) + '"></div>'; }).join(');}).catch(function(err){toast('Error: '+err.message,'e');});}

function saveCfg() { var inputs = document.querySelectorAll('#cfgG input[data-k]'); var pares = Array.prototype.map.call(inputs, function (i) { return { k: i.dataset.k, v: i.value }; }); sv('writeConfig', pares).then(function () { toast('Configuracion guardada', 's'); }); }

// ══════════════════════════
// MODALES Y FORMULARIOS
// ══════════════════════════
function opMo(title, html, onSv) { $('moT').textContent = title; $('moB').innerHTML = html; $('moSv').className = 'bt bt-p'; $('moSv').innerHTML = '<i class="fas fa-check"></i> Guardar'; $('moSv').onclick = onSv; $('moOv').classList.add('open'); }
function clMo() { $('moOv').classList.remove('open'); editCtx = null; }
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') clMo(); });
    $('moOv').addEventListener('click', function (e) { if (e.target === e.currentTarget) clMo(); });

    function moSel() { return '<option value="">-- Mes --</option>' + MESES.slice(1).map(function (m, i) { return '<option value="' + (i + 1) + '">' + m + '</option>'; }).join(''); }
    function selOpt(opts, sel) { return opts.map(function (o) { return '<option' + (String(sel || '').trim() === String(o).trim() ? ' selected' : '') + '>' + o + '</option>'; }).join(''); }
    function fg(l, n, t, v, x) {
      return '<div class="fg"><label>' + l + '</label><input type="' + (t || 'text') + '" name="' + n + '" value="' + (v !== undefined && v !== null ? String(v) : '') + '" ' + (x || '') + '></div>';
    }
    function fs(l, n, opts) { return '<div class="fg"><label>' + l + '</label><select name="' + n + '">' + opts + '</select></div>'; }

    function formHTML(sec, d) {
      d = d || {}; var ms = moSel(); var mesVal = String(d['Mes'] || '').trim(); if (mesVal) ms = ms.replace('value="' + mesVal + '"', 'value="' + mesVal + '" selected');
      switch (sec) {
        case 'ventas': return '<div class="fr">' + fg('Fecha', 'Fecha', 'date', fdI(d['Fecha'])) + '</div>' + fg('Descripcion', 'Descripcion', 'text', d['Descripcion']) + fs('Tipo', 'Tipo', selOpt(['Venta Neta', 'IPV', 'Otra Venta'], d['Tipo'])) + '<div class="fr">' + fg('Transferencia', 'Transferencia', 'number', d['Transferencia'] || '0', 'step="0.01"') + fg('Efectivo', 'Efectivo', 'number', d['Efectivo'] || '0', 'step="0.01"') + '</div>' + fg('Otros Activos', 'Otros Activos', 'number', d['Otros Activos'] || '0', 'step="0.01"') + fs('Mes', 'Mes', ms);
        case 'gastos': return '<div class="fr">' + fg('Fecha', 'Fecha', 'date', fdI(d['Fecha'])) + '</div>' + fg('Descripcion', 'Descripcion', 'text', d['Descripcion']) + fs('Categoria', 'Categoria', selOpt(['Operativo', 'Financiero', 'Administrativo', 'Impuestos'], d['Categoria'])) + fs('Subcategoria', 'Subcategoria', selOpt(SUBCATS, d['Subcategoria'])) + fg('Monto', 'Monto', 'number', d['Monto'] || '0', 'step="0.01"') + fs('Clasificacion', 'Clasificacion', selOpt(['Varia', 'No Varia'], d['Clasificacion'])) + fs('Tipo', 'Tipo', selOpt(['Fijo', 'Variable'], d['Tipo'])) + fg('Factura', 'Factura', 'text', d['Factura']) + fs('Mes', 'Mes', ms);
        case 'costos': return '<div class="fr">' + fg('Fecha', 'Fecha', 'date', fdI(d['Fecha'])) + '</div>' + fs('Descripcion', 'Descripcion', selOpt(COSTOS_DESC, d['Descripcion'])) + fg('Monto', 'Monto', 'number', d['Monto'] || '0', 'step="0.01"') + fs('Clasificacion', 'Clasificacion', selOpt(['Varia', 'No Varia'], d['Clasificacion'])) + fs('Tipo', 'Tipo', selOpt(['Fijo', 'Variable'], d['Tipo'])) + fg('Factura', 'Factura', 'text', d['Factura']) + fs('Mes', 'Mes', ms);
        case 'compras': return '<div class="fr">' + fg('Fecha', 'Fecha', 'date', fdI(d['Fecha'])) + '</div>' + fg('Producto', 'Producto', 'text', d['Producto']) + '<div class="fr">' + fg('Cantidad', 'Cantidad', 'number', d['Cantidad'] || '0', 'step="0.01"') + fg('U/M', 'U/M', 'text', d['U/M'] || 'unidad') + '</div>' + fg('Precio Unitario', 'Precio', 'number', d['Precio'] || '0', 'step="0.01"') + fs('Agregar al Stock', 'Stock', selOpt(['No', 'Sí'], d['Stock'] || 'No')) + fs('Mes', 'Mes', ms);
      }
      return '';
    }

    function getFormData() { var inputs = $('moB').querySelectorAll('input,select'); var d = {}; for (var i = 0; i < inputs.length; i++) d[inputs[i].name] = inputs[i].value; return d; }

    function openAdd(sec) { editCtx = null; var l = sec.charAt(0).toUpperCase() + sec.slice(1); opMo('Agregar ' + l, formHTML(sec), function () { saveFromForm(sec); }); }

    function openEdit(sh, row) {
      sv('getSheetData', sh).then(function (data) {
        var r = null; for (var i = 0; i < data.r.length; i++) { if (data.r[i]._row === row) { r = data.r[i]; break; } } if (!r) return;
        editCtx = { sh: sh, row: row };
        if (sh === 'Inventario_Inicial' || sh === 'Inventario_Final') {
          var t = sh === 'Inventario_Inicial' ? 'Inventario Inicial' : 'Inventario Final';
          var ms = moSel(); var mv = String(r['Mes'] || '').trim(); if (mv) ms = ms.replace('value="' + mv + '"', 'value="' + mv + '" selected');
          opMo('Editar ' + t, fg('Producto', 'Producto', 'text', r['Producto']) + fg('U/M', 'U/M', 'text', r['U/M']) + '<div class="fr">' + fg('Cantidad', 'Cantidad', 'number', r['Cantidad'], 'step="0.01"') + fg('Precio', 'Precio', 'number', r['Precio'], 'step="0.01"') + '</div>' + fs('Mes', 'Mes', ms), function () { saveInv(sh); });
        } else {
          var sec = null; for (var k in SH_MAP) { if (SH_MAP[k] === sh) { sec = k; break; } }
          if (sec) { var l = sec.charAt(0).toUpperCase() + sec.slice(1); opMo('Editar ' + l, formHTML(sec, r), function () { saveFromForm(sec); }); }
        }
      }).catch(function (err) { toast('Error: ' + err.message, 'e'); });
    }

    function saveFromForm(sec) {
      var d = getFormData(); if (!d.Fecha) { toast('La fecha es obligatoria', 'e'); return; } if (!d.Mes) { toast('El mes es obligatorio', 'e'); return; }
      if (sec === 'compras') d['Monto'] = (Number(d.Cantidad || 0) * Number(d.Precio || 0)).toFixed(2);
      if (editCtx && SH_MAP[sec]) {
        sv('editRow', editCtx.sh, editCtx.row, d).then(function () { toast('Registro actualizado', 's'); clMo(); load(curSec); }).catch(function (err) { toast('Error: ' + err.message, 'e'); });
      } else {
        sv('addCompraConStock', d).then(function () { toast('Registro agregado', 's'); clMo(); load(curSec); }).catch(function (err) { toast('Error: ' + err.message, 'e'); });
      }
    }

    function addInv(sh) {
      editCtx = null; var t = sh === 'Inventario_Inicial' ? 'Inventario Inicial' : 'Inventario Final';
      opMo('Agregar ' + t, fg('Producto', 'Producto', 'text') + fg('U/M', 'U/M', 'text', '', 'placeholder="unidad"') + '<div class="fr">' + fg('Cantidad', 'Cantidad', 'number', '0', 'step="0.01"') + fg('Precio', 'Precio', 'number', '0', 'step="0.01"') + '</div>' + fs('Mes', 'Mes', moSel()), function () { saveInv(sh); });
    }

    function saveInv(sh) {
      var d = getFormData(); if (!d.Producto) { toast('El producto es obligatorio', 'e'); return; }
      d['Valor Total'] = (Number(d.Cantidad || 0) * Number(d.Precio || 0)).toFixed(2);
      if (editCtx) {
        sv('editRow', editCtx.sh, editCtx.row, d).then(function () { toast('Registro actualizado', 's'); clMo(); load('inventario'); }).catch(function (err) { toast('Error: ' + err.message, 'e'); });
      } else {
        sv('addRow', sh, d).then(function () { toast('Registro agregado', 's'); clMo(); load('inventario'); }).catch(function (err) { toast('Error: ' + err.message, 'e'); });
      }
    }

    function delRow(sh, row) {
      opMo('Confirmar eliminacion', '<p style="font-size:13px;color:#777">Esta accion no se puede deshacer. Deseas eliminar este registro?</p>', function () {
        sv('removeRow', sh, row).then(function () { toast('Registro eliminado', 's'); clMo(); load(curSec); }).catch(function (err) { toast('Error: ' + err.message, 'e'); });
      });
      $('moSv').className = 'bt bt-d'; $('moSv').innerHTML = '<i class="fas fa-trash"></i> Eliminar';
    }

    // ══════════════════════════════════════
    // EXPORTAR PDF
    // ══════════════════════════════════════
    function doPrint(sec) {
      var ml = curMes ? MESES[Number(curMes)] : 'Todos los meses';
      var w = window.open('', '_blank');
      if (sec === 'estado') {
        var tb = $('tbE').innerHTML;
        w.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Estado de Resultado</title><style>body{font-family:Arial,sans-serif;padding:40px;color:#1a1a1a;max-width:660px;margin:0 auto}h1{text-align:center;font-size:20px;border-bottom:3px solid #2d6a4f;padding-bottom:8px;margin-bottom:4px}h2{text-align:center;color:#666;font-size:13px;font-weight:400;margin-bottom:20px}table{width:100%;border-collapse:collapse}td{padding:7px 12px;border-bottom:1px solid #eee;font-size:12.5px}.n{text-align:right}.ind td:first-child{padding-left:28px}.sub td{font-weight:700;background:#f5f5f5;border-top:1px solid #ddd}.big td{font-weight:900;font-size:14px;border-top:2px solid #333;background:#eee}.mr td{color:#2d6a4f;font-style:italic;font-weight:600}.note{background:#fffbeb!important;color:#92400e;font-size:11px;font-style:italic;font-weight:400!important}.sl td{background:#141a12!important;color:#fff;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:1px}@media print{body{padding:20px}}</style></head><body><h1>ESTADO DE RESULTADO</h1><h2>' + ml + '</h2><table>' + tb + '</table><script>window.onload=function(){window.print()}<\/script></body></html>');
      } else if (sec === 'ratios') {
        var g = $('rtG').innerHTML;
        w.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Indicadores Financieros</title><style>body{font-family:Arial,sans-serif;padding:40px;color:#1a1a1a;max-width:780px;margin:0 auto}h1{text-align:center;font-size:20px;border-bottom:3px solid #2d6a4f;padding-bottom:8px;margin-bottom:4px}h2{text-align:center;color:#666;font-size:13px;font-weight:400;margin-bottom:20px}.rt-g{display:grid;grid-template-columns:1fr 1fr;gap:16px}.rt-c{border:1px solid #ddd;border-radius:6px;overflow:hidden;break-inside:avoid}.rt-c-t{background:#141a12;color:#fff;padding:8px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px}.rt-r{display:flex;justify-content:space-between;padding:8px 14px;border-bottom:1px solid #f0f0f0;font-size:12px}.rt-r:last-child{border-bottom:none}.rt-r .l{color:#666}.rt-r .v{font-weight:700}.rt-r .v.ok{color:#2d6a4f}.rt-r .v.no{color:#c1121f}.rt-r .v.wa{color:#b8860b}@media print{body{padding:20px}.rt-g{grid-template-columns:1fr}}</style></head><body><h1>INDICADORES FINANCIEROS</h1><h2>RATIOS — ' + ml + '</h2><div class="rt-g">' + g + '</div><script>window.onload=function(){window.print()}<\/script></body></html>');
      }
      w.document.close();
    }

    // ════════════════════════════════════
    // INICIO Y NAVEGACIÓN
    // ════════════════════════════════════
    function initHash() { var h = window.location.hash.replace('#', ''); if (h && document.querySelector('[data-s="' + h + '"]')) go(h); }
    window.addEventListener('hashchange', function () { var h = window.location.hash.replace('#', ''); if (h && document.querySelector('[data-s="' + h + '"]')) go(h); });

    document.addEventListener('DOMContentLoaded', function () {
      initHash();
      loadDash();
    });