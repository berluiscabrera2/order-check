# Cambios

## v2.1.0 — Fotografías remotas

- Importa `url_imagen_goya` e `image_url` sin descartar datos; miniatura y foto grande cargan URL externa segura.
- Conserva el placeholder para entradas sin imagen o marcadas para revisar.
- Respaldo anterior: rama `pre-goya-images-20261028` en `0db14ef55f17f73bd519cfefea0c705d569cdef4` (v2.0.1).

## v2.0.1 — Corrección de importación

- La lista no aparece detrás de una ficha abierta tras importar el catálogo.

## v2.0.0 — Catálogo privado

- Pantalla inicial Catálogo con importación local CSV/JSON, búsqueda, filtros, favoritos y ficha.
- IndexedDB independiente de la visita CGO y Warehouse; exportación de respaldo JSON.
- Enlace desde detalles CGO al producto del catálogo y regreso a Order Check.
- Precios históricos etiquetados; no se publican datos comerciales ni fotografías de terceros.
- El despliegue de Pages empaqueta solamente archivos públicos de la PWA.

Versión anterior: v1.10.3, commit `f3ff75765327026e94befc44b58a28e97accacf1`, rama de respaldo `pre-goya-catalog-20261028`.
