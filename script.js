// script.js - Frontend contabilidad (versión corregida)
// Asegúrate de actualizar API_URL con la URL de tu Web App

var API_URL = 'https://script.google.com/macros/s/AKfycbw9e0QSbfJvsjIrfGbXWAG2CJ3sw6PIGUN1MpHzIEs7b9p1dLrFP5GqZZsvMsQEEmm4vw/exec';

var MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];
var curSec = 'dashboard';
var curMes = '';
var editCtx = null;
var apiReady = false;
var SUBCATS = [
  'Gastos de Distribucion', 'Transporte', 'Publicidad', 'Comisiones',
  'Gastos de mantenimiento', 'Reparaciones', 'Gastos de suscripcion',
  'Herramientas digitales', 'Gastos de Otros Servicios',
  'Alimento y otros Suministros', 'Salario indirecto', 'Renta',
  'Servicio de teneduria de libros', 'Intereses de prestamos',
  'Perdida cambio monetario'
];

var COSTOS_DESC = [
  'Materia prima', 'Salario Directo', 'Servicio Alimentacion',
  'Gastos de Servicios Publicos', 'Gastos de mantenimiento',
  'Gastos de Otros Servicios'
];

var SH_MAP = {
  ventas: 'Ventas',
  gastos: 'Gastos',
  costos: 'Costos',
  compras: 'Compras'
};

// ----------------------
// Utilidades DOM y formato
// ----------------------
function $(id) { return document.getElementById(id); }

function f(n) {
  var p = Number(n || 0).toFixed(2).split('.');
  return '$' + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + p[1];
}
function fp(n) { return (Number(n || 0)).toFixed(2) + '%'; }
function fr(n) { return (Number(n || 0)).toFixed(2); }
function mn(m) { return MESES[Number(m)] || ''; }

function fd(v) {
  if (!v) return '';
  if (v instanceof Date) {
    return ('0' + v.getDate()).slice(-2) + '/' +
      ('0' + (v.getMonth() + 1)).slice(-2) + '/' +
      v.getFullYear();
  }
  var s = String(v);
  if (s.indexOf('T') !== -1) {
    var p = s.split('T')[0].split('-');
    if (p.length === 3) return p[2] + '/' + p[1] + '/' + p[0];
  }
  return s;
}

function fdI(v) {
  if (!v) return '';
  if (v instanceof Date) {
    return v.getFullYear() + '-' +
      ('0' + (v.getMonth() + 1)).slice(-2) + '-' +
      ('0' + v.getDate()).slice(-2);
  }
  var s = String(v);
  if (s.indexOf('T') !== -1) return s.split('T')[0];
  if (s.indexOf('/') !== -1) {
    var p = s.split('/');
    if (p.length === 3) return p[2] + '-' + p[1] + '-' + p[0];
  }
  return s;
}

// ----------------------
// Loader (mostrar/ocultar)
// ----------------------
function showLoader() {
  var L = $('loader');
  if (L) L.classList.remove('hidden');
}
function hideLoader() {
  var L = $('loader');
  if (L) L.classList.add('hidden');
}

// ----------------------
// Comunicación con la API (fetch)
// ----------------------
function sv(fn) {
  var args = Array.prototype.slice.call(arguments, 1);
  var params = { action: fn };
  for (var i = 0; i < args.length; i++) {
    if (args[i] !== null && args[i] !== undefined) {
      params['p' + i] = typeof args[i] === 'object' ? JSON.stringify(args[i]) : String(args[i]);
    }
  }
  var qs = Object.keys(params).map(function (k) {
    return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
  }).join('&');

  return fetch(API_URL + '?' + qs, { cache: 'no-store' })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    })
    .then(function (txt) {
      if (!txt) throw new Error('Respuesta vacía del servidor');
      try {
        var data = JSON.parse(txt);
      } catch (e) {
        throw new Error('JSON inválido: ' + e.message);
      }
      if (data.error) throw new Error(data.error);
      apiReady = true;
      return data;
    })
    .catch(function (err) {
      console.error('API (' + fn + '):', err);
      if (!apiReady) showConnError(err);
      toast('Error: ' + (err.message || err), 'e');
      throw err;
    });
}

// Wrapper que muestra loader si la petición tarda
function svWithLoader() {
  var args = Array.prototype.slice.call(arguments);
  var showTimer = setTimeout(function () { try { showLoader(); } catch (e) { } }, 150);
  return Promise.resolve().then(function () {
    return sv.apply(null, args);
  }).finally(function () {
    clearTimeout(showTimer);
    try { hideLoader(); } catch (e) { }
  });
}

// Pantalla de error si la API no responde
function showConnError(err) {
  var ct = $('ct');
  if (!ct) return;
  ct.innerHTML =
    '<div class="conn-error">' +
    '<i class="fas fa-wifi"></i>' +
    '<h3>No se pudo conectar con el servidor</h3>' +
    '<p>Verifica que la URL de la API esté configurada correctamente en <code>script.js</code> y que el Web App de Google Apps Script esté desplegado con acceso <strong>Cualquier persona</strong>.</p>' +
    '<p style="font-size:11px;color:#aaa;margin-top:4px">Detalle: ' + (err.message || err) + '</p>' +
    '<button class="bt bt-p" onclick="location.reload()" style="margin-top:10px"><i class="fas fa-redo"></i> Reintentar</button>' +
    '</div>';
}

// ----------------------
// Toast
// ----------------------
function toast(msg, t) {
  t = t || 'i';
  var d = document.createElement('div');
  d.className = 'toast ' + t;
  d.textContent = msg;
  var c = $('toC');
  if (c) c.appendChild(d);
  setTimeout(function () { if (d.parentNode) d.remove(); }, 3100);
}

// ----------------------
// Cache y prefetch
// ----------------------
var cache = {
  dashboard: null,
  Ventas: null,
  Gastos: null,
  Costos: null,
  Compras: null
};

function initApp() {
  // Retornar la promesa para que el boot pueda encadenar .finally
  return Promise.all([
    sv('loadDashboard', curMes || null).catch(function () { return null; }),
    sv('getSheetData', 'Ventas').catch(function () { return { h: [], r: [] }; }),
    sv('getSheetData', 'Gastos').catch(function () { return { h: [], r: [] }; })
  ]).then(function (results) {
    if (results[0]) cache.dashboard = results[0];
    cache.Ventas = results[1];
    cache.Gastos = results[2];
    if (curSec === 'ventas') loadTblCached('Ventas', 'tbV', rV);
    if (curSec === 'gastos') loadTblCached('Gastos', 'tbG', rG);
    return results;
  }).catch(function (err) {
    console.error('initApp error', err);
    throw err;
  });
}

// Boot: mostrar loader al inicio, prefetch y navegar a sección inicial
(function boot() {
  try { showLoader(); } catch (e) { }
  var h = window.location.hash ? window.location.hash.replace('#', '') : null;
  if (h) curSec = h;
  initApp().finally(function () {
    if (cache.dashboard) {
      try { renderDashboard(cache.dashboard); } catch (e) { }
    }
    try { go(curSec || (window.location.hash.replace('#', '') || 'dashboard')); } catch (e) { }
    try { hideLoader(); } catch (e) { }
  });
})();

// ----------------------
// Navegación
// ----------------------
document.addEventListener('DOMContentLoaded', function () {
  // listeners que dependen del DOM
  var nav = $('nav');
  if (nav) {
    nav.addEventListener('click', function (e) {
      var a = e.target.closest('a[data-s]');
      if (!a) return;
      go(a.dataset.s);
      var sb = $('sb');
      if (sb) sb.classList.remove('open');
    });
  }
  var mobBtn = $('mobBtn');
  if (mobBtn) mobBtn.addEventListener('click', function () {
    var sb = $('sb');
    if (sb) sb.classList.toggle('open');
  });
  var mf = $('mf');
  if (mf) mf.addEventListener('change', function (e) {
    curMes = e.target.value;
    load(curSec);
  });
});

function go(s) {
  curSec = s;
  var links = document.querySelectorAll('#nav a');
  for (var i = 0; i < links.length; i++) {
    links[i].classList.toggle('on', links[i].dataset.s === s);
  }
  var secs = document.querySelectorAll('.sec');
  for (var j = 0; j < secs.length; j++) {
    secs[j].classList.toggle('on', secs[j].id === 's-' + s);
  }
  var titles = {
    dashboard: 'Dashboard', ventas: 'Ventas', gastos: 'Gastos',
    costos: 'Costos', compras: 'Compras', inventario: 'Inventario',
    estado: 'Estado de Resultado', ratios: 'Indicadores Financieros',
    config: 'Configuracion'
  };
  $('pgT').textContent = titles[s] || s;
  updActs(s);
  load(s);
  window.location.hash = s;
}

function updActs(s) {
  var el = $('topA');
  var crud = ['ventas', 'gastos', 'costos', 'compras'];
  var pdf = ['estado', 'ratios'];
  var h = '';
  if (crud.indexOf(s) !== -1) {
    h += '<button class="bt bt-p" onclick="openAdd(\'' + s + '\')"><i class="fas fa-plus"></i> Agregar</button>';
  }
  if (pdf.indexOf(s) !== -1) {
    h += '<button class="bt bt-s" onclick="doPrint(\'' + s + '\')"><i class="fas fa-file-pdf"></i> Exportar PDF</button>';
  }
  if (el) el.innerHTML = h;
}

function load(s) {
  switch (s) {
    case 'dashboard': loadDash(); break;
    case 'ventas': loadTblCached('Ventas', 'tbV', rV); break;
    case 'gastos': loadTblCached('Gastos', 'tbG', rG); break;
    case 'costos': loadTblCached('Costos', 'tbC', rC); break;
    case 'compras': loadTblCached('Compras', 'tbCo', rCo); break;
    case 'inventario': loadInv(); break;
    case 'estado': loadEst(); break;
    case 'ratios': loadRat(); break;
    case 'config': loadCfg(); break;
  }
}

// ----------------------
// Render helpers para tablas y cache
// ----------------------
function renderRowsToTable(rows, tb, fn) {
  var el = $(tb);
  if (!el) return;
  if (!rows || !rows.length) {
    el.innerHTML = '<tr><td colspan="20" class="empty"><i class="fas fa-inbox"></i>Sin registros para este periodo</td></tr>';
    return;
  }
  el.innerHTML = rows.map(fn).join("");
}

function loadTblCached(sh, tb, fn) {
  // Si hay cache, render inmediato y refrescar en background
  if (cache[sh] && cache[sh].r) {
    var rowsCached = cache[sh].r.filter(function (r) {
      return !curMes || String(r['Mes'] || "").trim() === String(curMes).trim();
    });
    renderRowsToTable(rowsCached, tb, fn);
    // refrescar en background
    sv('getSheetData', sh).then(function (d) {
      cache[sh] = d;
      var rows = d.r.filter(function (r) {
        return !curMes || String(r['Mes'] || "").trim() === String(curMes).trim();
      });
      renderRowsToTable(rows, tb, fn);
    }).catch(function () { /* silencio */ });
    return;
  }

  // Si no hay cache, comportamiento original con loader
  showLoader();
  sv('getSheetData', sh).then(function (data) {
    hideLoader();
    cache[sh] = data;
    var rows = curMes
      ? data.r.filter(function (r) { return String(r['Mes'] || "").trim() === String(curMes).trim(); })
      : data.r;
    renderRowsToTable(rows, tb, fn);
  }).catch(function () { hideLoader(); });
}

// ----------------------
// Dashboard (usa cache y svWithLoader)
// ----------------------
function loadDash() {
  if (cache.dashboard) {
    try { renderDashboard(cache.dashboard); } catch (e) { }
    // refrescar en background
    svWithLoader('loadDashboard', curMes || null).then(function (d) {
      if (d) { cache.dashboard = d; try { renderDashboard(d); } catch (e) { } }
    }).catch(function () { });
    return;
  }

  showLoader();
  svWithLoader('loadDashboard', curMes || null).then(function (d) {
    if (d) { cache.dashboard = d; renderDashboard(d); }
  }).catch(function () { })
    .finally(function () { hideLoader(); });
}

function renderDashboard(d) {
  if (!d) return;
  var payload = d.estado ? d : { estado: d };
  var e = payload.estado;
  if (!e) return;

  // KPI y margenes (igual que antes)...
  // --- omitted for brevity; conserva tu implementación de KPI/mbG ---

  // Preparar HTMLs
  var totalG = Number(e.gt || 0);

  // Desglose de Gastos
  var rows = '<div class="tc-h"><h3>Desglose de Gastos</h3></div>' +
    '<table><thead><tr><th>Categoria</th><th class="n">Monto</th><th class="n">%</th></tr></thead><tbody>';
  function addRow(label, value) {
    var pct = totalG > 0 ? ((Number(value || 0) / totalG) * 100).toFixed(2) + '%' : '0%';
    rows += '<tr><td>' + label + '</td><td class="n">' + f(value) + '</td><td class="n">' + pct + '</td></tr>';
  }
  addRow('Gastos Operativos', e.go);
  addRow('Gastos Financieros', e.gf);
  addRow('Gastos de Administracion', e.ga);
  rows += '<tr class="tr-t"><td>Total</td><td class="n">' + f(totalG) + '</td><td class="n">100%</td></tr>';
  rows += '</tbody></table>';

  // Costos fijos vs variables
  var cvTotal = Number(e.cv || 0);
  var cf = Number(e.cf || 0);
  var cvar = Number(e.cvar || 0);
  var htmlCosto = '<div class="tc-h"><h3>Costos Fijos vs Variables</h3></div>' +
    '<table><thead><tr><th>Tipo</th><th class="n">Monto</th><th class="n">%</th></tr></thead><tbody>' +
    '<tr><td>Costos Fijos</td><td class="n">' + f(cf) + '</td><td class="n">' + (cvTotal > 0 ? fp(cf / cvTotal * 100) : '0%') + '</td></tr>' +
    '<tr><td>Costos Variables</td><td class="n">' + f(cvar) + '</td><td class="n">' + (cvTotal > 0 ? fp(cvar / cvTotal * 100) : '0%') + '</td></tr>' +
    '<tr class="tr-t"><td>Total</td><td class="n">' + f(cvTotal) + '</td><td class="n">100%</td></tr></tbody></table>';

  // Escribir en DOM con fallback
  var dcGastoEl = elOrFallback('dcGasto', 's-gastos');
  var dcCostoEl = elOrFallback('dcCosto', 's-costos');

  if (dcGastoEl) dcGastoEl.innerHTML = rows;
  else console.warn('No se encontró contenedor para Desglose de Gastos (dcGasto / s-gastos)');

  if (dcCostoEl) dcCostoEl.innerHTML = htmlCosto;
  else console.warn('No se encontró contenedor para Costos (dcCosto / s-costos)');

  // Gráficos: Ventas vs Costos vs Gastos y dona
  try {
    if (typeof drawBar === 'function') drawBar({ ventas: Number(e.ventas||0), cv: Number(e.cv||0), gt: Number(e.gt||0), un: Number(e.un||0) });
    if (typeof drawDon === 'function') drawDon({ go: Number(e.go||0), gf: Number(e.gf||0), ga: Number(e.ga||0) });
  } catch (err) {
    console.error('Error al dibujar gráficos', err);
  }
}

// Desglose de Gastos (tabla)
  try {
    if ($('dcGasto')) {
      var totalG = Number(e.gt || 0);
      var rows = '';
      rows += '<div class="tc-h"><h3>Desglose de Gastos</h3></div>';
      rows += '<table><thead><tr><th>Categoria</th><th class="n">Monto</th><th class="n">%</th></tr></thead><tbody>';
      var addRow = function(label, value) {
        var pct = totalG > 0 ? fp((Number(value || 0) / totalG) * 100) : '0%';
        rows += '<tr><td>' + label + '</td><td class="n">' + f(value) + '</td><td class="n">' + pct + '</td></tr>';
      };
      addRow('Gastos Operativos', e.go);
      addRow('Gastos Financieros', e.gf);
      addRow('Gastos de Administracion', e.ga);
      rows += '<tr class="tr-t"><td>Total</td><td class="n">' + f(totalG) + '</td><td class="n">100%</td></tr>';
      rows += '</tbody></table>';
      $('dcGasto').innerHTML = rows;
    }
  } catch (err) { console.error('renderDashboard -> dcGasto error', err); }

  // Costos fijos vs variables (tabla)
  try {
    if ($('dcCosto')) {
      var cvTotal = Number(e.cv || 0);
      var cf = Number(e.cf || 0);
      var cvar = Number(e.cvar || 0);
      var html = '<div class="tc-h"><h3>Costos Fijos vs Variables</h3></div>' +
        '<table><thead><tr><th>Tipo</th><th class="n">Monto</th><th class="n">%</th></tr></thead><tbody>' +
        '<tr><td>Costos Fijos</td><td class="n">' + f(cf) + '</td><td class="n">' + (cvTotal > 0 ? fp(cf / cvTotal * 100) : '0%') + '</td></tr>' +
        '<tr><td>Costos Variables</td><td class="n">' + f(cvar) + '</td><td class="n">' + (cvTotal > 0 ? fp(cvar / cvTotal * 100) : '0%') + '</td></tr>' +
        '<tr class="tr-t"><td>Total</td><td class="n">' + f(cvTotal) + '</td><td class="n">100%</td></tr></tbody></table>';
      $('dcCosto').innerHTML = html;
    }
  } catch (err) { console.error('renderDashboard -> dcCosto error', err); }

  // Donut de desglose (si existe)
  try {
    if (typeof drawDon === 'function') {
      drawDon({ go: Number(e.go || 0), gf: Number(e.gf || 0), ga: Number(e.ga || 0) });
    } else {
      console.warn('drawDon no está definida');
    }
  } catch (err) { console.error('renderDashboard -> drawDon error', err); }
}

function kpi(l, v, s, c, cls) {
  return '<div class="kpi ' + (c || '') + '">' +
    '<div class="kpi-l">' + l + '</div>' +
    '<div class="kpi-v">' + v + '</div>' +
    (s ? '<div class="kpi-s ' + (cls || '') + '">' + s + '</div>' : '') +
    '</div>';
}
function mb(label, pct, c) {
  var cl = Math.max(0, Math.min(100, pct || 0));
  return '<div class="mb-i"><label>' + label +
    ' <span>' + fp(pct) + '</span></label>' +
    '<div class="mb-track"><div class="mb-fill ' + c +
    '" style="width:' + cl + '%"></div></div></div>';
}

// drawBar, drawDon: mantener tus implementaciones existentes (no las repito aquí por brevedad)

// ----------------------
// Tablas CRUD (renderers)
// ----------------------
function loadTbl(sh, tb, fn) {
  // mantenida por compatibilidad, redirige a loadTblCached
  loadTblCached(sh, tb, fn);
}

function ab(sh, r) {
  return '<td class="acts">' +
    '<button class="bt bt-s bt-i" onclick="openEdit(\'' + sh + '\',' + r._row + ')" title="Editar"><i class="fas fa-pen"></i></button>' +
    '<button class="bt bt-d bt-i" onclick="delRow(\'' + sh + '\',' + r._row + ')" title="Eliminar"><i class="fas fa-trash"></i></button>' +
    '</td>';
}

function rV(r) {
  var t = Number(r['Transferencia'] || 0) + Number(r['Efectivo'] || 0) + Number(r['Otros Activos'] || 0);
  return '<tr><td>' + fd(r['Fecha']) + '</td>' +
    '<td>' + (r['Descripcion'] || '') + '</td>' +
    '<td>' + (r['Tipo'] || '') + '</td>' +
    '<td class="n">' + f(r['Transferencia']) + '</td>' +
    '<td class="n">' + f(r['Efectivo']) + '</td>' +
    '<td class="n">' + f(r['Otros Activos']) + '</td>' +
    '<td class="n" style="font-weight:700">' + f(t) + '</td>' +
    '<td>' + mn(r['Mes']) + '</td>' + ab('Ventas', r) + '</tr>';
}
function rG(r) {
  return '<tr><td>' + fd(r['Fecha']) + '</td>' +
    '<td>' + (r['Descripcion'] || '') + '</td>' +
    '<td>' + (r['Subcategoria'] || '') + '</td>' +
    '<td class="n">' + f(r['Monto']) + '</td>' +
    '<td>' + (r['Tipo'] || '') + '</td>' +
    '<td>' + (r['Categoria'] || '') + '</td>' +
    '<td>' + (r['Factura'] || '-') + '</td>' +
    ab('Gastos', r) + '</tr>';
}
function rC(r) {
  return '<tr><td>' + fd(r['Fecha']) + '</td>' +
    '<td>' + (r['Descripcion'] || '') + '</td>' +
    '<td class="n">' + f(r['Monto']) + '</td>' +
    '<td>' + (r['Clasificacion'] || '') + '</td>' +
    '<td>' + (r['Tipo'] || '') + '</td>' +
    '<td>' + (r['Factura'] || '-') + '</td>' +
    ab('Costos', r) + '</tr>';
}
function rCo(r) {
  var stock = String(r['Stock'] || '').trim();
  var stockHtml = stock === 'Sí' ? '<span style="color:var(--accent);font-weight:700"><i class="fas fa-check-circle"></i> Sí</span>' : '<span style="color:var(--muted)">No</span>';
  return '<tr><td>' + fd(r['Fecha']) + '</td>' +
    '<td>' + (r['Producto'] || '') + '</td>' +
    '<td>' + (r['Cantidad'] || '') + '</td>' +
    '<td>' + (r['U/M'] || '') + '</td>' +
    '<td class="n">' + f(r['Precio']) + '</td>' +
    '<td class="n" style="font-weight:700">' + f(r['Monto']) + '</td>' +
    '<td>' + stockHtml + '</td>' + ab('Compras', r) + '</tr>';
}

// ----------------------
// Inventario, Estado, Ratios, Config (mantener lógicas existentes)
// ----------------------
// ══════════════════════════════════════
// INVENTARIO
// ══════════════════════════════════════
function loadInv() {
  Promise.all([
    sv('getSheetData', 'Inventario_Inicial'),
    sv('getSheetData', 'Inventario_Final')
  ]).then(function (results) {
    var ii = results[0], iff = results[1];
    var flt = function (r) {
      return !curMes ||
        String(r['Mes'] || '').trim() === String(curMes).trim();
    };
    var ir = function (r, shN) {
      return '<tr><td>' + (r['Producto'] || '') + '</td>' +
        '<td>' + (r['U/M'] || '') + '</td>' +
        '<td>' + (r['Cantidad'] || '') + '</td>' +
        '<td class="n">' + f(r['Precio']) + '</td>' +
        '<td class="n" style="font-weight:700">' + f(r['Valor Total']) + '</td>' +
        ab(shN, r) + '</tr>';
    };
    var f1 = ii.r.filter(flt).map(function (r) { return ir(r, 'Inventario_Inicial'); });
    var f2 = iff.r.filter(flt).map(function (r) { return ir(r, 'Inventario_Final'); });
    $('tbII').innerHTML = f1.length
      ? f1.join('')
      : '<tr><td colspan="6" class="empty"><i class="fas fa-inbox"></i>Sin datos</td></tr>';
    $('tbIF').innerHTML = f2.length
      ? f2.join('')
      : '<tr><td colspan="6" class="empty"><i class="fas fa-inbox"></i>Sin datos</td></tr>';
  });
}

// ══════════════════════════════════════
// ESTADO DE RESULTADO
// ══════════════════════════════════════
function loadEst() {
  sv('calcEstado', curMes || null).then(function (e) {
    var ml = curMes ? MESES[Number(curMes)] : 'Todos los meses';
    $('estT').textContent = 'Estado de Resultado — ' + ml;

    var row = function (l, v, c) {
      return '<tr class="' + (c || '') + '"><td>' + l +
        '</td><td class="n">' + v + '</td></tr>';
    };
    var note = function (t) {
      return '<tr><td colspan="2" class="note">' + t + '</td></tr>';
    };
    var sl = function (t) {
      return '<tr class="sl"><td colspan="2">' + t + '</td></tr>';
    };

    var ib = 'Por cada peso vendido te quedan ' + Math.round(e.mb) +
      ' centavos disponibles para cubrir otros gastos.';
    var io = 'La rentabilidad de la operacion antes de impuestos y gastos financieros es ' +
      (e.mo > 30 ? 'alta.' : 'baja.');
    var in_ = 'Por cada peso vendido conservas ' + Math.round(e.mn) +
      ' centavos de Ganancia.';
    if (e.mn >= 15) in_ += ' Empresa altamente competitiva y con gran capacidad de reinversion.';

    $('tbE').innerHTML =
      row('Ventas Netas', f(e.ventas)) +
      row('Costos de Venta', f(e.cv), 'ind') +
      row('Utilidad Bruta', f(e.ub), 'sub') +
      row('Margen Bruto', fp(e.mb), 'mr') +
      note(ib) +
      sl('Gastos') +
      row('Gastos Operativos', f(e.go), 'ind') +
      row('Gastos Financieros', f(e.gf), 'ind') +
      row('Gastos Generales y de Administracion', f(e.ga), 'ind') +
      row('Total Gastos', f(e.gt), 'sub') +
      row('Utilidad Operativa', f(e.uo), 'sub') +
      row('Margen Operativo', fp(e.mo), 'mr') +
      note(io) +
      row('Impuestos', f(e.imp), 'ind') +
      row('Utilidad Neta', f(e.un), 'big') +
      row('Margen Neto', fp(e.mn), 'mr') +
      note(in_) +
      sl('Desglose de Costos') +
      row('Costos Fijos', f(e.cf), 'ind') +
      row('Costos Variables', f(e.cvar), 'ind') +
      row('Total Costos', f(e.cv), 'sub') +
      sl('Inventario') +
      row('Inventario Inicial', f(e.ii), 'ind') +
      row('Inventario Final', f(e.iff), 'ind');
  });
}

// ══════════════════════════════════════
// RATIOS
// ══════════════════════════════════════
function loadRat() {
  sv('calcRatios', curMes || null).then(function (r) {
    var ml = curMes ? MESES[Number(curMes)] : 'Todos los meses';

    function hc(t, items) {
      return '<div class="rt-c"><div class="rt-c-t">' + t +
        ' — ' + ml + '</div>' +
        items.map(function (item) {
          return '<div class="rt-r"><span class="l">' + item[0] +
            '</span><span class="v ' + (item[2] || '') + '">' +
            item[1] + '</span></div>';
        }).join('') + '</div>';
    }

    function rc(v, g, b) {
      return v >= g ? 'ok' : (v <= b ? 'no' : 'wa');
    }

    $('rtG').innerHTML =
      hc('Ratios de Liquidez', [
        ['Liquidez Corriente', fr(r.lc), rc(r.lc, 1.5, 0.8)],
        ['Tesoreria', fr(r.tes), rc(r.tes, 0.5, 0.1)],
        ['Prueba Acida', fr(r.pa), rc(r.pa, 1, 0.5)],
        ['Liquidez Inmediata', fr(r.li), rc(r.li, 0.2, 0.05)]
      ]) +
      hc('Ratios de Rentabilidad', [
        ['ROE (Retorno sobre Patrimonio)', fp(r.roe), rc(r.roe, 15, 0)],
        ['ROA (Retorno sobre Activos)', fp(r.roa), rc(r.roa, 5, 0)]
      ]) +
      hc('Ratios de Solvencia', [
        ['Endeudamiento', fp(r.end), r.end < 50 ? 'ok' : (r.end > 80 ? 'no' : 'wa')],
        ['Cobertura de Intereses', fr(r.ci), rc(r.ci, 3, 1)]
      ]) +
      hc('Ratios de Eficiencia', [
        ['Rotacion de Inventarios', fr(r.ri), ''],
        ['Rotacion de CPC', fr(r.rcpc), '']
      ]) +
      hc('Otros Indicadores', [
        ['Efectivo', f(r.ef)],
        ['Equivalentes de Efectivo', f(r.eq)],
        ['Cheques en transito', f(0)],
        ['Cuentas bancarias de ahorro', f(0)],
        ['Activos Corrientes', f(r.ac)],
        ['Pasivos Corrientes', f(r.pc)],
        ['Patrimonio Neto', f(r.pn)],
        ['Activos Totales', f(r.at)],
        ['Pasivo Total', f(r.pt)],
        ['Inventario Promedio', f(r.ip)],
        ['Ventas a Credito', f(r.vc)],
        ['Cuentas PC Promedio', f(r.cpp)]
      ]);
  });
}

// ══════════════════════════════════════
// CONFIG
// ══════════════════════════════════════
function loadCfg() {
  sv('readConfig').then(function (d) {
    $('cfgG').innerHTML = d.r.map(function (r) {
      return '<div class="cfg-i"><label>' + (r['Parametro'] || '') +
        '</label><input type="number" step="0.01" data-k="' +
        (r['Parametro'] || '') + '" value="' + (r['Valor'] || 0) +
        '"></div>';
    }).join('');
  });
}

function saveCfg() {
  var inputs = document.querySelectorAll('#cfgG input[data-k]');
  var pares = Array.prototype.map.call(inputs, function (i) {
    return { k: i.dataset.k, v: i.value };
  });
  sv('writeConfig', pares).then(function () {
    toast('Configuracion guardada', 's');
  });
}

// ----------------------
// Modales y formularios
// ----------------------
function opMo(title, html, onSv) {
  $('moT').textContent = title;
  $('moB').innerHTML = html;
  $('moSv').className = 'bt bt-p';
  $('moSv').innerHTML = '<i class="fas fa-check"></i> Guardar';
  $('moSv').onclick = onSv;
  $('moOv').classList.add('open');
}

function clMo() {
  $('moOv').classList.remove('open');
  editCtx = null;
}

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') clMo();
});
$('moOv') && $('moOv').addEventListener('click', function (e) {
  if (e.target === e.currentTarget) clMo();
});

function moSel() {
  return '<option value=""> -- Mes --</option>' +
    MESES.slice(1).map(function (m, i) {
      return '<option value="' + (i + 1) + '">' + m + '</option>';
    }).join("");
}

function selOpt(opts, sel) {
  return opts.map(function (o) {
    return '<option' + (String(sel || '').trim() === String(o).trim() ? ' selected' : '') + '>' + o + '</option>';
  }).join("");
}

function fg(l, n, t, v, x) {
  return '<div class="fg"><label>' + l + '</label>' +
    '<input type="' + (t || 'text') + '" name="' + n + '" value="' + (v !== undefined && v !== null ? String(v) : '') + '" ' + (x || '') + '></div>';
}

function fs(l, n, opts) {
  return '<div class="fg"><label>' + l + '</label>' +
    '<select name="' + n + '">' + opts + '</select></div>';
}

function formHTML(sec, d) {
  d = d || {};
  var ms = moSel();
  var mesVal = String(d['Mes'] || '').trim();
  if (mesVal) ms = ms.replace('value="' + mesVal + '"', 'value="' + mesVal + '" selected');

  switch (sec) {
    case 'ventas':
      return '<div class="fr">' +
        fg('Fecha', 'Fecha', 'date', fdI(d['Fecha'])) + '</div>' +
        fg('Descripcion', 'Descripcion', 'text', d['Descripcion']) +
        fs('Tipo', 'Tipo', selOpt(['Venta Neta', 'IPV', 'Otra Venta'], d['Tipo'])) +
        '<div class="fr">' +
        fg('Transferencia', 'Transferencia', 'number', d['Transferencia'] || '0', 'step="0.01"') +
        fg('Efectivo', 'Efectivo', 'number', d['Efectivo'] || '0', 'step="0.01"') +
        '</div>' +
        fg('Otros Activos', 'Otros Activos', 'number', d['Otros Activos'] || '0', 'step="0.01"') +
        fs('Mes', 'Mes', ms);
    case 'gastos':
      return '<div class="fr">' +
        fg('Fecha', 'Fecha', 'date', fdI(d['Fecha'])) + '</div>' +
        fg('Descripcion', 'Descripcion', 'text', d['Descripcion']) +
        fs('Categoria', 'Categoria', selOpt(['Operativo', 'Financiero', 'Administrativo', 'Impuestos'], d['Categoria'])) +
        fs('Subcategoria', 'Subcategoria', selOpt(SUBCATS, d['Subcategoria'])) +
        fg('Monto', 'Monto', 'number', d['Monto'] || '0', 'step="0.01"') +
        fs('Clasificacion', 'Clasificacion', selOpt(['Varia', 'No Varia'], d['Clasificacion'])) +
        fs('Tipo', 'Tipo', selOpt(['Fijo', 'Variable'], d['Tipo'])) +
        fg('Factura', 'Factura', 'text', d['Factura']) +
        fs('Mes', 'Mes', ms);
    case 'costos':
      return '<div class="fr">' +
        fg('Fecha', 'Fecha', 'date', fdI(d['Fecha'])) + '</div>' +
        fs('Descripcion', 'Descripcion', selOpt(COSTOS_DESC, d['Descripcion'])) +
        fg('Monto', 'Monto', 'number', d['Monto'] || '0', 'step="0.01"') +
        fs('Clasificacion', 'Clasificacion', selOpt(['Varia', 'No Varia'], d['Clasificacion'])) +
        fs('Tipo', 'Tipo', selOpt(['Fijo', 'Variable'], d['Tipo'])) +
        fg('Factura', 'Factura', 'text', d['Factura']) +
        fs('Mes', 'Mes', ms);
    case 'compras':
      return '<div class="fr">' +
        fg('Fecha', 'Fecha', 'date', fdI(d['Fecha'])) + '</div>' +
        fg('Producto', 'Producto', 'text', d['Producto']) +
        '<div class="fr">' +
        fg('Cantidad', 'Cantidad', 'number', d['Cantidad'] || '0', 'step="0.01"') +
        fg('U/M', 'U/M', 'text', d['U/M'] || 'unidad') + '</div>' +
        fg('Precio Unitario', 'Precio', 'number', d['Precio'] || '0', 'step="0.01"') +
        fs('Agregar al Stock', 'Stock', selOpt(['No', 'Sí'], d['Stock'] || 'No')) +
        fs('Mes', 'Mes', ms);
  }
  return '';
}

function getFormData() {
  var inputs = $('moB').querySelectorAll('input,select');
  var d = {};
  for (var i = 0; i < inputs.length; i++) {
    d[inputs[i].name] = inputs[i].value;
  }
  return d;
}

// ----------------------
// CRUD: Add / Edit / Delete (optimista)
// ----------------------
function openAdd(sec) {
  editCtx = null;
  var l = sec.charAt(0).toUpperCase() + sec.slice(1);
  opMo('Agregar ' + l, formHTML(sec), function () {
    saveFromFormOptimistic(sec);
  });
}

function openEdit(sh, row) {
  sv('getSheetData', sh).then(function (data) {
    var r = null;
    for (var i = 0; i < data.r.length; i++) {
      if (data.r[i]._row === row) { r = data.r[i]; break; }
    }
    if (!r) return;
    editCtx = { sh: sh, row: row };
    if (sh === 'Inventario_Inicial' || sh === 'Inventario_Final') {
      var t = sh === 'Inventario_Inicial' ? 'Inventario Inicial' : 'Inventario Final';
      var ms = moSel();
      var mv = String(r['Mes'] || '').trim();
      if (mv) ms = ms.replace('value="' + mv + '"', 'value="' + mv + '" selected');
      opMo('Editar ' + t,
        fg('Producto', 'Producto', 'text', r['Producto']) +
        fg('U/M', 'U/M', 'text', r['U/M']) +
        '<div class="fr">' +
        fg('Cantidad', 'Cantidad', 'number', r['Cantidad'], 'step="0.01"') +
        fg('Precio', 'Precio', 'number', r['Precio'], 'step="0.01"') +
        '</div>' + fs('Mes', 'Mes', ms),
        function () { saveInv(sh); }
      );
    } else {
      var sec = null;
      for (var k in SH_MAP) {
        if (SH_MAP[k] === sh) { sec = k; break; }
      }
      if (sec) {
        var l = sec.charAt(0).toUpperCase() + sec.slice(1);
        opMo('Editar ' + l, formHTML(sec, r), function () {
          saveFromFormOptimistic(sec);
        });
      }
    }
  }).catch(function () { toast('Error cargando registro', 'e'); });
}

function saveFromFormOptimistic(sec) {
  var d = getFormData();
  if (!d.Fecha) { toast('La fecha es obligatoria', 'e'); return; }
  if (!d.Mes) { toast('El mes es obligatorio', 'e'); return; }
  if (sec === 'compras') {
    d['Monto'] = (Number(d.Cantidad || 0) * Number(d.Precio || 0)).toFixed(2);
  }

  var sh = SH_MAP[sec];
  var tempRow = Object.assign({}, d, { _row: 'temp_' + Date.now() });
  if (!cache[sh]) cache[sh] = { h: [], r: [] };
  cache[sh].r = [tempRow].concat(cache[sh].r || []);

  // render inmediato
  switch (sec) {
    case 'ventas': renderRowsToTable(cache[sh].r.filter(function (r) { return !curMes || String(r['Mes'] || "").trim() === String(curMes).trim(); }), 'tbV', rV); break;
    case 'gastos': renderRowsToTable(cache[sh].r.filter(function (r) { return !curMes || String(r['Mes'] || "").trim() === String(curMes).trim(); }), 'tbG', rG); break;
    case 'costos': renderRowsToTable(cache[sh].r.filter(function (r) { return !curMes || String(r['Mes'] || "").trim() === String(curMes).trim(); }), 'tbC', rC); break;
    case 'compras': renderRowsToTable(cache[sh].r.filter(function (r) { return !curMes || String(r['Mes'] || "").trim() === String(curMes).trim(); }), 'tbCo', rCo); break;
  }

  var apiCall;
  if (editCtx && editCtx.sh === sh) {
    apiCall = sv('editRow', editCtx.sh, editCtx.row, d);
  } else if (sec === 'compras') {
    apiCall = sv('addCompraConStock', d);
  } else {
    apiCall = sv('addRow', sh, d);
  }

  apiCall.then(function (res) {
    if (!res || res.ok === false) {
      toast('Error al guardar: ' + (res && res.msg ? res.msg : ''), 'e');
      sv('getSheetData', sh).then(function (d2) { cache[sh] = d2; renderRowsToTable(d2.r.filter(function (r) { return !curMes || String(r['Mes'] || "").trim() === String(curMes).trim(); }), (sh === 'Ventas' ? 'tbV' : sh === 'Gastos' ? 'tbG' : sh === 'Costos' ? 'tbC' : 'tbCo'), (sh === 'Ventas' ? rV : sh === 'Gastos' ? rG : sh === 'Costos' ? rC : rCo)); });
    } else {
      // refrescar para obtener _row real
      sv('getSheetData', sh).then(function (d2) {
        cache[sh] = d2;
        renderRowsToTable(d2.r.filter(function (r) { return !curMes || String(r['Mes'] || "").trim() === String(curMes).trim(); }), (sh === 'Ventas' ? 'tbV' : sh === 'Gastos' ? 'tbG' : sh === 'Costos' ? 'tbC' : 'tbCo'), (sh === 'Ventas' ? rV : sh === 'Gastos' ? rG : sh === 'Costos' ? rC : rCo));
      });
      toast(editCtx ? 'Registro actualizado' : 'Registro agregado', 's');
      clMo();
      editCtx = null;
    }
  }).catch(function (err) {
    toast('Error de red al guardar', 'e');
    sv('getSheetData', sh).then(function (d2) {
      cache[sh] = d2;
      renderRowsToTable(d2.r.filter(function (r) { return !curMes || String(r['Mes'] || "").trim() === String(curMes).trim(); }), (sh === 'Ventas' ? 'tbV' : sh === 'Gastos' ? 'tbG' : sh === 'Costos' ? 'tbC' : 'tbCo'), (sh === 'Ventas' ? rV : sh === 'Gastos' ? rG : sh === 'Costos' ? rC : rCo));
    });
  });
}

// Inventario save
function saveInv(sh) {
  var d = getFormData();
  if (!d.Producto) { toast('El producto es obligatorio', 'e'); return; }
  d['Valor Total'] = (Number(d.Cantidad || 0) * Number(d.Precio || 0)).toFixed(2);
  if (editCtx) {
    sv('editRow', editCtx.sh, editCtx.row, d).then(function () {
      toast('Registro actualizado', 's');
      clMo();
      load('inventario');
    }).catch(function () { toast('Error actualizando inventario', 'e'); });
  } else {
    sv('addRow', sh, d).then(function () {
      toast('Registro agregado', 's');
      clMo();
      load('inventario');
    }).catch(function () { toast('Error agregando inventario', 'e'); });
  }
}

// Delete
function delRow(sh, row) {
  opMo('Confirmar eliminacion',
    '<p style="font-size:13px;color:#777">Esta accion no se puede deshacer. Deseas eliminar este registro ?</p>',
    function () {
      sv('removeRow', sh, row).then(function () {
        toast('Registro eliminado', 's');
        clMo();
        load(curSec);
      }).catch(function () { toast('Error eliminando registro', 'e'); });
    }
  );
  $('moSv').className = 'bt bt-d';
  $('moSv').innerHTML = '<i class="fas fa-trash"></i> Eliminar';
}

// PRINT / PDF
// ══════════════════════════════════════
function doPrint(sec) {
  var ml = curMes ? MESES[Number(curMes)] : 'Todos los meses';
  var w = window.open('', '_blank');

  if (sec === 'estado') {
    var tb = $('tbE').innerHTML;
    w.document.write(
      '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
      '<title>Estado de Resultado</title>' +
      '<style>body{font-family:Arial,sans-serif;padding:40px;color:#1a1a1a;max-width:660px;margin:0 auto}' +
      'h1{text-align:center;font-size:20px;border-bottom:3px solid #2d6a4f;padding-bottom:8px;margin-bottom:4px}' +
      'h2{text-align:center;color:#666;font-size:13px;font-weight:400;margin-bottom:20px}' +
      'table{width:100%;border-collapse:collapse}td{padding:7px 12px;border-bottom:1px solid #eee;font-size:12.5px}' +
      '.n{text-align:right}.ind td:first-child{padding-left:28px}' +
      '.sub td{font-weight:700;background:#f5f5f5;border-top:1px solid #ddd}' +
      '.big td{font-weight:900;font-size:14px;border-top:2px solid #333;background:#eee}' +
      '.mr td{color:#2d6a4f;font-style:italic;font-weight:600}' +
      '.note{background:#fffbeb!important;color:#92400e;font-size:11px;font-style:italic;font-weight:400!important}' +
      '.sl td{background:#141a12!important;color:#fff;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:1px}' +
      '@media print{body{padding:20px}}</style></head><body>' +
      '<h1>ESTADO DE RESULTADO</h1><h2>' + ml + '</h2>' +
      '<table>' + tb + '</table>' +
      '<script>window.onload=function(){window.print()}<\/script></body></html>'
    );
  } else if (sec === 'ratios') {
    var g = $('rtG').innerHTML;
    w.document.write(
      '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
      '<title>Indicadores Financieros</title>' +
      '<style>body{font-family:Arial,sans-serif;padding:40px;color:#1a1a1a;max-width:780px;margin:0 auto}' +
      'h1{text-align:center;font-size:20px;border-bottom:3px solid #2d6a4f;padding-bottom:8px;margin-bottom:4px}' +
      'h2{text-align:center;color:#666;font-size:13px;font-weight:400;margin-bottom:20px}' +
      '.rt-g{display:grid;grid-template-columns:1fr 1fr;gap:16px}' +
      '.rt-c{border:1px solid #ddd;border-radius:6px;overflow:hidden;break-inside:avoid}' +
      '.rt-c-t{background:#141a12;color:#fff;padding:8px 14px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px}' +
      '.rt-r{display:flex;justify-content:space-between;padding:8px 14px;border-bottom:1px solid #f0f0f0;font-size:12px}' +
      '.rt-r:last-child{border-bottom:none}.rt-r .l{color:#666}.rt-r .v{font-weight:700}' +
      '.rt-r .v.ok{color:#2d6a4f}.rt-r .v.no{color:#c1121f}.rt-r .v.wa{color:#b8860b}' +
      '@media print{body{padding:20px}.rt-g{grid-template-columns:1fr}}</style></head><body>' +
      '<h1>INDICADORES FINANCIEROS</h1><h2>RATIOS — ' + ml + '</h2>' +
      '<div class="rt-g">' + g + '</div>' +
      '<script>window.onload=function(){window.print()}<\/script></body></html>'
    );
  }
  w.document.close();
}

// ----------------------
// Configuración final
// ----------------------
// Asegúrate de que los elementos HTML con ids usados existan en tu DOM:
// loader, ct, toC, nav, sb, mobBtn, mf, pgT, topA, kpiG, mbG, dcCosto, dcGasto, cvBar, cvDon, tbV, tbG, tbC, tbCo, tbII, tbIF, estT, tbE, rtG, cfgG, moT, moB, moSv, moOv, toC

// Fin del script.js
