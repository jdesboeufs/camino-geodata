/* eslint camelcase: off */
const {promisify} = require('util')
const {join} = require('path')
const fs = require('fs')
const bluebird = require('bluebird')
const chalk = require('chalk')
const parse = require('csv-parse')
const gdal = require('gdal')
const {keyBy, groupBy} = require('lodash')
const refTitres = require('../data/ref-titres-h.json')

const {readdirSync, createReadStream} = fs
const stat = promisify(fs.stat)

const dataRoot = join(__dirname, '..', 'data', 'jorf_points_etapes_h')

const titresIndex = keyBy(refTitres, 'id')

function getTitreRef(fileName) {
  const [id] = fileName.match(/^(h-.*-\d{4})/g)
  return titresIndex[id]
}

const EXPECTED_HEADERS = [
  'groupe',
  'contour',
  'point',
  'jorf_id',
  'description'
]

function isValid(headerList) {
  for (let i = 0; i < EXPECTED_HEADERS.length; i++) {
    if (headerList[i] !== EXPECTED_HEADERS[i]) {
      return false
    }
  }
  if (headerList.length < 7) {
    return false
  }
  return true
}

function extractRawData(path) {
  return new Promise((resolve, reject) => {
    const data = {rows: []}
    const parseOptions = {
      delimiter: '\t',
      columns: c => {
        data.originalHeaders = c
        return [...EXPECTED_HEADERS, 'x', 'y']
      },
      trim: true,
      cast: false,
      relax: true,
      relax_column_count: true
    }
    createReadStream(path)
      .on('error', reject)
      .pipe(parse(parseOptions))
      .on('error', reject)
      .on('data', row => {
        if (row.groupe) {
          data.rows.push(row)
        }
      })
      .on('end', () => {
        resolve(data)
      })
  })
}

function toWGS(epsgCode, pt) {
  const point = new gdal.Point(pt[0], pt[1])
  const transformation = new gdal.CoordinateTransformation(
    gdal.SpatialReference.fromEPSG(parseInt(epsgCode, 10)),
    gdal.SpatialReference.fromEPSG(4326)
  )
  point.transform(transformation)
  return [point.x, point.y]
}

function parseCoord(coord) {
  return parseFloat(coord.replace(/,/, '.'))
}

async function extractPoints() {
  const titres = []
  const files = readdirSync(dataRoot).filter(f => f.endsWith('.tsv'))
  await bluebird.mapSeries(files, async file => {
    const filePath = join(dataRoot, file)
    const stats = await stat(filePath)
    if (stats.size === 0) {
      return
    }
    console.log(chalk.blue(` * ${file}`))
    const {rows, originalHeaders} = await extractRawData(filePath)
    if (!isValid(originalHeaders)) {
      console.log(chalk.red(`En-têtes non valides : ${originalHeaders.join(', ')}`))
      return
    }
    const epsgCode = originalHeaders[5] === '27572' ? '4807' : originalHeaders[5]
    if (!epsgCode.match(/^\d{4,5}$/)) {
      console.log(chalk.red(`Système de coordonnées non valide : ${epsgCode}`))
      return
    }
    rows.forEach(row => {
      if (row.x && row.y) {
        try {
          const sourceCoord = [parseCoord(row.x), parseCoord(row.y)]
          const [lon, lat] = toWGS(epsgCode, sourceCoord)
          row.lon = lon
          row.lat = lat
        } catch (err) {
          console.log(chalk.yellow(`Échec de conversion des coordonnées`))
        }
      }
    })
    const allPointsDefined = rows.every(r => r.lon && r.lat)
    if (allPointsDefined) {
      const points = rows
      const perimetreCoords = Object.values(groupBy(points, 'groupe')).map(groupePoints => {
        return Object.values(groupBy(groupePoints, 'contour')).map(contourPoints => {
          return [...contourPoints, contourPoints[0]].map(p => [p.lon, p.lat])
        })
      })
      const perimetreGeometry = perimetreCoords.length === 1 ?
        {type: 'Polygon', coordinates: perimetreCoords[0]} :
        {type: 'MultiPolygon', coordinates: perimetreCoords}

      const titreRef = getTitreRef(file)
      if (titreRef) {
        const numero = titreRef.references.DGEC
        const {nom} = titreRef
        const typeTitre = titreRef.type_id
        const domaine = 'h'
        titres.push({numero, nom, typeTitre, domaine, file, points, perimetre: perimetreGeometry})
      } else {
        console.log(chalk.gray('Métadonnées manquantes => ignoré'))
      }
    } else {
      console.log(chalk.gray('Tous les points ne sont pas définis => ignoré'))
    }
  })
  return titres
}

module.exports = extractPoints
