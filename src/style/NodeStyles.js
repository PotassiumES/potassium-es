import som from '../SOM.js'

import GridLayout from './GridLayout.js'
import LocalStyles from './LocalStyles.js'
import ComputedStyles from './ComputedStyles.js'
import AssignedStyles from './AssignedStyles.js'

import BorderLine from '../three/BorderLine.js'
import Background from '../three/Background.js'

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

		this.borderLine = null
		this.background = null
	}

	get isInAnyWayDirty() {
		return this.geometryIsDirty || this.hierarchyIsDirty || this.layoutIsDirty || this.stylesAreDirty
	}

	get needsStyleRefresh() {
		/** 
		@TODO figure out why this causes constant style recomputation
		if (this.node.parent && this.node.parent.styles.hierarchyIsDirty) {
			// Computed styles can change based on parent's hierarchy
			return true
		}
		*/
		return this.stylesAreDirty
	}

	clearDirtyFlags() {
		this.geometryIsDirty = false
		this.hierarchyIsDirty = false
		this.layoutIsDirty = false
		this.stylesAreDirty = false
	}

	logFlags() {
		console.log('geometry:\t', this.geometryIsDirty)
		console.log('hierarcy:\t', this.hierarchyIsDirty)
		console.log('layout:\t', this.layoutIsDirty)
		console.log('styles:\t', this.stylesAreDirty)
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

	setSubgraphStylesDirty() {
		this.node.traverse(node => {
			node.styles.stylesAreDirty = true
		})
	}

	calculateEdgeBounds() {
		this.contentBounds.set(this.geometryBounds.min, this.geometryBounds.max)
		for (const child of this.node.children) {
			if (child.visible === false) continue
			if (child.shadowSOM === true) continue
			if (child.styles.computedStyles.getString('position') === 'absolute') continue
			_workingBox3_1.set(child.styles.marginBounds.min, child.styles.marginBounds.max)
			_workingBox3_1.scale(child.scale)
			_workingBox3_1.translate(child.position)
			this.contentBounds.expandByPoint(_workingBox3_1.min)
			this.contentBounds.expandByPoint(_workingBox3_1.max)
		}

		this.paddingBounds.set(this.contentBounds.min, this.contentBounds.max)
		let edgeWidth = this.computedStyles.getNumberArray('padding', [0, 0, 0, 0], 4)
		if (edgeWidth !== null) {
			this.paddingBounds.changeXYPlane(edgeWidth[0], edgeWidth[1], edgeWidth[2], edgeWidth[3])
		}

		this.borderBounds.set(this.paddingBounds.min, this.paddingBounds.max)
		edgeWidth = this.computedStyles.getNumberArray('border-width', [0, 0, 0, 0], 4)
		if (edgeWidth !== null) {
			this.borderBounds.changeXYPlane(edgeWidth[0], edgeWidth[1], edgeWidth[2], edgeWidth[3])
		}

		this.marginBounds.set(this.borderBounds.min, this.borderBounds.max)
		edgeWidth = this.computedStyles.getNumberArray('margin', [0, 0, 0, 0], 4)
		if (edgeWidth !== null) {
			this.marginBounds.changeXYPlane(edgeWidth[0], edgeWidth[1], edgeWidth[2], edgeWidth[3])
		}
	}

	updateShadowSOM() {
		// Gather info
		const borderWidth = this.computedStyles.getNumberArray('border-width', [0, 0, 0, 0], 4)
		const borderRadius = this.computedStyles.getNumberArray('border-radius', [0, 0, 0, 0], 4)

		const borderEmissive = this.computedStyles.getNumberArray('border-emissive', [0, 0, 0])

		const backgroundZ = this.computedStyles.getNumber('background-z', -0.02)
		const backgroundOpacity = Math.max(0, this.computedStyles.getNumber('background-opacity', 1))
		const backgroundEmissive = this.computedStyles.getNumberArray('background-emissive')

		this.paddingBounds.getSize(_workingVector3_1)
		this.borderBounds.getSize(_workingVector3_2)

		// Update the border
		if (borderWidth !== null && borderWidth.some(w => w > 0)) {
			if (this.borderLine === null) {
				this.borderLine = new BorderLine(borderWidth, _workingVector3_1.x, _workingVector3_1.y, borderRadius)
				this.node.add(this.borderLine)
			} else {
				this.borderLine.geometry.setParams(borderWidth, _workingVector3_1.x, _workingVector3_1.y, borderRadius)
			}
			if (borderEmissive !== null) {
				this.borderLine.material.emissive.setRGB(...borderEmissive)
			}
			this.borderLine.position.set(
				this.borderBounds.min.x + _workingVector3_2.x / 2,
				this.borderBounds.min.y + _workingVector3_2.y / 2,
				0
			)
		} else if (this.borderLine !== null) {
			this.node.remove(this.borderLine)
			this.borderLine.geometry.dispose()
			this.borderLine = null
		}

		// Update the background
		if (Array.isArray(backgroundEmissive)) {
			if (this.background === null) {
				this.background = new Background(_workingVector3_2.x, _workingVector3_2.y, borderRadius)
				this.node.add(this.background)
			} else {
				this.background.geometry.setParams(_workingVector3_2.x, _workingVector3_2.y, borderRadius)
			}

			this.background.material.emissive.setRGB(...backgroundEmissive)

			if (backgroundOpacity >= 1) {
				this.background.material.opacity = 1
				this.background.material.transparent = false
			} else {
				this.background.material.opacity = backgroundOpacity
				this.background.material.transparent = true
			}

			this.background.position.set(
				this.borderBounds.min.x + _workingVector3_2.x / 2,
				this.borderBounds.min.y + _workingVector3_2.y / 2,
				backgroundZ
			)
		} else if (this.background !== null) {
			this.node.remove(this.background)
			this.background.geometry.dispose()
			this.background = null
		}
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
const _workingVector3_2 = som.vector3()
const _workingBox3_1 = som.box3()

export default NodeStyles
