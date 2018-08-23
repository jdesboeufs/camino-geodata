#! /usr/bin/env node
const {join} = require('path')
const {readFileSync, writeFileSync} = require('fs')
const yaml = require('js-yaml')
const chalk = require('chalk')
const {sortBy} = require('lodash')
const {extractGeoJSONFeatures} = require('./lib/gdal')
const {getIntersectedCommunes} = require('./lib/communes')
const {polygonsDiff} = require('./lib/geometry')

function buildPath(relativePath) {
  return join(__dirname, 'data', ...(relativePath.split('/')))
}

const DIFF_TOLERANCE_SFT = 1000

const TYPES_TITRES_LABELS = {
  cxx: 'concession',
  prh: 'permis exclusif de recherches',
  apx: 'autorisation de prospections préalables',
  pxh: 'permis d’exploitation'
}

const TYPES = {
  1: {typeTitre: 'cxx', etape: 'dex'},
  2: {typeTitre: 'cxx', etape: 'mfr'},
  3: {typeTitre: 'cxx', etape: 'mfr'},
  4: {typeTitre: 'prh', etape: 'dex'},
  5: {typeTitre: 'prh', etape: 'mfr'},
  6: {typeTitre: 'apx', etape: 'dex'},
  APP: {typeTitre: 'apx'},
  PER: {typeTitre: 'prh'},
  C: {typeTitre: 'cxx'},
  E: {typeTitre: 'pxh'}
}

const TITRES_DEM = {
  T: {etape: 'dex'},
  D: {etape: 'mfr'}
}

const LETTRES_DEMARCHE = {
  M: {demarche: 'oct'},
  N: {demarche: 'pr1'},
  P: {demarche: 'pr2'}
}

function getType(properties) {
  const result = {}
  if (properties.TYPE && properties.TYPE in TYPES) {
    Object.assign(result, TYPES[properties.TYPE])
  }
  if (properties.TITRE_DEM && properties.TITRE_DEM in TITRES_DEM) {
    Object.assign(result, TITRES_DEM[properties.TITRE_DEM])
  }
  if (result.typeTitre) {
    result.typeTitreLabel = TYPES_TITRES_LABELS[result.typeTitre]
  }
  if (result.typeTitre === 'prh' && result.etape === 'dex' && properties.NUMERO.charAt(0) in LETTRES_DEMARCHE) {
    Object.assign(result, LETTRES_DEMARCHE[properties.NUMERO.charAt(0)])
  }
  return result
}

function getNom(properties) {
  return properties.NOM || properties.NOM_MIN
}

function getNumero({NUMERO}) {
  if (!NUMERO) {
    throw new Error('Titre sans NUMERO')
  }
  const cleanedNumero = NUMERO.replace(/\s/g, '')
  const result = cleanedNumero.match(/^(M|N|P|C|D|E)?(\d+)$/)
  if (!result) {
    throw new Error('NUMERO du titre invalide: ' + NUMERO)
  }
  // Si la première lettre est un C, un D ou un E, on conserve la lettre en préfixe
  return ['C', 'D', 'E'].includes(result[1]) ? cleanedNumero : result[2]
}

function computeProperties(feature) {
  const {properties} = feature
  let numero
  try {
    numero = getNumero(properties)
  } catch (err) {
    console.log(chalk.gray(err.message + ' => ignoré'))
    return
  }
  const type = getType(properties)
  if (!type.typeTitre || !type.etape) {
    console.log(chalk.gray('Titre sans type défini => ignoré'))
    return
  }
  const nom = getNom(properties)
  if (!nom) {
    console.log(chalk.gray('Titre sans NOM'))
  }
  const communes = getIntersectedCommunes(feature)
  return {numero, nom, communes, ...type, indicativeTypeLabel: properties.TYPE_FR || properties.LEGENDE}
}

const domaines = ['h']
const titres = []
const titresIndex = {}

async function main() {
  domaines.forEach(domaine => {
    console.log(chalk.green(` * Domaine ${domaine}`))
    const rawSources = yaml.safeLoad(readFileSync(join(__dirname, 'sources', `${domaine}.yml`), 'utf8'))
    sortBy(rawSources, 'date')
      .forEach(source => {
        console.log(chalk.blue(` * ${source.date} | ${source.path}`))
        const actives = new Set()
        extractGeoJSONFeatures(buildPath(source.path))
          .map(f => {
            if (!f.geometry) {
              console.log(chalk.gray('Titre sans CONTOUR => ignoré'))
              return null
            }
            f.properties = computeProperties(f)
            if (!f.properties) {
              return null
            }
            f.properties.domaine = domaine
            f.properties.dateSource = source.date
            return f
          })
          .filter(f => Boolean(f))
          .forEach(f => {
            const {numero} = f.properties
            actives.add(numero)
            const current = titresIndex[numero]
            if (current && !current.properties.fin) {
              const diffArea = polygonsDiff(current, f).area
              if (diffArea > DIFF_TOLERANCE_SFT) {
                current.properties.fin = source.date
              } else {
                return
              }
            }
            titresIndex[numero] = f
            f.properties.debut = source.date
            titres.push(f)
          })
        Object.values(titresIndex).forEach(t => {
          if (!t.properties.fin && !actives.has(t.properties.numero)) {
            t.properties.fin = source.date
          }
        })
      })
  })
  writeFileSync(join(__dirname, 'titres.geojson'), JSON.stringify({type: 'FeatureCollection', features: titres}))
}

main().catch(err => {
  console.log(err)
  process.exit(1)
})
