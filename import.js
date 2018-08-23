#! /usr/bin/env node
const {join} = require('path')
const {writeFileSync} = require('fs')
const {concat} = require('lodash')
const decorate = require('./lib/decorate')
const importMetropoleH = require('./lib/import/h/metropole')
const importOutremerH = require('./lib/import/h/outremer')

async function main() {
  const titres = concat(
    await importMetropoleH(),
    await importOutremerH()
  )
  titres.forEach(decorate)
  const fc = {type: 'FeatureCollection', features: titres}
  writeFileSync(join(__dirname, 'titres.geojson'), JSON.stringify(fc))
}

main().catch(err => {
  console.log(err)
  process.exit(1)
})
