# Order Check

PWA móvil para comprobar rápidamente si un código de cuatro dígitos aparece en una lista CGO y llevar un checklist durante una visita al supermercado.

## Características

- Importación principal `CODE|INV|CGOQTY|DAY`, con DAY en tres letras (MON–SUN). El formato anterior sin DAY sigue siendo compatible.
- Parser endurecido: conserva ceros iniciales y CODE/INV/CGO QTY/DAY. El mismo CODE se mantiene separado entre días distintos y solo se fusiona cuando coincide CODE + DAY.
- Búsqueda incremental desde el primer dígito, independiente del filtro Todos/Pendientes/Revisados, con confirmación clara CGO SÍ/NO al completar cuatro dígitos. Mientras el buscador está enfocado aparece un botón flotante azul Enter abajo a la derecha. Enter marca resultados en orden sin desmarcar accidentalmente productos ya revisados.
- Filas optimizadas para uso rápido con la mano derecha: un acceso pequeño a detalles queda a la izquierda y casi todo el resto de la fila funciona como área de marcado, con el checkbox grande a la derecha. Al marcar o desmarcar, la búsqueda se limpia automáticamente; si el teclado estaba abierto, se mantiene abierto.
- Checklist con conteos por día. Un icono compacto junto a Display abre un menú ALL/MON/TUE/WED/THU/FRI/SAT/SUN según los días cargados. Otro icono permite usar el orden original del TXT, ascendente o descendente. Todos y Pendientes conservan el orden original por defecto; Revisados siempre muestra lo más reciente arriba.
- Display vive en un botón superior separado; a su lado está el filtro por día. El título visible es un grupo editable de 1 a 3 emojis (por defecto 🚀👾).
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

Versión actual: **v1.9.0**
