/**
Constants used to communicate information about displays
*/

const PORTAL = 'portal'
const IMMERSIVE = 'immersive'
const DISPLAY_MODES = [PORTAL, IMMERSIVE]

const OPAQUE = 'opaque'
const ADDITIVE = 'additive'
const ALPHA_BLEND = 'alpha-blend'
const BLEND_MODES = [OPAQUE, ADDITIVE, ALPHA_BLEND]

const defaultBackgroundColor = new THREE.Color(0x99ddff)

export { PORTAL, IMMERSIVE, DISPLAY_MODES, OPAQUE, ADDITIVE, ALPHA_BLEND, BLEND_MODES, defaultBackgroundColor }
