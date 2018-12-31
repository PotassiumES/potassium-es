import Attributes from '../style/Attributes.js'
import NodeStyles from '../style/NodeStyles.js'

import { SelectorFragmentList } from '../style/Selector.js'

/**
importing this extends THREE.Object3D with many methods and attributes useful for creating and manipulating the SOM
*/

const _workingVector3_1 = new THREE.Vector3()
const _workingVector3_2 = new THREE.Vector3()

// Used by KSS tag selectors
THREE.Object3D.prototype.isNode = true
THREE.Scene.prototype.isScene = true

/**
Expands or contracts along the XR plane by:
- adding top to this.max.y
- adding right to this.max.x
- subbtracting bottom from this.min.y
- subbtracting left from this.min.x
*/
THREE.Box3.prototype.changeXYPlane = function(top, right, bottom, left) {
	this.max.y += top
	this.max.x += right
	this.min.y -= bottom
	this.min.x -= left
}

THREE.Box3.prototype.makeZero = function() {
	this.min.set(0, 0, 0)
	this.max.set(0, 0, 0)
	return this
}

THREE.Box3.prototype.centerAtOrigin = function() {
	this.getCenter(_workingVector3_1)
	_workingVector3_1.negate()
	this.translate(_workingVector3_1)
}

THREE.Box3.prototype.scale = function(vec3) {
	this.min.x *= vec3.x
	this.min.y *= vec3.y
	this.min.z *= vec3.z
	this.max.x *= vec3.x
	this.max.y *= vec3.y
	this.max.z *= vec3.z
}

Object.defineProperty(THREE.Object3D.prototype, 'styles', {
	/**
	Object3D.styles holds the KSS and layout information for an Object3D
	@type {NodeStyles}
	*/
	get: function() {
		if (this._styles === undefined) {
			this._styles = new NodeStyles(this)
		}
		return this._styles
	}
})

/**
Set the styles.hierarchyIsDirty when adding or removing a child
*/
const _oldAdd = THREE.Object3D.prototype.add
THREE.Object3D.prototype.add = function(...objects) {
	let shouldSetDirty = false
	for (let i = 0; i < objects.length; i++) {
		_oldAdd.call(this, objects[i])
		if (objects[i].shadowSOM !== true) {
			shouldSetDirty = true
		}
	}
	if (shouldSetDirty) {
		this.styles.setAncestorsHierarchyDirty()
	}
	return this
}
const _oldRemove = THREE.Object3D.prototype.remove
THREE.Object3D.prototype.remove = function(...objects) {
	for (let i = 0; i < objects.length; i++) {
		_oldRemove.call(this, objects[i])
	}
	this.styles.setAncestorsHierarchyDirty()
	return this
}

/**
Override the Object3D.visible property in order to update styles when it changes
*/
Object.defineProperty(THREE.Object3D.prototype, 'visible', {
	get: function() {
		return this._visible !== false
	},
	set: function(val) {
		if (this._visible === val) return
		this._visible = val
		if (this.shadowSOM !== true) {
			this.styles.setAncestorsHierarchyDirty()
			this.styles.setSubgraphStylesDirty()
		}
	}
})

THREE.Object3D.prototype.toggleClass = function(on, ...classNames) {
	if (on) {
		return this.addClass(...classNames)
	} else {
		return this.removeClass(...classNames)
	}
}

/**
Helper functions to handling classes used by the Stylist
*/
THREE.Object3D.prototype.addClass = function(...classNames) {
	if (this.userData.classes === undefined) {
		this.userData.classes = [...classNames]
		this.styles.setSubgraphStylesDirty()
		return this
	}
	let shouldSetDirty = false
	for (let i = 0; i < classNames.length; i++) {
		if (this.userData.classes.includes(classNames[i])) continue
		this.userData.classes.push(classNames[i])
		shouldSetDirty = true
	}
	if (shouldSetDirty) this.styles.setSubgraphStylesDirty()
	return this
}
THREE.Object3D.prototype.removeClass = function(...classNames) {
	if (this.userData.classes === undefined || this.userData.classes.length === 0) return this
	let shouldSetDirty = false
	for (let i = 0; i < classNames.length; i++) {
		const index = this.userData.classes.indexOf(classNames[i])
		if (index === -1) continue
		this.userData.classes.splice(index, 1)
		shouldSetDirty = true
	}
	if (shouldSetDirty) this.styles.setSubgraphStylesDirty()
	return this
}
THREE.Object3D.prototype.hasClass = function(className) {
	if (this.userData.classes === undefined) return false
	return this.userData.classes.includes(className)
}
THREE.Object3D.prototype.getClasses = function() {
	if (this.userData.classes === undefined) return []
	return this.userData.classes
}

/**
Calls showEdges or hideEdges to toggle the debugging edge boxes
*/
THREE.Object3D.prototype.toggleEdges = function(includingChildren = false) {
	if (this._marginBox) {
		this.hideEdges(includingChildren)
	} else {
		this.showEdges(includingChildren)
	}
	return this
}

/**
If the Object3D has a geometry then show a debugging box around it
*/
THREE.Object3D.prototype.showEdges = function(includingChildren = false) {
	if (this._marginBox === undefined) {
		if (_edgeBoxMaterial === null) {
			_edgeBoxMaterial = new THREE.LineBasicMaterial({
				color: 0x660000,
				linewidth: 200
			})
		}
		if (_edgeBoxGeometry === null) {
			_edgeBoxGeometry = THREE.MakeCubeGeometry(1)
		}
		this._marginBox = new THREE.LineSegments(_edgeBoxGeometry, _edgeBoxMaterial)
		this._marginBox.addClass('margin-box')
		this._marginBox.styles.assignedStyles.set('position', 'absolute')
		this._marginBox.shadowSOM = true
		this.add(this._marginBox)
	}

	this.styles.marginBounds.getSize(_workingVector3_1)
	// Scales can't be zero
	_workingVector3_1.x = Math.max(0.0001, _workingVector3_1.x)
	_workingVector3_1.y = Math.max(0.0001, _workingVector3_1.y)
	_workingVector3_1.z = Math.max(0.0001, _workingVector3_1.z)
	this._marginBox.scale.copy(_workingVector3_1)

	this.styles.marginBounds.getCenter(_workingVector3_2)
	this._marginBox.position.copy(_workingVector3_2)

	if (includingChildren) {
		for (const child of this.children) {
			if (child.visible === false) continue
			if (child.shadowSOM === true) continue
			if (child.hasClass('margin-box')) continue
			child.showEdges(true)
		}
	}
	return this
}

/**
Remove boxes shown by `Object3D.showEdges`
*/
THREE.Object3D.prototype.hideEdges = function(includingChildren = false) {
	if (this._marginBox !== undefined) {
		this.remove(this._marginBox)
		this._marginBox = undefined
	}
	if (includingChildren) {
		for (const child of this.children) {
			if (child.hasClass('margin-box')) continue
			if (child.shadowSOM === true) continue
			child.hideEdges(true)
		}
	}
	return this
}

THREE.Object3D.prototype.findRoot = function(node = this) {
	if (node.parent === null) return node
	return node.findRoot(node.parent)
}

/**
A handy function for depth first traversal of all children and this node
@param {function} func a function of the signature function(Object3D)
*/
THREE.Object3D.prototype.traverseDepthFirst = function(func) {
	_traverseDepthFirst(this, func)
}

const _traverseDepthFirst = function(node, func) {
	for (let i = 0; i < node.children.length; i++) {
		_traverseDepthFirst(node.children[i], func)
	}
	func(node)
}

/**
@param {string} selector - like 'node[name=ModeSwitcherComponent] .button-component > text'
@param {boolean} atMostOne - true if only one result is desired
@return {Object3D[]} nodes that match the selector
*/
THREE.Object3D.prototype.getObjectsBySelector = function(selector, atMostOne = false) {
	const selectorFragmentList = SelectorFragmentList.Parse(selector)
	const results = []
	this.traverse(node => {
		if (node === this) return
		if (node.shadowSOM !== true && selectorFragmentList.matches(node)) {
			results.push(node)
			if (atMostOne) return results
		}
	})
	return results
}

/**
@param {string} selector - like 'node[name=ModeSwitcherComponent] .button-component > text'
@return {Object3D?} the first node to match the selector or null if none were found
*/
THREE.Object3D.prototype.querySelector = function(selector) {
	const results = this.getObjectsBySelector(selector, true)
	if (results.length > 0) return results[0]
	return null
}

/**
@param {Object3D} node
@return {Object3D[]} returns an array of the ancesters of `node`, starting at the root and ending with the `node`
*/
THREE.Object3D.prototype.getAncestry = function(node = this) {
	const lineage = []
	let workingNode = node
	while (workingNode) {
		lineage.push(workingNode)
		workingNode = workingNode.parent
	}
	lineage.reverse()
	return lineage
}

/**
Logs the ancestry of `node` starting with the root and ending with the `node`
@param {Object3D} node
*/
THREE.Object3D.prototype.logAncestry = function(node = this, showVars = false, localsOnly = false) {
	node.getAncestry().forEach(obj => {
		obj
			._getStyleTreeLines(undefined, undefined, undefined, showVars, localsOnly, false)
			.forEach(line => console.log(line))
	})
}

/**
logs to the console the computed styles for a node and its descendents
@param {THREE.Object3D} node
@param {int} [tabDepth=0]
@param {bool} [showVars=false] if true, log the CSS variables of the form `--name`
@param {bool} [localsOnly=false] if true, show the local instead of the computed styles
*/
THREE.Object3D.prototype.logStyles = function(node = this, tabDepth = 0, showVars = false, localsOnly = false) {
	this._getStyleTreeLines(node, [], tabDepth, showVars, localsOnly).forEach(line => console.log(line))
}

/**
@param {THREE.Object3D} node
@param {int} [tabDepth=0]
@param {bool} [showVars=false] if true, log the CSS variables of the form `--name`
@param {bool} [localsOnly=false] if true, show the local instead of the computed styles
@return {string} a string describing the computed styles for a node and its descendents
*/
THREE.Object3D.prototype.getStyleTree = function(node = this, tabDepth = 0, showVars = false, localsOnly = false) {
	return this._getStyleTreeLines(node, [], tabDepth, showVars, localsOnly).join('\n')
}

/**
@param {THREE.Object3D} node
@param {string[]} [results=[]] an accumulator array
@param {int} [tabDepth=0]
@param {bool} [showVars=false] if true, log the CSS variables of the form `--name`
@param {bool} [localsOnly=false] if true, show the local instead of the computed styles
@return {string} a string describing the computed styles for a node and its descendents
*/
THREE.Object3D.prototype._getStyleTreeLines = function(
	node = this,
	results = [],
	tabDepth = 0,
	showVars = false,
	localsOnly = false,
	traverseChildren = true
) {
	const tabs = _generateTabs(tabDepth)
	results.push(
		tabs +
			'> ' +
			(node.name || 'unnamed') +
			(node.type ? `[type=${node.type}] ` : ': ') +
			node
				.getClasses()
				.map(clazz => `.${clazz}`)
				.join('') +
			(node.hierarchyIsDirty ? '\tdirty' : '')
	)
	if (localsOnly) {
		for (const styleInfo of node.styles.localStyles) {
			if (showVars === false && styleInfo.property.startsWith('--')) continue
			reults.push(tabs + '\t' + styleInfo.toString())
		}
	} else {
		for (const styleInfo of node.styles.computedStyles) {
			if (showVars === false && styleInfo.property.startsWith('--')) continue
			results.push(tabs + '\t' + styleInfo.toString())
		}
	}
	if (traverseChildren === false) {
		return results
	}
	for (const child of node.children) {
		if (child.shadowSOM === true) continue
		this._getStyleTreeLines(child, results, tabDepth + 1, showVars, localsOnly)
	}
	return results
}

const _generateTabs = function(depth) {
	if (depth === 0) return ''
	const result = []
	result[depth - 1] = null
	return result.fill('\t').join('')
}

/**
Object3D.attributes is a helper API for accessing attributes on the node or in node.userData
*/
Object.defineProperty(THREE.Object3D.prototype, 'attributes', {
	/**
	@type {Attributes}
	*/
	get: function() {
		if (typeof this._attributes === 'undefined') this._attributes = new Attributes(this)
		return this._attributes
	}
})

/**
Logs to the console info about this node
*/
THREE.Object3D.prototype.prettyPrint = function(depth = 0) {
	let tabs = ''
	for (let i = 0; i < depth; i++) {
		tabs += '  '
	}
	console.log(tabs, (this.name || 'unnamed') + ':')
	console.log(tabs + '\tscale:', ...this.scale.toArray())
	console.log(tabs + '\tposition:', ...this.position.toArray())
	console.log(tabs + '\tquaternion:', ...this.quaternion.toArray())
	for (let i = 0; i < this.children.length; i++) {
		if (this.children[i].shadowSOM === true) continue
		this.children[i].prettyPrint(depth + 1)
	}
}

/**
Looks in this node and up the ancestors until it finds a {Component} attribute
@return {Component|null}
*/
THREE.Object3D.prototype.getComponent = function() {
	let obj = this
	while (true) {
		if (obj.component) return obj.component
		if (!obj.parent) return null
		obj = obj.parent
	}
}

/** A convenience function to allow chaining like `let group = som.group().appendTo(scene)` */
THREE.Object3D.prototype.appendTo = function(parent) {
	parent.add(this)
	return this
}

/** A convenience function to allow appending dictionaries of attributes, arrays of subchildren, or children */
THREE.Object3D.prototype.append = function(child = null) {
	if (child === null) {
		return
	}
	if (typeof child === 'object' && typeof child.matrixWorld === 'undefined') {
		// If it's an object but not an Object3D, consider it a dictionary of attributes
		for (const key in child) {
			if (child.hasOwnProperty(key) == false) continue
			this[key] = child[key]
		}
	} else {
		this.add(child)
	}
	return this
}

THREE.MakeCubeGeometry = function(size) {
	const h = size * 0.5
	const geometry = new THREE.BufferGeometry()
	const position = []
	position.push(
		-h,
		-h,
		-h,
		-h,
		h,
		-h,

		-h,
		h,
		-h,
		h,
		h,
		-h,

		h,
		h,
		-h,
		h,
		-h,
		-h,

		h,
		-h,
		-h,
		-h,
		-h,
		-h,

		-h,
		-h,
		h,
		-h,
		h,
		h,

		-h,
		h,
		h,
		h,
		h,
		h,

		h,
		h,
		h,
		h,
		-h,
		h,

		h,
		-h,
		h,
		-h,
		-h,
		h,

		-h,
		-h,
		-h,
		-h,
		-h,
		h,

		-h,
		h,
		-h,
		-h,
		h,
		h,

		h,
		h,
		-h,
		h,
		h,
		h,

		h,
		-h,
		-h,
		h,
		-h,
		h
	)
	geometry.addAttribute('position', new THREE.Float32BufferAttribute(position, 3))
	return geometry
}

let _edgeBoxMaterial = null
let _edgeBoxGeometry = null

export {}
