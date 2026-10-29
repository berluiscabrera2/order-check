# Order Check

PWA móvil para comprobar rápidamente si un código de cuatro dígitos aparece en una lista CGO y llevar un checklist durante una visita al supermercado.

## Características

- Importación principal `CODE|INV|CGOQTY|DAY`, con DAY en tres letras (MON–SUN). El formato anterior sin DAY sigue siendo compatible.
- Parser endurecido: conserva ceros iniciales y CODE/INV/CGO QTY/DAY. El mismo CODE se mantiene separado entre días distintos y solo se fusiona cuando coincide CODE + DAY.
- Búsqueda incremental desde el primer dígito, independiente del filtro Todos/Pendientes/Revisados. El buscador filtra las filas y la información CGO/INV/QTY se muestra únicamente al abrir los detalles de un producto. Mientras el buscador está enfocado aparece un botón flotante azul Enter abajo a la derecha. Enter marca resultados en orden sin desmarcar accidentalmente productos ya revisados.
- Filas optimizadas para uso rápido con la mano derecha: un acceso pequeño a detalles queda a la izquierda y casi todo el resto de la fila funciona como área de marcado, con el checkbox grande a la derecha. Al marcar o desmarcar, la búsqueda se limpia automáticamente; si el teclado estaba abierto, se mantiene abierto.
- Checklist con conteos por día. Un icono compacto junto a Warehouse abre un menú ALL/MON/TUE/WED/THU/FRI/SAT/SUN según los días cargados. Otro icono permite usar el orden original del TXT, ascendente o descendente. Todos y Pendientes conservan el orden original por defecto; Revisados siempre muestra lo más reciente arriba.
- Warehouse vive en un botón superior separado y contiene dos listas independientes: Display y Aísles. Cada una permite registrar códigos y cantidades sin modificar CGO ni la otra lista.
- Persistencia local de la visita, los checks, Display y Aísles mediante `localStorage`.
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

Versión actual: **v2.0.1**

## Catálogo privado

Al abrir, la PWA muestra Catálogo aunque no haya visita activa. En Safari, pulsa **Importar catálogo CSV o JSON**, selecciona el archivo privado desde Archivos y espera la confirmación de 1,753 productos. El archivo se lee localmente y se guarda en IndexedDB; no se sube al servidor. Busca por código o descripción, filtra por sección, fotos verificadas o favoritos y abre una fila para ver la ficha. Los precios de la fuente son **históricos (21-jun a 18-jul-2026)** y requieren verificación. **Exportar respaldo** descarga un JSON privado que también puede reimportarse. Guárdalo fuera de GitHub.

Pulsa **Order Check** para volver al flujo CGO; desde los detalles CGO, **Ver en catálogo** muestra el mismo código y **Volver a Order Check** restaura la pantalla anterior. Las claves de `localStorage` de visita, Warehouse, Display y Aísles no cambian. Las imágenes solo se muestran si una futura importación tiene URL oficial y correspondencia exacta verificada; no se cachean en el service worker.

El workflow publica una lista explícita de archivos de la app. Nunca agregues CSV, JSON comercial, PDF ni precios a Git. Los archivos con esos nombres están excluidos por `.gitignore`.

## Rollback a v1.10.3

La rama remota `pre-goya-catalog-20261028` apunta al commit exacto anterior (`f3ff75765327026e94befc44b58a28e97accacf1`). Antes de restaurar, exporta el catálogo privado en la app y haz backup de cualquier visita activa. Desde una clonación actualizada, crea una rama nueva desde `main`, **revierte** el commit o merge de v2.0.0 (sin force push) y abre PR a `main`. Si hay varios commits, revierte sus SHAs en orden inverso. Alternativamente, crea una rama de restauración desde el SHA de respaldo y usa un nuevo commit que copie su árbol a `main`, preservando la historia. El push a `main` dispara pruebas y GitHub Pages. Verifica que la URL muestre v1.10.3. El service worker de la versión restaurada fuerza descarga fresca en instalación y elimina únicamente cachés antiguas `order-check-shell-*`; no toca `localStorage` ni IndexedDB. Si Safari conserva una pestaña antigua, ciérrala y vuelve a abrirla con conexión para que se active el worker restaurado. La v1.10.3 no muestra el catálogo pero sus datos IndexedDB permanecen disponibles para una versión posterior.
