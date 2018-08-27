#! /usr/bin/env node --max_old_space_size=8192
const {join} = require('path')
const {writeFileSync} = require('fs')
const {concat} = require('lodash')
const decorate = require('./lib/decorate')
const importMetropoleH = require('./lib/import/h/metropole')
const importOutremerH = require('./lib/import/h/outremer')
const extractPoints = require('./lib/points-jorf')

async function main() {
  const titres = concat(
    await importMetropoleH(),
    await importOutremerH()
  )
  titres.forEach(decorate)
  const fc = {type: 'FeatureCollection', features: titres}
  writeFileSync(join(__dirname, 'titres.geojson'), JSON.stringify(fc))

  const titresJO = await extractPoints()
  writeFileSync(join(__dirname, 'titres-jo.json'), JSON.stringify(titresJO))
}

main().catch(err => {
  console.log(err)
  process.exit(1)
})
