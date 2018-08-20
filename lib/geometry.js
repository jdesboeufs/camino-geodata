const {feature, area} = require('@turf/turf')
const {xor} = require('martinez-polygon-clipping')

function polygonsDiff(p1, p2) {
  const diff = xor(p1.geometry.coordinates, p2.geometry.coordinates)
  if (!diff && diff.length === 0) {
    return {area: 0}
  }
  const diffGeometry = Array.isArray(diff[0]) ?
    {type: 'MultiPolygon', coordinates: diff} :
    {type: 'Polygon', coordinates: diff}

  return {
    geometry: diffGeometry,
    area: area(feature(diffGeometry, {}))
  }
}

module.exports = {polygonsDiff}
