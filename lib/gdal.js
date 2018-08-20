const gdal = require('gdal')
const parseSrs = require('srs').parse

const wgs84 = gdal.SpatialReference.fromEPSG(4326)

function gdalLayerToGeoJSONFeatures(gdalLayer, transformToWGS84 = false) {
  return gdalLayer.features.map(feature => {
    const properties = feature.fields.toObject()
    const geometry = feature.getGeometry()
    if (geometry && transformToWGS84) {
      geometry.transformTo(wgs84)
    }
    return {
      type: 'Feature',
      properties,
      geometry: geometry && geometry.toObject()
    }
  })
}

function getSrsName(gdalLayer) {
  if (!gdalLayer.srs) {
    return
  }
  const parsedSrs = parseSrs(gdalLayer.srs.toWKT())
  if (parsedSrs.name && parsedSrs !== 'unnamed') {
    return parsedSrs.name
  }
}

function extractGeoJSONFeatures(gdalPath) {
  const dataset = gdal.open(gdalPath)
  const layer = dataset.layers.get(0)
  const isWGS84 = getSrsName(layer) === 'WGS 84'
  return gdalLayerToGeoJSONFeatures(layer, !isWGS84)
}

module.exports = {gdalLayerToGeoJSONFeatures, getSrsName, extractGeoJSONFeatures}
