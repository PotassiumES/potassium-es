/**
A handy, chain oriented API for creating Three.js scenes
*/
import AssetLoader from './AssetLoader.js'
import Attributes from './style/Attributes.js'
import { SelectorFragmentList } from './style/Selector.js'
import LocalStyles from './style/LocalStyles.js'
import AssignedStyles from './style/AssignedStyles.js'
import ComputedStyles from './style/ComputedStyles.js'

const graph = {}
export default graph

const assetLoader = AssetLoader.Singleton
const fontLoader = new THREE.FontLoader()
const mtlLoader = new THREE.MTLLoader()
const objLoader = new THREE.OBJLoader()

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
logs to the console the computed styles for a node and its descendents
@param {THREE.Object3D} node
@param {int} [tabDepth=0]
@param {bool} [showVars=false] if true, log the CSS variables of the form `--name`
@param {bool} [localsOnly=false] if true, show the local instead of the computed styles
*/
THREE.Object3D.prototype.logStyles = function(node = this, tabDepth = 0, showVars = false, localsOnly = false) {
	const tabs = _generateTabs(tabDepth)
	console.log(
		tabs + '>',
		(node.name || 'unnamed') + ':',
		node
			.getClasses()
			.map(clazz => `.${clazz}`)
			.join(''),
		node.layoutIsDirty ? '\tdirty' : ''
	)
	if (localsOnly) {
		for (const styleInfo of node.localStyles) {
			if (showVars === false && styleInfo.property.startsWith('--')) continue
			console.log(tabs + '\t' + styleInfo.property + ':', styleInfo.value, styleInfo.important ? '!important' : '')
		}
	} else {
		for (const styleInfo of node.computedStyles) {
			if (showVars === false && styleInfo.property.startsWith('--')) continue
			console.log(tabs + '\t' + styleInfo.property + ':', styleInfo.value, styleInfo.important ? '!important' : '')
		}
	}
	for (const child of node.children) this.logStyles(child, tabDepth + 1, showVars, localsOnly)
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
	console.log(tabs, this.name + ':' || 'unnamed:')
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

/** A convenience function to allow chaining like `let group = graph.group().appendTo(scene)` */
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

/**
The behind the scene function that generates an enhanced Object3D when you call graph.foo(...)
if the first elements in `params` is an array, the values of the array will be passed as separate parameters into the constructor of the instance
*/
graph.nodeFunction = function(clazz, ...params) {
	let instance = null
	let consumedFirstParam = false
	if (Array.isArray(params[0])) {
		consumedFirstParam = true
		instance = new THREE[clazz](...params[0])
	} else {
		instance = new THREE[clazz]()
	}

	// Append the children parameters
	for (let i = 0; i < params.length; i++) {
		if (i == 0 && consumedFirstParam) continue
		instance.append(params[i])
	}
	return instance
}

graph.fonts = new Map() // url => THREE.Font

function loadText(resultGroup, text, material, font, options) {
	if (graph.fonts.has(font)) {
		const textGeometry = new THREE.TextGeometry(text, Object.assign({ font: graph.fonts.get(font) }, options))
		textGeometry.name = 'TextGeometry'
		const mesh = new THREE.Mesh(textGeometry, material)
		mesh.name = 'TextMesh'
		resultGroup.add(mesh)
	} else {
		assetLoader.get(font).then(blob => {
			if (!blob) {
				console.error('Failed to fetch the font', font)
				return
			}
			const blobURL = URL.createObjectURL(blob)
			fontLoader.load(
				blobURL,
				loadedFont => {
					graph.fonts.set(font, loadedFont)
					const textGeometry = new THREE.TextGeometry(text, Object.assign({ font: loadedFont }, options))
					textGeometry.name = 'TextGeometry'
					const mesh = new THREE.Mesh(textGeometry, material)
					mesh.name = 'TextMesh'
					resultGroup.add(mesh)
					URL.revokeObjectURL(blobURL)
				},
				() => {},
				err => {
					console.error('Could not load font', font, err)
					URL.revokeObjectURL(blobURL)
				}
			)
		})
	}
}

/**
Creates a THREE.Group that manages a chunk of text
*/
graph.text = (text = '', material = null, fontPath = null, options = {}) => {
	const font = fontPath || '/static/potassium-es/fonts/helvetiker_regular.typeface.json'
	options = Object.assign(
		{
			size: 0.25,
			height: 0.05,
			curveSegments: 4,
			bevelEnabled: false,
			bevelThickness: 1,
			bevelSize: 0.8,
			bevelSegments: 5
		},
		options || {}
	)

	let currentText = text

	material = material || new THREE.MeshLambertMaterial({ color: 0x999999 })

	const resultGroup = new THREE.Group()
	resultGroup.name = 'Text'
	resultGroup.isText = true

	resultGroup.setRGB = (red, green, blue) => {
		if (
			!resultGroup.children[0] ||
			!resultGroup.children[0].children[0] ||
			!resultGroup.children[0].children[0].material
		)
			return
		if (resultGroup.children[0].children[0].material.emissive) {
			resultGroup.children[0].children[0].material.emissive.setRGB(red, green, blue)
		} else {
			resultGroup.children[0].children[0].material.color.setRGB(red, green, blue)
		}
	}

	resultGroup.setFontOptions = newOptions => {
		Object.assign(options, newOptions)
		resultGroup.setText(currentText)
	}

	resultGroup.setText = newText => {
		resultGroup.remove(...resultGroup.children)
		const textGroup = new THREE.Group()
		textGroup.name = 'SubText'
		resultGroup.add(textGroup)
		currentText = newText
		loadText(textGroup, currentText, material, font, options)
	}

	resultGroup.setText(currentText)
	return resultGroup
}

/**
Creates a THREE.Mesh containing a THREE.BoxBufferGeometry
*/
graph.cube = (size=[1,1,1], options={}) => {
	let material = null
	if(options.color){
		material = new THREE.MeshLambertMaterial({ color: color })
	} else if(options.material){
		material = options.material
	}
	const result = new THREE.Mesh(new THREE.BoxBufferGeometry(...size), material)
	// set up for kss element selection, like `cube {}` or `node[name=Cube] {}`
	result.name = 'Cube'
	result.isCube = true
	return result
}

/**
Load an OBJ file
@return {THREE.Group}
*/
graph.obj = (objPath, successCallback = null, failureCallback = null) => {
	const group = graph.group()
	loadObj(objPath)
		.then(obj => {
			group.add(obj)
			if (successCallback !== null) successCallback(group, obj)
		})
		.catch((...params) => {
			if (failureCallback !== null) failureCallback(group, ...params)
		})
	return group
}

/**
Load a glTF file
@return {THREE.Group}
*/
graph.gltf = path => {
	const group = graph.group()
	loadGLTF(path)
		.then(gltf => {
			group.add(gltf.scene)
		})
		.catch((...params) => {
			console.error('could not load gltf', ...params)
		})
	return group
}

/**
The methods created from these info just pass through any params to the class constructor.
For example, creating a MeshBasicMaterial will be graph.meshBasicMaterial(...params).
*/
graph.SUPPORT_CLASSES = [
	{ class: 'Line', name: 'line' },
	{ class: 'Euler', name: 'euler' },
	{ class: 'Vector3', name: 'vector3' },
	{ class: 'Geometry', name: 'geometry' },
	{ class: 'MeshBasicMaterial', name: 'meshBasicMaterial' },
	{ class: 'LineBasicMaterial', name: 'lineBasicMaterial' },
	{ class: 'MeshLambertMaterial', name: 'meshLambertMaterial' }
]
for (const classInfo of graph.SUPPORT_CLASSES) {
	const innerClazz = classInfo.class
	graph[classInfo.name] = function(...params) {
		return new THREE[innerClazz](...params)
	}
}

/**
The methods created from these classes use the graph.nodeFuction (see below)
*/
graph.GRAPH_CLASSES = [
	{ class: 'Scene', name: 'scene' },
	{ class: 'Group', name: 'group' },
	{ class: 'AmbientLight', name: 'ambientLight' },
	{ class: 'PerspectiveCamera', name: 'perspectiveCamera' },
	{ class: 'HemisphereLight', name: 'hemisphereLight' },
	{ class: 'DirectionalLight', name: 'directionalLight' },
	{ class: 'AmbientLight', name: 'ambientLight' }
]

// This loop generates the element generating functions like graph.group(...)
for (const graphClassInfo of graph.GRAPH_CLASSES) {
	const innerClazz = graphClassInfo.class
	graph[graphClassInfo.name] = function(...params) {
		return graph.nodeFunction(innerClazz, ...params)
	}
}

function loadGLTF(url) {
	return new Promise((resolve, reject) => {
		const loader = new THREE.GLTFLoader()
		loader.load(url, gltf => {
			if (gltf === null) {
				reject()
			}
			/*
			if(gltf.animations && gltf.animations.length){
				let mixer = new THREE.AnimationMixer(gltf.scene)
				for(let animation of gltf.animations){
					mixer.clipAction(animation).play()
				}
			}
			*/
			gltf.name = 'GLTF'
			resolve(gltf)
		})
	})
}

function loadObj(objPath) {
	const objName = objPath.split('/')[objPath.split('/').length - 1]
	const baseURL = objPath.substring(0, objPath.length - objName.length)
	const mtlName = objName.split('.')[objName.split(':').length - 1] + '.mtl'
	const mtlPath = baseURL + mtlName

	return new Promise((resolve, reject) => {
		assetLoader.get(mtlPath).then(mtlBlob => {
			if (mtlBlob === null) {
				reject(`Could not load ${mtlPath}`)
				return
			}

			assetLoader.get(objPath).then(objBlob => {
				if (objBlob === null) {
					reject(`Could not load ${objPath}`)
					return
				}

				const objURL = URL.createObjectURL(objBlob)
				const mtlURL = URL.createObjectURL(mtlBlob)

				mtlLoader.setTexturePath(baseURL)
				mtlLoader.load(
					mtlURL,
					materials => {
						materials.preload()
						objLoader.setMaterials(materials)
						objLoader.load(
							objURL,
							obj => {
								URL.revokeObjectURL(objURL)
								obj.name = 'OBJ'
								resolve(obj)
							},
							() => {},
							(...params) => {
								console.error('Failed to load obj', ...params)
								reject(...params)
								URL.revokeObjectURL(objURL)
							}
						)
						URL.revokeObjectURL(mtlURL)
					},
					() => {},
					(...params) => {
						console.error('Failed to load mtl', ...params)
						reject(...params)
						URL.revokeObjectURL(mtlURL)
					}
				)
			})
		})
	})
}
