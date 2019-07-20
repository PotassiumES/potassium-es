/**
Constants used to communicate information about displays
*/
import { Color } from 'three/src/Three.js'

const PORTAL = 'portal'
const IMMERSIVE = 'immersive'
const DISPLAY_MODES = [PORTAL, IMMERSIVE]

const OPAQUE = 'opaque'
const ADDITIVE = 'additive'
const ALPHA_BLEND = 'alpha-blend'
const BLEND_MODES = [OPAQUE, ADDITIVE, ALPHA_BLEND]

const defaultBackgroundColor = new Color(0x99ddff)

export { PORTAL, IMMERSIVE, DISPLAY_MODES, OPAQUE, ADDITIVE, ALPHA_BLEND, BLEND_MODES, defaultBackgroundColor }
