"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { parseImport, filterProducts, imageUrlForProduct } = require("../catalog-core.js");
const headers = "codigo,descripcion_pdf,seccion_pdf,medida_pdf,unidades_por_caja_pdf,unit_price_pdf_usd_por_peso_o_volumen,sugg_retail_pdf_usd_por_producto";
const sample = `${headers}\n0500,Sample A,Example,1 oz,5,9.87,8.76\n2469,\"Sample, B\",Example,2 oz,6,,7.65\n`;

test("CSV conserva códigos, comillas y precios de columnas distintas", () => {
  const products = parseImport(sample, "private.csv");
  assert.equal(products[0].codigo, "0500");
  assert.equal(products[0].unit_price_pdf_usd_por_peso_o_volumen, "9.87");
  assert.equal(products[0].sugg_retail_pdf_usd_por_producto, "8.76");
  assert.equal(products[1].descripcion_pdf, "Sample, B");
  assert.equal(products[1].unit_price_pdf_usd_por_peso_o_volumen, "");
});
test("JSON acepta data, búsquedas parciales, categorías y acentos", () => {
  const items = parseImport(JSON.stringify({data: [{codigo:"0743", descripcion_pdf:"Habichón", seccion_pdf:"Frijoles"}]}), "backup.json");
  assert.equal(filterProducts(items,{query:"074"}).length,1);
  assert.equal(filterProducts(items,{query:"habichon",category:"Frijoles"}).length,1);
  assert.equal(filterProducts(items,{photos:true}).length,0);
  items[0].favorite=true;
  assert.equal(filterProducts(items,{favorites:true}).length,1);
});
test("falla sin afectar datos importados previamente y no acepta duplicados", () => {
  const previous = parseImport(sample,"catalog.csv");
  assert.throws(() => parseImport(`${sample}0500,Other,Beans,,,,\n`,"bad.csv"),/duplicado/);
  assert.throws(() => parseImport(`${headers}\n12345,Wrong,Beans,,,,\n`,"bad.csv"),/cuatro dígitos/);
  assert.throws(() => parseImport(`${headers}\n"0500,Broken,Beans,,,,\n`,"bad.csv"),/incompleto/);
  assert.equal(previous.length,2);
});
test("valida lotes de 1753 productos sin convertir códigos a números", () => {
  const rows=Array.from({length:1753},(_,i)=>`${String(i).padStart(4,"0")},Item ${i},Section,,,,`);
  const items=parseImport(`${headers}\n${rows.join("\n")}`,"catalog.csv");
  assert.equal(items.length,1753);
  assert.equal(items[0].codigo,"0000");
});
test("solo imágenes exactas marcadas verificadas y alojadas en Goya", () => {
  const data=[{codigo:"0500",url_imagen_goya:"https://www.goya.com/en/products/example.jpg",estado_match_goya:"pendiente"},{codigo:"0743",url_imagen_goya:"https://www.goya.com/en/products/verified.jpg",estado_match_goya:"verificado"}];
  const items=parseImport(JSON.stringify(data),"file.json");
  assert.equal(items[0].url_imagen_goya,data[0].url_imagen_goya);
  assert.equal(imageUrlForProduct(items[0]),"");
  assert.equal(imageUrlForProduct(items[1]),data[1].url_imagen_goya);
});
test("CSV nuevo conserva ambas URLs y muestra coincidencias exactas en lista y detalle", () => {
  const header = `${headers},url_imagen_goya,image_url,estado_match_goya,fuente_imagen_goya,criterio_match_imagen`;
  const url = "https://www.goya.com/wp-content/uploads/2023/12/0500-Front.png";
  const items = parseImport(`${header}\n0500,Sample A,Demo,1 oz,5,9.87,8.76,${url},${url},imagen_coincide_codigo_y_presentacion,Goya,sku_y_presentacion\n`,"photos.csv");
  assert.equal(items[0].image_url,url);
  assert.equal(items[0].fuente_imagen_goya,"Goya");
  assert.equal(imageUrlForProduct(items[0]),url);
  assert.equal(filterProducts(items,{photos:true}).length,1);
  assert.equal(imageUrlForProduct(parseImport(JSON.stringify({data:items}),"backup.json")[0]),url);
});
test("URLs dudosas, ajenas, contradictorias o con código diferente conservan placeholder", () => {
  const url = "https://www.goya.com/wp-content/uploads/0500-Front.png";
  const base = {codigo:"0500",image_url:url,estado_match_goya:"imagen_coincide_codigo_y_presentacion"};
  assert.equal(imageUrlForProduct({...base,estado_match_goya:"revisar_codigo_imagen"}),"");
  assert.equal(imageUrlForProduct({...base,image_url:"https://example.com/0500.png"}),"");
  assert.equal(imageUrlForProduct({...base,url_imagen_goya:"https://www.goya.com/0743.png"}),"");
  assert.equal(imageUrlForProduct({...base,image_url:"https://www.goya.com/15000.png"}),"");
  assert.equal(imageUrlForProduct({...base,image_url:"https://www.goya.com/%ZZ0500.png"}),"");
  assert.equal(imageUrlForProduct(parseImport(JSON.stringify([base]),"file.json")[0]),url);
});
test("Catálogo inicial y enlace CGO; sin datos privados ni costos internos en el bundle", () => {
  const root=path.resolve(__dirname,"..");
  const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
  const app=fs.readFileSync(path.join(root,"catalog.js"),"utf8");
  assert.match(app,/view.hidden = false;\s*readProducts\(\)/);
  assert.match(html,/id="detail-catalog-button"/);
  assert.match(app,/indexedDB.open/);
  assert.match(app,/content\.hidden = !products\.length \|\| !detail\.hidden/);
  assert.doesNotMatch(html+app,/CASE COST|UNIT COST|24\/ chick peas|catalogo_goya_para_work/);
  assert.match(fs.readFileSync(path.join(root,"service-worker.js"),"utf8"),/catalog\.js/);
  const workflow=fs.readFileSync(path.join(root,".github/workflows/deploy-pages.yml"),"utf8");
  assert.match(workflow,/path: _site/);
  assert.doesNotMatch(workflow,/path: \./);
});
