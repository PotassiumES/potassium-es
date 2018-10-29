import Attributes from './style/Attributes.js'
import LocalStyles from './style/LocalStyles.js'
import AssignedStyles from './style/AssignedStyles.js'
import ComputedStyles from './style/ComputedStyles.js'

/**
importing this extends THREE.Object3D with many methods and attributes useful for creating and manipulating the SOM
*/

// Used by KSS tag selectors
THREE.Object3D.prototype.isNode = true
THREE.Scene.prototype.isScene = true

/**
Helper functions to handling classes used by the Stylist
*/
THREE.Object3D.prototype.addClass = function(...classNames) {
	if (typeof this.userData.classes === 'undefined') {
		this.userData.classes = [...classNames]
		return
	}
	for (const className of classNames) {
		if (this.userData.classes.includes(className)) continue
		this.userData.classes.push(className)
	}
}
THREE.Object3D.prototype.removeClass = function(...classNames) {
	if (typeof this.userData.classes === 'undefined' || this.userData.classes.length === 0) return
	for (const className of classNames) {
		const index = this.userData.classes.indexOf(className)
		if (index === -1) continue
		this.userData.classes.splice(index, 1)
	}
}
THREE.Object3D.prototype.hasClass = function(className) {
	if (typeof this.userData.classes === 'undefined') return false
	return this.userData.classes.includes(className)
}
THREE.Object3D.prototype.getClasses = function() {
	if (!this.userData.classes || this.userData.classes.length === 0) return []
	return this.userData.classes
}

/**
A handy function for depth first traversal of all children and this node
@param {function} func a function of the signature function(Object3D)
*/
THREE.Object3D.prototype.traverseDepthFirst = function(func) {
	_traverseDepthFirst(this, func)
}

const _traverseDepthFirst = function(node, func) {
	for (const child of node.children) {
		_traverseDepthFirst(child, func)
	}
	func(node)
}

/**
Used to determine when to trigger re-layout via styles
*/
THREE.Object3D.prototype.layoutIsDirty = false

/**
Sets this node layoutIsDirty to true and if it has a parent it calls parent.setLayoutDirty() (which calls its parent, etc)
*/
THREE.Object3D.prototype.setLayoutDirty = function() {
	this.layoutIsDirty = true
	if (this.parent && this.parent.layoutIsDirty === false) this.parent.setLayoutDirty()
}

/**
Set the layout dirty when adding or removing a child
*/
const _oldAdd = THREE.Object3D.prototype.add
THREE.Object3D.prototype.add = function(object) {
	_oldAdd.call(this, object)
	object.setLayoutDirty()
	return this
}
const _oldRemove = THREE.Object3D.prototype.remove
THREE.Object3D.prototype.remove = function(object) {
	_oldRemove.call(this, object)
	this.setLayoutDirty()
	return this
}

/**
@param {string} selector like 'node[name=ModeSwitcherComponent] .button-component > text'
@return {Array<Object3D>} nodes that match the selector
*/
THREE.Object3D.prototype.getObjectsBySelector = function(selector) {
	const selectorFragmentList = SelectorFragmentList.Parse(selector)
	const results = []
	this.traverse(node => {
		if (node === this) return
		if (selectorFragmentList.matches(node)) {
			results.push(node)
		}
	})
	return results
}

/**
@param {string} selector like 'node[name=ModeSwitcherComponent] .button-component > text'
@return {Object3D?} the first node to match the selector or null if none were found
*/
THREE.Object3D.prototype.querySelector = function(selector) {
	const results = THREE.Object3D.prototype.getObjectsBySelector(selector)
	if (results.length > 0) return results[0]
	return null
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

THREE.Object3D.prototype.getStyleTree = function(node = this, tabDepth = 0, showVars = false, localsOnly = false) {
	return this._getStyleTreeLines(node, [], tabDepth, showVars, localsOnly).join('\n')
}

THREE.Object3D.prototype._getStyleTreeLines = function(
	node = this,
	results = [],
	tabDepth = 0,
	showVars = false,
	localsOnly = false
) {
	const tabs = _generateTabs(tabDepth)
	results.push(
		tabs +
			'> ' +
			(node.name || 'unnamed') +
			': ' +
			node
				.getClasses()
				.map(clazz => `.${clazz}`)
				.join('') +
			(node.layoutIsDirty ? '\tdirty' : '')
	)
	if (localsOnly) {
		for (const styleInfo of node.localStyles) {
			if (showVars === false && styleInfo.property.startsWith('--')) continue
			reults.push(
				tabs + '\t' + styleInfo.property + ': ' + styleInfo.value + (styleInfo.important ? ' !important' : '')
			)
		}
	} else {
		for (const styleInfo of node.computedStyles) {
			if (showVars === false && styleInfo.property.startsWith('--')) continue
			results.push(
				tabs + '\t' + styleInfo.property + ': ' + styleInfo.value + (styleInfo.important ? ' !important' : '')
			)
		}
	}
	for (const child of node.children) {
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
Object3D.matchingRules is used by the Stylist to track rules with selectors that match this node
*/
Object.defineProperty(THREE.Object3D.prototype, 'matchingRules', {
	/** @type {Array[{
		rule: { selectors, declarations },
		stylesheet: Stylesheet,
		selector: SelectorFragmentList
	}]} */
	get: function() {
		if (typeof this._matchingRules === 'undefined') this._matchingRules = []
		return this._matchingRules
	}
})

/**
Object3D.localStyles holds the individual styles that were assigned to this node
You should use Object3D.computedStyles to see the final values after inheriting values via the cascade
*/
Object.defineProperty(THREE.Object3D.prototype, 'localStyles', {
	/**
	@type {LocalStyles}
	*/
	get: function() {
		if (typeof this._localStyles === 'undefined') this._localStyles = new LocalStyles()
		return this._localStyles
	}
})

/**
Object3D.computedStyles holds the final computed styles that apply to this node
*/
Object.defineProperty(THREE.Object3D.prototype, 'computedStyles', {
	/**
	@type {ComputedStyles}
	*/
	get: function() {
		if (typeof this._computedStyles === 'undefined') this._computedStyles = new ComputedStyles()
		return this._computedStyles
	}
})

/**
Object3D.assignedStyles holds the styles that are programmatically (not via KSS) assigned to a node
*/
Object.defineProperty(THREE.Object3D.prototype, 'assignedStyles', {
	/**
	@type {AssignedStyles}
	*/
	get: function() {
		if (typeof this._assignedStyles === 'undefined') this._assignedStyles = new AssignedStyles(this)
		return this._assignedStyles
	}
})

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

export {}
