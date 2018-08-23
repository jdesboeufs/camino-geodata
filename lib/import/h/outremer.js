const {join} = require('path')
const {readFileSync} = require('fs')
const yaml = require('js-yaml')
const chalk = require('chalk')
const {pick} = require('lodash')
const {extractGeoJSONFeatures} = require('../../gdal')

const appRoot = join(__dirname, '..', '..', '..')
const dataRoot = join(appRoot, 'data', '2018_h_historiques_outremer')
const sources = yaml.safeLoad(readFileSync(join(appRoot, 'sources', 'h', 'outremer.yml'), 'utf8'))

async function doImport() {
  console.log(chalk.green(` * h - outre mer`))
  const titres = sources.map(s => {
    console.log(chalk.blue(` * ${s.path}`))
    const features = extractGeoJSONFeatures(join(dataRoot, s.path))
    const polygons = features.filter(f => ['Polygon', 'MultiPolygon'].includes(f.geometry.type))
    if (polygons.length === 0) {
      throw new Error('Périmètre non trouvé')
    }
    if (polygons.length > 1) {
      throw new Error('Plusieurs périmètres trouvés')
    }
    const [perimetre] = polygons
    return {
      type: 'Feature',
      geometry: perimetre.geometry,
      properties: {
        ...pick(s, 'numero', 'nom', 'typeTitre', 'etape', 'demarche'),
        domaine: 'h'
      }
    }
  })
  return titres
}

module.exports = doImport
