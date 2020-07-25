import { Vector3, Box3 } from 'three/src/Three.js'
import Layout from './Layout.js'
import Evaluators from './Evaluators.js'

/**

*/
class BoxLayout extends Layout {
	/**
	@param {Object3D} node the container node for this layout
	*/
	constructor(node) {
		super(node)
	}

	apply() {
		const childrenToPosition = this.node.children.filter((node) => {
			if (node.visible === false) return false
			if (node.shadowSOM === true) return false
			if (node.styles.computedStyles.getString('position') === 'absolute') return false
			if (
				node.styles.computedStyles.get('centroid') !== null ||
				node.styles.computedStyles.get('centroid-x') !== null ||
				node.styles.computedStyles.get('centroid-y') !== null
				// Allow Z to be set separately
			) {
				return false
			}
			return true
		})
		if (childrenToPosition.length === 0) return

		const directionStyleInfo = this.node.styles.computedStyles.get('layout-direction')
		let direction = BoxLayout.VERTICAL
		if (directionStyleInfo) {
			direction = directionStyleInfo.value === 'horizontal' ? BoxLayout.HORIZONTAL : BoxLayout.VERTICAL
		}
		// Start at the horizontal or vertical edge of the geometry bounds since it is always the first node to lay out
		this.node.styles.geometryBounds.getSize(_workingVector3_1)
		let child = null
		let position = BoxLayout.VERTICAL ? _workingVector3_1.y : _workingVector3_1.x
		for (let i = 0; i < childrenToPosition.length; i++) {
			child = childrenToPosition[i]
			_workingBox3_1.set(child.styles.marginBounds.min, child.styles.marginBounds.max)
			_workingBox3_1.scale(child.scale)
			_workingBox3_1.getSize(_workingVector3_1)
			if (direction === BoxLayout.VERTICAL) {
				child.position.setX(_workingBox3_1.min.x * -1)
				child.position.setY(position - _workingBox3_1.max.y)
				position -= _workingVector3_1.y
			} else {
				child.position.setX(position - _workingBox3_1.min.x)
				child.position.setY(_workingBox3_1.max.y * -1)
				position += _workingVector3_1.x
			}
		}
	}
}

BoxLayout.prototype.isBoxLayout = true

const _workingVector3_1 = new Vector3()
const _workingVector3_2 = new Vector3()
const _workingBox3_1 = new Box3()

BoxLayout.HORIZONTAL = Symbol('horizontal')
BoxLayout.VERTICAL = Symbol('vertical')

export default BoxLayout
