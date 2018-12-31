/**
Functions that generate Spatial Object Model (SOM) elements like som.group(...)
Underlying the SOM is the Three.js scene som 
*/
import AssetLoader from './AssetLoader.js'

import Attributes from './style/Attributes.js'
import { SelectorFragmentList } from './style/Selector.js'

const som = {}
export default som

const assetLoader = AssetLoader.Singleton
const fontLoader = new THREE.FontLoader()
const mtlLoader = new THREE.MTLLoader()
const objLoader = new THREE.OBJLoader()

const _textureLoader = new THREE.TextureLoader()

som.textureLoader = function() {
	return _textureLoader
}

/**
The behind the scene function that generates an enhanced Object3D when you call som.foo(...)
if the first elements in `params` is an array, the values of the array will be passed as separate parameters into the constructor of the instance
*/
som.nodeFunction = function(clazz, ...params) {
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

som.fonts = new Map() // url => THREE.Font

const _shapeCurveSegments = 4

function loadText(resultGroup, text, fontURL, options) {
	text = String(text)
	if (!text || text.trim().length === 0) {
		if (resultGroup.geometry) {
			resultGroup.geometry.dispose()
			resultGroup.geometry = new THREE.ShapeGeometry([], 1)
		}
		return
	}
	if (som.fonts.has(fontURL)) {
		const shapes = som.fonts.get(fontURL).generateShapes(text, options.size)
		if (resultGroup.geometry) resultGroup.geometry.dispose()
		resultGroup.geometry = new THREE.ShapeGeometry(shapes, _shapeCurveSegments)
		resultGroup.styles.geometryIsDirty = true
		resultGroup.styles.setAncestorsLayoutDirty()
	} else {
		assetLoader.get(fontURL).then(blob => {
			if (!blob) {
				console.error('Failed to fetch the font', fontURL)
				return
			}
			const blobURL = URL.createObjectURL(blob)
			fontLoader.load(
				blobURL,
				loadedFont => {
					som.fonts.set(fontURL, loadedFont)
					const shapes = loadedFont.generateShapes(text, options.size)
					if (resultGroup.geometry) resultGroup.geometry.dispose()
					resultGroup.geometry = new THREE.ShapeGeometry(shapes, _shapeCurveSegments)
					resultGroup.styles.geometryIsDirty = true
					resultGroup.styles.setAncestorsLayoutDirty()
					URL.revokeObjectURL(blobURL)
				},
				() => {},
				err => {
					console.error('Could not load font', fontURL, err)
					URL.revokeObjectURL(blobURL)
				}
			)
		})
	}
}

/**
Creates a THREE.Group that manages a chunk of text
*/
som.text = (text = '', options = {}) => {
	options = Object.assign(
		{
			size: 0.12,
			height: 0.05,
			curveSegments: _shapeCurveSegments,
			bevelEnabled: false,
			material: null,
			color: 0x444444,
			fontURL: '/static/potassium-es/fonts/helvetiker_regular.typeface.json'
		},
		options
	)
	if (options.material === null) {
		options.material = new THREE.MeshStandardMaterial({
			color: options.color,
			side: THREE.DoubleSide
		})
	}
	const fontOptions = {
		size: options.size,
		height: options.height,
		curveSegments: options.curveSegments,
		bevelEnabled: options.bevelEnabled
	}

	let currentText = null

	const resultGroup = som.mesh([undefined, options.material])
	resultGroup.name = 'Text'
	resultGroup.addClass('text')
	resultGroup.isText = true

	resultGroup.setFontOptions = newOptions => {
		Object.assign(fontOptions, newOptions)
		resultGroup.setText(currentText, true)
	}

	resultGroup.setText = (newText, force = false) => {
		newText = newText || ''
		if (force === false && newText === currentText) return
		currentText = newText
		loadText(resultGroup, currentText, options.fontURL, fontOptions)
	}

	resultGroup.setText(currentText)
	return resultGroup
}

/**
Creates a THREE.Mesh containing a THREE.BoxBufferGeometry
*/
som.cube = (size = 1, options = {}) => {
	options = Object.assign(
		{
			color: 0x444444
		},
		options
	)
	let material = null
	if (options.material) {
		material = options.material
	} else {
		material = new THREE.MeshStandardMaterial({ color: options.color })
	}
	const result = new THREE.Mesh(THREE.MakeCubeGeometry(size), material)
	// set up for kss element selection, like `cube {}` or `node[name=Cube] {}`
	result.name = 'Cube'
	result.isCube = true
	return result
}

/**
Load an OBJ file
@return {THREE.Group}
*/
som.obj = (objPath, successCallback = null, failureCallback = null) => {
	const group = som.group()
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
The methods created from these info just pass through any params to the class constructor.
For example, creating a MeshBasicMaterial will be som.meshBasicMaterial(...params).
*/
som.SUPPORT_CLASSES = [
	{ class: 'Box3', name: 'box3' },
	{ class: 'Line', name: 'line' },
	{ class: 'Euler', name: 'euler' },
	{ class: 'Matrix4', name: 'matrix4' },
	{ class: 'Vector3', name: 'vector3' },
	{ class: 'Geometry', name: 'geometry' },
	{ class: 'SphereBufferGeometry', name: 'sphereBufferGeometry' },
	{ class: 'MeshBasicMaterial', name: 'meshBasicMaterial' },
	{ class: 'LineBasicMaterial', name: 'lineBasicMaterial' },
	{ class: 'MeshLambertMaterial', name: 'meshLambertMaterial' },
	{ class: 'MeshStandardMaterial', name: 'meshStandardMaterial' }
]
for (const classInfo of som.SUPPORT_CLASSES) {
	const innerClazz = classInfo.class
	som[classInfo.name] = function(...params) {
		return new THREE[innerClazz](...params)
	}
}

/**
The methods created from these classes use the som.nodeFuction (see below)
*/
som.GRAPH_CLASSES = [
	{ class: 'Mesh', name: 'mesh' },
	{ class: 'Scene', name: 'scene' },
	{ class: 'Group', name: 'group' },
	{ class: 'AmbientLight', name: 'ambientLight' },
	{ class: 'HemisphereLight', name: 'hemisphereLight' },
	{ class: 'DirectionalLight', name: 'directionalLight' },
	{ class: 'PerspectiveCamera', name: 'perspectiveCamera' }
]

// This loop generates the element generating functions like som.group(...)
for (const somClassInfo of som.GRAPH_CLASSES) {
	const innerClazz = somClassInfo.class
	som[somClassInfo.name] = function(...params) {
		return som.nodeFunction(innerClazz, ...params)
	}
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
