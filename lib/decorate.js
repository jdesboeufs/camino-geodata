const {getIntersectedCommunes} = require('./communes')

const TYPES_TITRES_LABELS = {
  cxx: 'concession',
  prh: 'permis exclusif de recherches',
  apx: 'autorisation de prospections préalables',
  pxh: 'permis d’exploitation'
}

function decorate(titre) {
  const p = titre.properties
  if (p.typeTitre) {
    p.typeTitreLabel = TYPES_TITRES_LABELS[p.typeTitre]
  }
  p.communes = getIntersectedCommunes(titre)
  return titre
}

module.exports = decorate
