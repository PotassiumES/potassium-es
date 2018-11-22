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
		const childrenToPosition = this.node.children.filter(node => {
			if (node.visible === false) return false
			if (node.styles.computedStyles.getString('position') === 'absolute') return false
			if (
				node.styles.computedStyles.get('centroid') !== null ||
				node.styles.computedStyles.get('centroid-x') !== null ||
				node.styles.computedStyles.get('centroid-y') !== null
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
		// Start at the horizontal or vertical edge of the geometry bounds
		this.node.styles.geometryBounds.getSize(_workingVector3_1)
		let position = BoxLayout.VERTICAL ? _workingVector3_1.y : _workingVector3_1.x
		for (const child of childrenToPosition) {
			_workingBox3_1.set(child.styles.marginBounds.min, child.styles.marginBounds.max)
			_workingBox3_1.scale(child.scale)
			_workingBox3_1.getSize(_workingVector3_1)
			_workingBox3_1.getCenter(_workingVector3_2)
			if (direction === BoxLayout.VERTICAL) {
				child.position.setX(_workingVector3_1.x / -2)
				child.position.setY(position - _workingVector3_1.y / 2 - _workingVector3_2.y)
				position -= _workingVector3_1.y
			} else {
				child.position.setX(position + _workingVector3_1.x / 2 - _workingVector3_2.x)
				child.position.setY(_workingVector3_1.y / -2)
				position += _workingVector3_1.x
			}
		}
	}
}

BoxLayout.prototype.isBoxLayout = true

const _workingVector3_1 = new THREE.Vector3()
const _workingVector3_2 = new THREE.Vector3()
const _workingBox3_1 = new THREE.Box3()

BoxLayout.HORIZONTAL = Symbol('horizontal')
BoxLayout.VERTICAL = Symbol('vertical')

export default BoxLayout
