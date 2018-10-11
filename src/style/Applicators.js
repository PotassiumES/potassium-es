import Evaluators from './Evaluators.js'

/**
Applicator holds functions that apply a declared style property (color, font-size, etc.) to a Three.Object3D
@type {Map<string, styleInfo>}
*/
const Applicators = new Map()

/** text color */
Applicators.set('color', (node, styleInfo) => {
	if(!node.isText) return
	const parsedValue = Evaluators.parse(styleInfo.value, node)
	if(typeof parsedValue === 'undefined') return
	node.setRGB(...parsedValue)
})

Applicators.set('font-size', (node, styleInfo) => {
	if(!node.isText) return
	const parsedValue = Evaluators.parse(styleInfo.value, node)
	if(typeof parsedValue === 'undefined') return
	node.setFontOptions({
		size: parsedValue[0]
	})
})

Applicators.set('material-color', (node, styleInfo) => {
	if(!node.material || !node.material.color) return
	const parsedValue = Evaluators.parse(styleInfo.value, node)
	if(typeof parsedValue === 'undefined') return
	node.material.color.setRGB(...parsedValue)
})

Applicators.set('centroid', (node, styleInfo) => {
	const parsedValue = Evaluators.parse(styleInfo.value, node)
	if(typeof parsedValue === 'undefined') return
	node.position.set(...parsedValue)
})

Applicators.set('centroid-x', (node, styleInfo) => {
	const parsedValue = Evaluators.parse(styleInfo.value, node)
	if(typeof parsedValue === 'undefined') return
	node.position.setComponent(0, parsedValue[0]) // parsed distances are in meters
})


Applicators.set('centroid-y', (node, styleInfo) => {
	const parsedValue = Evaluators.parse(styleInfo.value, node)
	if(typeof parsedValue === 'undefined') return
	node.position.setComponent(1, parsedValue[0]) // parsed distances are in meters
})


Applicators.set('centroid-z', (node, styleInfo) => {
	const parsedValue = Evaluators.parse(styleInfo.value, node)
	if(typeof parsedValue === 'undefined') return
	node.position.setComponent(2, parsedValue[0]) // parsed distances are in meters
})

export default Applicators
