# Order Check

PWA móvil para comprobar rápidamente si un código de cuatro dígitos aparece en una lista CGO y llevar un checklist durante una visita al supermercado.

## Características

- Importación `CODE|INV|CGOQTY`, formato simple de V1 o una mezcla de ambos.
- Parser que conserva ceros iniciales, completa datos faltantes con `-`, elimina duplicados y mantiene el orden.
- Búsqueda automática al introducir cuatro dígitos.
- Navegación táctil desde cada fila a una vista de detalle con botón para volver.
- Checklist con filtros Todos, Pendientes y Revisados; Revisados muestra primero lo marcado más recientemente.
- Pestaña Display con una lista separada de código + cantidad, sin modificar el CGO ni los checks.
- Persistencia local de la visita, los checks y Display mediante `localStorage`.
- Instalación en iPhone desde Safari y funcionamiento offline mediante service worker.
- Actualizaciones de la aplicación sin borrar los datos de la visita.

## Desarrollo local

No requiere dependencias ni build system. Sirve la carpeta padre para conservar el path del project site:

```bash
cd ..
python3 -m http.server 8000
```

Abre `http://localhost:8000/order-check/`.

Ejecuta las pruebas con:

```bash
node --test tests/*.test.cjs
```

## Deployment

Los pushes a `main` ejecutan las pruebas y publican el sitio con GitHub Actions en:

<https://berluiscabrera2.github.io/order-check/>

Versión actual: **v1.3.0**
