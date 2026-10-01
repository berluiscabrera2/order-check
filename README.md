# Order Check

PWA móvil para comprobar rápidamente si un código de cuatro dígitos aparece en una lista CGO y llevar un checklist durante una visita al supermercado.

## Características

- Importación `CODE|INV|CGOQTY`, formato simple de V1 o una mezcla de ambos.
- Parser que conserva ceros iniciales, completa datos faltantes con `-`, elimina duplicados y mantiene el orden.
- Búsqueda incremental desde el primer dígito, con los 4 dígitos centrados y botón X para limpiar, respetando el filtro activo. Mientras el buscador está enfocado aparece un botón flotante azul Enter abajo a la derecha; marca el primer resultado, limpia la búsqueda y conserva el teclado abierto.
- Filas optimizadas para uso rápido con la mano derecha: un acceso pequeño a detalles queda a la izquierda y casi todo el resto de la fila funciona como área de marcado, con el checkbox grande a la derecha. Al marcar o desmarcar, la búsqueda se limpia automáticamente; si el teclado estaba abierto, se mantiene abierto.
- Checklist con conteos que se refrescan desde la carga inicial: Todos y Pendientes ordenados de menor a mayor; Revisados mantiene arriba lo marcado más recientemente.
- Display vive en un botón superior separado; abre su propia pantalla con botón Volver y mantiene una lista independiente de código + cantidad.
- Persistencia local de la visita, los checks y Display mediante `localStorage`.
- Instalación en iPhone desde Safari y funcionamiento offline mediante service worker.
- Botón flotante para volver al inicio al hacer scroll y layout compacto para aprovechar mejor la pantalla.
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

Versión actual: **v1.7.2**
