// Convierte los Excel de facturación vs conteo en un data.json compacto para el dashboard.
// Uso: node build_data.js <carpeta_excels> <salida.json>
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const [dir, out] = process.argv.slice(2);

// Diccionarios: cada dimensión se guarda una vez y las filas apuntan por índice.
function dict() {
  const list = [], idx = new Map();
  return { list, get(v) { v = v == null ? '' : String(v); if (!idx.has(v)) { idx.set(v, list.length); list.push(v); } return idx.get(v); } };
}
const D = { dia: dict(), ruta: dict(), zona: dict(), tr: dict(), cod: dict() };
const material = {};

// Cubo: Día|Ruta|Zona|Transportista|Código -> sumas
const cube = new Map();
// Ruta-día: desde la hoja "Por ruta" (incluye rutas pendientes y volumen esperado)
const routes = [];
// Ajustes: filas de Detalle con diferencia o retornadas
const adj = [];
const meta = [];

for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.xlsx')).sort()) {
  const wb = XLSX.readFile(path.join(dir, f));
  const res = XLSX.utils.sheet_to_json(wb.Sheets['Resumen'], { header: 1, defval: null });
  const get = (label) => (res.find(r => r[0] === label) || [])[1];
  meta.push({ archivo: f, desde: get('Desde'), hasta: get('Hasta'), generado: String(res[1][0]).replace('Generado el ', '') });

  for (const r of XLSX.utils.sheet_to_json(wb.Sheets['Detalle'], { defval: null })) {
    const d = D.dia.get(r['Día']), ru = D.ruta.get(r.Ruta), z = D.zona.get(r.Zona), t = D.tr.get(r.Transportista), c = D.cod.get(r['Código']);
    material[r['Código']] = r.Material;
    const fa = +r.Facturado || 0, co = +r.Conteo || 0, re = +r.Retornadas || 0, dif = co - fa;
    const k = d + '|' + ru + '|' + z + '|' + t + '|' + c;
    let e = cube.get(k);
    if (!e) cube.set(k, e = [d, ru, z, t, c, 0, 0, 0, 0, 0, 0]);
    // lineas, facturado, conteo, retornadas, faltantes, sobrantes
    e[5]++; e[6] += fa; e[7] += co; e[8] += re; if (dif < 0) e[9]++; if (dif > 0) e[10]++;
    if (dif !== 0 || re > 0) {
      adj.push([d, ru, z, t, c, String(r.Entrega || ''), String(r.Factura || ''), String(r['Doc. tributario'] || ''), r.Estado, fa, co, re]);
    }
  }

  for (const r of XLSX.utils.sheet_to_json(wb.Sheets['Por ruta'], { defval: null })) {
    routes.push([D.dia.get(r['Día']), D.ruta.get(r.Ruta), D.zona.get(r.Zona), D.tr.get(r.Transportista),
      r.Cobertura || '', r['Estado conteo'] || '', +r['Líneas'] || 0, +r['Líneas c/dif'] || 0,
      +r.Facturado || 0, +r.Conteo || 0, +r['Vol. esperado'] || 0]);
  }
}

// Columnar para reducir tamaño
const cols = (rows, n) => Array.from({ length: n }, (_, i) => rows.map(r => r[i]));
const cubeRows = [...cube.values()];
const data = {
  meta,
  dims: { dia: D.dia.list, ruta: D.ruta.list, zona: D.zona.list, tr: D.tr.list, cod: D.cod.list, mat: D.cod.list.map(c => material[c] || '') },
  cube: cols(cubeRows, 11),
  routes: cols(routes, 11),
  adj,
};
fs.writeFileSync(out, JSON.stringify(data));
console.log('cube', cubeRows.length, 'routes', routes.length, 'adj', adj.length, 'bytes', fs.statSync(out).size);
