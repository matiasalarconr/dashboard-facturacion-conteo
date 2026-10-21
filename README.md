# Dashboard Facturación vs Conteo

Panel web para analizar las auditorías de transportista (facturado vs contado) a partir de los reportes
`reporte_facturacion_conteo_*.xlsx`.

**Ver el panel:** https://matiasalarconr.github.io/dashboard-facturacion-conteo/

## Qué muestra

- **Resumen:** KPIs (facturado, conteo, diferencia, % diferencia, ítems con diferencia, cobertura de rutas, retornadas), diferencia diaria, comparación mensual, ítems ajustados por día y cobertura de rutas.
- **Transportistas y rutas:** ranking de faltantes por transportista y zona, tabla por transportista y tabla de rutas por día (incluye pendientes).
- **Productos:** ranking de productos con faltante y tabla completa por código.
- **Ajustes (detalle):** cada línea de la hoja Detalle con diferencia o retornadas (entrega, factura, doc. tributario, código, descripción).

Filtros globales: mes, rango de fechas, transportista, zona, ruta y producto. Todas las tablas se pueden ordenar y exportar a CSV.

## Actualizar con nuevos reportes

1. Deja todos los `.xlsx` en una carpeta (ej. `excels/`).
2. Ejecuta:
   ```bash
   cd scripts && npm install && node build_data.js ../excels ../data.json
   ```
3. Haz commit y push de `data.json`. GitHub Pages se actualiza en 1–2 minutos.

La diferencia se calcula como `conteo − facturado` por línea.
