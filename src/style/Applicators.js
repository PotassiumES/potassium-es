import Evaluators from './Evaluators.js'
import GridLayout from './GridLayout.js'
import BoxLayout from './BoxLayout.js'
import BorderLine from '../three/BorderLine.js'

/**
Applicators holds functions that apply a declared style property (color, font-size, etc.) to a Three.Object3D
@type {Map<string, StyleInfo>}
*/
const Applicators = new Map()

const _workingVector3_1 = new THREE.Vector3()

/** set Object3D.scale */
Applicators.set('scale', (node, styleInfo) => {
	if (typeof node.scale === 'undefined') return
	const parsedValue = Evaluators.parse(styleInfo.value, node)
	if (Array.isArray(parsedValue) === false || parsedValue.length === 0) return
	if (parsedValue.length < 3) {
		parsedValue[1] = parsedValue[0]
		parsedValue[2] = parsedValue[0]
	}
	node.scale.set(...parsedValue)
})

/** set Object3D.rotation */
Applicators.set('rotation', (node, styleInfo) => {
	const parsedValue = Evaluators.parse(styleInfo.value, node)
	if (parsedValue === undefined || parsedValue instanceof Array === false) return
	if (parsedValue.length !== 4) return
	node.quaternion.set(...parsedValue)
})

/** display */
Applicators.set('display', (node, styleInfo) => {
	switch (styleInfo.value) {
		case 'grid':
			if (!node.styles.layout || node.styles.layout.isGridLayout !== true) {
				node.styles.layout = new GridLayout(node)
			}
			// The other grid declarations like 'grid-template' are handled in GridLayout
			return
		case 'box':
			if (!node.styles.layout || node.styles.layout.isBoxLayout !== true) {
				node.styles.layout = new BoxLayout(node)
			}
			return
		case 'none':
			node.visible = false
			return
		case 'inherit':
			node.visible = true
			return
		default:
			console.error('unknown display mode', styleInfo)
			return
	}
})

/** the text size of a text node */
Applicators.set('font-size', (node, styleInfo) => {
	if (!node.isText) return
	const parsedValue = Evaluators.parse(styleInfo.value, node)
	if (typeof parsedValue === 'undefined') return
	node.setFontOptions({
		size: parsedValue[0]
	})
})

/**
the inheritable color value of a text node's material
a node's `material-color` (which is not inheritable) value will override `color`
*/
Applicators.set('color', (node, styleInfo) => {
	if (node.isText !== true) return
	if (!node.material || !node.material.color) return
	if (node.styles.computedStyles.get('material-color') !== null) return
	const parsedValue = Evaluators.parse(styleInfo.value, node)
	if (Array.isArray(parsedValue) === false || parsedValue.length != 3) return
	node.material.color.setRGB(...parsedValue)
})

/**
the inheritable emissive value of a text node's material
a node's `material-emissive` (which is not inheritable) value will override `emissive`
*/
Applicators.set('emissive', (node, styleInfo) => {
	if (node.isText !== true) return
	if (!node.material || !node.material.emissive) return
	if (node.styles.computedStyles.get('material-emissive') !== null) return
	const parsedValue = Evaluators.parse(styleInfo.value, node)
	if (Array.isArray(parsedValue) === false || parsedValue.length != 3) return
	node.material.emissive.setRGB(...parsedValue)
})

/** the emissive value of a node's material */
Applicators.set('material-emissive', (node, styleInfo) => {
	if (!node.material || !node.material.emissive) return
	const parsedValue = Evaluators.parse(styleInfo.value, node)
	if (typeof parsedValue === 'undefined') return
	node.material.emissive.setRGB(...parsedValue)
})

/** the duffuse color value of a node's material */
Applicators.set('material-color', (node, styleInfo) => {
	if (!node.material || !node.material.color) return
	const parsedValue = Evaluators.parse(styleInfo.value, node)
	if (typeof parsedValue === 'undefined') return
	if (node.material && node.material.color) {
		node.material.color.setRGB(...parsedValue)
	}
})

/** the node.position */
Applicators.set('centroid', (node, styleInfo) => {
	const parsedValue = Evaluators.parse(styleInfo.value, node)
	if (typeof parsedValue === 'undefined') return
	node.position.set(...parsedValue)
})
Applicators.set('centroid-x', (node, styleInfo) => {
	const parsedValue = Evaluators.parse(styleInfo.value, node)
	if (typeof parsedValue === 'undefined') return
	node.position.setComponent(0, parsedValue[0]) // parsed distances are in meters
})
Applicators.set('centroid-y', (node, styleInfo) => {
	const parsedValue = Evaluators.parse(styleInfo.value, node)
	if (typeof parsedValue === 'undefined') return
	node.position.setComponent(1, parsedValue[0]) // parsed distances are in meters
})
Applicators.set('centroid-z', (node, styleInfo) => {
	const parsedValue = Evaluators.parse(styleInfo.value, node)
	if (typeof parsedValue === 'undefined') return
	node.position.setComponent(2, parsedValue[0]) // parsed distances are in meters
})

export default Applicators
