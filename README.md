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

1. En el panel pulsa **⬆ Subir reporte** y arrastra el Excel. El panel valida el formato y muestra el período.
2. La primera vez pega la **clave de carga** (se guarda solo en ese navegador) y pulsa **Subir**.
3. El archivo se guarda en [`excels/`](excels), la Action *Publicar dashboard* recalcula el acumulado y el panel se recarga solo (1–2 min).

### Clave de carga

Es un *fine-grained personal access token* de GitHub: https://github.com/settings/personal-access-tokens/new

- **Repository access:** Only select repositories → `dashboard-facturacion-conteo`
- **Permissions → Repository permissions → Contents:** Read and write
- Nunca la pegues en el código ni en el repositorio (es público).

### Sin duplicados

Cada línea de Detalle se identifica por Día, Ruta, Zona, Transportista, Entrega, Factura y Código (más su número de repetición dentro del mismo Excel, porque un reporte puede traer dos posiciones con la misma clave). Si la misma línea viene en dos reportes se cuenta una vez, con los valores del generado más recientemente (celda "Generado el …" de la hoja Resumen). Un reporte completo (filtros en "Todos") más nuevo reemplaza por entero los días de su rango.

Para generar los datos en local: `cd scripts && npm install && node build_data.js ../excels ../data.json`.

La diferencia se calcula como `conteo − facturado` por línea.
