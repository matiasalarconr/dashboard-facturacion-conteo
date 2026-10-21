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

## Subir un reporte nuevo (acumulado)

1. En el panel pulsa **⬆ Subir reporte** (o entra a la carpeta [`excels/`](excels) → *Add file → Upload files*).
2. Arrastra el Excel y pulsa **Commit changes**.
3. La Action *Publicar dashboard* recalcula el acumulado con todos los Excel de `excels/` y republica el sitio (2–4 min).

Si dos reportes cubren el mismo día, se usa el que tiene la fecha de generación más reciente (celda "Generado el …" de la hoja Resumen), así que se puede volver a subir un mes sin duplicar.

Para generar los datos en local: `cd scripts && npm install && node build_data.js ../excels ../data.json`.

La diferencia se calcula como `conteo − facturado` por línea.
