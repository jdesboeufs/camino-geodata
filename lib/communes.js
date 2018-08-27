const {join} = require('path')
const {bbox} = require('@turf/turf')
const {intersection} = require('martinez-polygon-clipping')
const whichPolygon = require('which-polygon')
const {keyBy} = require('lodash')
const {extractGeoJSONFeatures} = require('./gdal')

const communesPath = join(__dirname, '..', 'data', 'communes', 'communes-20180101-shp.zip')

const communes = extractGeoJSONFeatures('/vsizip/' + communesPath)

const inseeIndex = keyBy(communes, c => c.properties.insee)
const spatialIndex = whichPolygon({type: 'FeatureCollection', features: communes})

function intersects(f1, f2) {
  const g1 = f1.geometry.coordinates
  const g2 = f2.geometry.coordinates
  const result = intersection(g1, g2)
  return Boolean(result && result.length > 0)
}

function getIntersectedCommunes(feature) {
  const computedBbox = bbox(feature)
  const results = spatialIndex.bbox(computedBbox)
  return results
    .filter(({insee}) => {
      const commune = inseeIndex[insee]
      try {
        return intersects(commune, feature)
      } catch (err) {
        console.error(err)
        return false
      }
    })
    .map(c => c.insee)
}

module.exports = {getIntersectedCommunes}
