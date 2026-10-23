// Convierte los Excel de facturación vs conteo en un data.json compacto para el dashboard.
// Uso: node build_data.js <carpeta_excels> <salida.json>
//
// Acumulado sin duplicados. Los reportes se aplican del más antiguo al más reciente (fecha "Generado el"):
//  - Cada línea de Detalle se identifica por Día|Ruta|Zona|Transportista|Entrega|Factura|Código más su
//    número de repetición dentro del archivo (un mismo Excel puede traer la misma clave en dos posiciones
//    distintas, y ambas cuentan). Si un reporte posterior trae la misma línea, la reemplaza.
//  - Si el reporte posterior es completo (filtros Producto, Ruta y Estado en "Todos"), además reemplaza
//    por entero los días de su rango, para recoger correcciones o líneas eliminadas.
//  - "Por ruta" funciona igual con la clave Día|Ruta|Zona|Transportista.
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const [dir, out] = process.argv.slice(2);

// "20-10-2026 13:22" -> "2026-10-20 13:22" para poder comparar.
const genKey = s => { const m = /(\d{2})-(\d{2})-(\d{4})\s*(\d{2}:\d{2})?/.exec(s || ''); return m ? `${m[3]}-${m[2]}-${m[1]} ${m[4] || ''}` : ''; };
const files = fs.readdirSync(dir).filter(f => /\.xlsx$/i.test(f) && !f.startsWith('~$')).map(f => {
  const wb = XLSX.readFile(path.join(dir, f), { sheets: ['Resumen'] });
  const res = XLSX.utils.sheet_to_json(wb.Sheets['Resumen'], { header: 1, defval: null });
  const get = (label) => (res.find(r => r[0] === label) || [])[1];
  const generado = String((res[1] || [])[0] || '').replace('Generado el ', '');
  const completo = ['Producto', 'Ruta', 'Estado'].every(l => String(get(l) || 'Todos') === 'Todos');
  return { archivo: f, desde: String(get('Desde') || ''), hasta: String(get('Hasta') || ''), generado, completo, k: genKey(generado) + '|' + f };
}).sort((a, b) => a.k < b.k ? -1 : 1);

// Tabla con clave única, índice por día para poder reemplazar rangos completos
function keyed() {
  const rows = new Map(), byDay = new Map();
  return {
    rows,
    set(k, day, v) {
      rows.set(k, v);
      if (!byDay.has(day)) byDay.set(day, new Set());
      byDay.get(day).add(k);
    },
    dropRange(desde, hasta) {
      for (const [day, keys] of byDay) {
        if (day >= desde && day <= hasta) { for (const k of keys) rows.delete(k); byDay.delete(day); }
      }
    },
  };
}
const lines = keyed(), routeDays = keyed();
const str = v => v == null ? '' : String(v);

for (const file of files) {
  const f = file.archivo;
  const wb = XLSX.readFile(path.join(dir, f));
  if (file.completo && file.desde && file.hasta) { lines.dropRange(file.desde, file.hasta); routeDays.dropRange(file.desde, file.hasta); }

  const seen = new Map();
  let n = 0;
  for (const r of XLSX.utils.sheet_to_json(wb.Sheets['Detalle'], { defval: null })) {
    const base = [r['Día'], r.Ruta, r.Zona, r.Transportista, r.Entrega, r.Factura, r['Código']].map(str).join('|');
    const rep = (seen.get(base) || 0) + 1;
    seen.set(base, rep);
    lines.set(base + '#' + rep, str(r['Día']), { r, f });
    n++;
  }
  for (const r of XLSX.utils.sheet_to_json(wb.Sheets['Por ruta'], { defval: null })) {
    routeDays.set([r['Día'], r.Ruta, r.Zona, r.Transportista].map(str).join('|'), str(r['Día']), { r, f });
  }
  file.leidas = n;
}

// Diccionarios: cada dimensión se guarda una vez y las filas apuntan por índice.
function dict() {
  const list = [], idx = new Map();
  return { list, get(v) { v = str(v); if (!idx.has(v)) { idx.set(v, list.length); list.push(v); } return idx.get(v); } };
}
const D = { dia: dict(), ruta: dict(), zona: dict(), tr: dict(), cod: dict() };
const material = {};
const cube = new Map();  // Día|Ruta|Zona|Transportista|Código -> sumas
const adj = [];          // líneas con diferencia o retornadas
const usadas = {};

for (const { r, f } of lines.rows.values()) {
  usadas[f] = (usadas[f] || 0) + 1;
  const d = D.dia.get(r['Día']), ru = D.ruta.get(r.Ruta), z = D.zona.get(r.Zona), t = D.tr.get(r.Transportista), c = D.cod.get(r['Código']);
  material[r['Código']] = r.Material;
  const fa = +r.Facturado || 0, co = +r.Conteo || 0, re = +r.Retornadas || 0, dif = co - fa;
  const k = d + '|' + ru + '|' + z + '|' + t + '|' + c;
  let e = cube.get(k);
  if (!e) cube.set(k, e = [d, ru, z, t, c, 0, 0, 0, 0, 0, 0]);
  // lineas, facturado, conteo, retornadas, faltantes, sobrantes
  e[5]++; e[6] += fa; e[7] += co; e[8] += re; if (dif < 0) e[9]++; if (dif > 0) e[10]++;
  if (dif !== 0 || re > 0) {
    adj.push([d, ru, z, t, c, str(r.Entrega), str(r.Factura), str(r['Doc. tributario']), r.Estado, fa, co, re]);
  }
}

const routes = [...routeDays.rows.values()].map(({ r }) => [D.dia.get(r['Día']), D.ruta.get(r.Ruta), D.zona.get(r.Zona), D.tr.get(r.Transportista),
  r.Cobertura || '', r['Estado conteo'] || '', +r['Líneas'] || 0, +r['Líneas c/dif'] || 0,
  +r.Facturado || 0, +r.Conteo || 0, +r['Vol. esperado'] || 0]);

const meta = files.map(x => ({ archivo: x.archivo, desde: x.desde, hasta: x.hasta, generado: x.generado, completo: x.completo, leidas: x.leidas, lineas: usadas[x.archivo] || 0 }))
  .sort((a, b) => a.desde < b.desde ? -1 : 1);
meta.forEach(m => console.log(m.archivo, 'generado', m.generado, m.completo ? 'completo' : 'filtrado', 'líneas leídas', m.leidas, 'usadas', m.lineas));

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
console.log('lineas', lines.rows.size, 'cube', cubeRows.length, 'routes', routes.length, 'adj', adj.length, 'bytes', fs.statSync(out).size);
