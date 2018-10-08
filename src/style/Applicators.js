import Evaluators from './Evaluators.js'

/**
Applicator holds functions that apply a declared style property (color, font-size, etc.) to a Three.Object3D
@type {Map<string, styleInfo>}
*/
const Applicators = new Map()

Applicators.set('color', (node, styleInfo) => {
	if(!node.isText) return
	const parsedValue = Evaluators.parse(styleInfo.value)
	if(typeof parsedValue === 'undefined') return
	node.setRGB(...parsedValue)
})

export default Applicators
