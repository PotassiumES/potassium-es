import Evaluators from './Evaluators.js'
import GridLayout from './GridLayout.js'

/**
Applicators holds functions that apply a declared style property (color, font-size, etc.) to a Three.Object3D
@type {Map<string, StyleInfo>}
*/
const Applicators = new Map()

/** display */
Applicators.set('display', (node, styleInfo) => {
	switch (styleInfo.value) {
		case 'grid':
			if (!node.layout || node.layout.isGrid === false) {
				node.layout = new GridLayout(node)
			}
			// The other grid style types like 'grid-template' are handled in GridLayout
			return
		default:
			console.log('unknown display mode', styleInfo)
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

/** the text color of a text node */
Applicators.set('color', (node, styleInfo) => {
	if (!node.isText) return
	const parsedValue = Evaluators.parse(styleInfo.value, node)
	if (typeof parsedValue === 'undefined') return
	node.setRGB(...parsedValue)
})

/** the emissive color of a node's material */
Applicators.set('material-emissive', (node, styleInfo) => {
	if (!node.material || !node.material.emissive) return
	const parsedValue = Evaluators.parse(styleInfo.value, node)
	if (typeof parsedValue === 'undefined') return
	node.material.emissive.setRGB(...parsedValue)
})

/** the background color of the entire scene */

Applicators.set('background-color', (node, styleInfo) => {
	if (!node.isScene) return
	const parsedValue = Evaluators.parse(styleInfo.value, node)
	if (typeof parsedValue === 'undefined') return
	if (node.background === null) {
		node.background = new THREE.Color()
	}
	node.background.setRGB(...parsedValue)
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
