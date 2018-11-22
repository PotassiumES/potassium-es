import som from '../SOM.js'

import GridLayout from './GridLayout.js'
import LocalStyles from './LocalStyles.js'
import ComputedStyles from './ComputedStyles.js'
import AssignedStyles from './AssignedStyles.js'

/**
NodeStyles is assigned to the `styles` attribute of each SOM node (which are {@link THREE.Object3D}s).

It holds the KSS style information in `matchingRules, {@link AssignedStyles}, {@link LocalStyles}, and {@link ComputedStyles}.

It holds the {@link Layout} for the node.

It holds the bounding box information for the node.

It holds the layout-related flags for the node.

The calculation of the KSS cascade, layout, and bounds are controlled in {@link Stylist} and {@link Stylesheet}.
*/
class NodeStyles {
	/**
	@param {THREE.Object3d} node
	*/
	constructor(node) {
		this.node = node

		/**
		KSS rules whose selectors match this node
		@type {Object[]}
		@param {SelectorFragmentList} selector - the selector that matched
		@param {Object} rule - the entire rule
		@param {Selector[]} rule.selectors
		@param {Declaration[]} rule.declarations
		@param {Stylesheet} stylesheet
		*/
		this.matchingRules = []

		/** KSS declarations from rules that match this node */
		this.localStyles = new LocalStyles()
		/** KSS declarations programatically set on this node */
		this.assignedStyles = new AssignedStyles(node)
		/** KSS declarations computed via the cascade */
		this.computedStyles = new ComputedStyles(node)

		// Layout-related flags
		this.geometryIsDirty = true // when the geometry has changed
		this.hierarchyIsDirty = true // when a child has been added or removed
		this.layoutIsDirty = true // when layout-effecting KSS has changed or a child's size has changed

		// Style flag
		this.stylesAreDirty = true

		this.layout = null

		// Bounding boxes using model (not world) coordinates
		this.marginBounds = som.box3().makeZero()
		this.borderBounds = som.box3().makeZero()
		this.paddingBounds = som.box3().makeZero()
		this.contentBounds = som.box3().makeZero()
		this.geometryBounds = som.box3().makeZero()
	}

	get isInAnyWayDirty() {
		return this.geometryIsDirty || this.hierarchyIsDirty || this.layoutIsDirty || this.stylesAreDirty
	}

	get needsStyleRefresh() {
		if (this.node.parent) {
			// Computed styles can change based on parent's hierarchy
			if (this.node.parent.styles.hierarchyIsDirty) return true
		}
		return this.stylesAreDirty
	}

	clearDirtyFlags() {
		this.geometryIsDirty = false
		this.hierarchyIsDirty = false
		this.layoutIsDirty = false
		this.stylesAreDirty = false
	}

	/**
	Sets dirty the layout flag for all of the scene graph ancestors of this node and the node itself.
	This method is usually used when this node's size has changed and the parent will need to run layout.
	*/
	setAncestorsLayoutDirty() {
		for (const node of this.node.getAncestry()) {
			node.styles.layoutIsDirty = true
		}
	}

	/**
	Sets dirty the hierarcy flag for all of the scene graph ancestors of this node and the node itself.
	This method is usually used when in Object3D.add or Object3D.remove
	*/
	setAncestorsHierarchyDirty() {
		for (const node of this.node.getAncestry()) {
			node.styles.hierarchyIsDirty = true
		}
	}

	calculateEdgeBounds() {
		this.contentBounds.set(this.geometryBounds.min, this.geometryBounds.max)
		for (const child of this.node.children) {
			if (child.visible === false) continue
			if (child.styles.computedStyles.getString('position') === 'absolute') continue
			_workingBox3_1.set(child.styles.marginBounds.min, child.styles.marginBounds.max)
			_workingBox3_1.translate(child.position)
			this.contentBounds.expandByPoint(_workingBox3_1.min)
			this.contentBounds.expandByPoint(_workingBox3_1.max)
		}
		this.contentBounds.scale(this.node.scale)

		this.paddingBounds.set(this.contentBounds.min, this.contentBounds.max)
		let edgeWidth = this.computedStyles.getNumber('padding', [0])
		_workingVector3_1.set(edgeWidth[0], edgeWidth[0], edgeWidth[0])
		this.paddingBounds.expandByVector(_workingVector3_1)

		this.borderBounds.set(this.paddingBounds.min, this.paddingBounds.max)
		edgeWidth = this.computedStyles.getNumber('border-width', [0])
		_workingVector3_1.set(edgeWidth[0], edgeWidth[0], edgeWidth[0])
		this.borderBounds.expandByVector(_workingVector3_1)

		this.marginBounds.set(this.borderBounds.min, this.borderBounds.max)
		edgeWidth = this.computedStyles.getNumber('margin', [0])
		_workingVector3_1.set(edgeWidth[0], edgeWidth[0], edgeWidth[0])
		this.marginBounds.expandByVector(_workingVector3_1)
	}

	calculateGeometryBounds() {
		this.geometryBounds.makeZero()
		if (this.node.geometry === undefined) return
		if (this.node.geometry.isGeometry) {
			const vertices = this.node.geometry.vertices
			for (let i = 0, l = vertices.length; i < l; i++) {
				this.geometryBounds.expandByPoint(vertices[i])
			}
		} else if (this.node.geometry.isBufferGeometry) {
			const attribute = this.node.geometry.attributes.position
			if (attribute !== undefined) {
				for (let i = 0, l = attribute.count; i < l; i++) {
					_workingVector3_1.fromBufferAttribute(attribute, i)
					this.geometryBounds.expandByPoint(_workingVector3_1)
				}
			}
		}
	}
}

const _workingVector3_1 = som.vector3()
const _workingBox3_1 = som.box3()

export default NodeStyles
