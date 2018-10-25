/**
Functions that generate Spatial Object Model (SOM) elements like som.group(...)
Underlying the SOM is the Three.js scene som 
*/
import AssetLoader from './AssetLoader.js'
import * as ta from './ThreeAdditions.js'

import Attributes from './style/Attributes.js'
import LocalStyles from './style/LocalStyles.js'
import AssignedStyles from './style/AssignedStyles.js'
import ComputedStyles from './style/ComputedStyles.js'
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

function loadText(resultGroup, text, material, font, options) {
	text = String(text)
	if (!text || text.trim().length === 0) return
	if (som.fonts.has(font)) {
		const shapes = som.fonts.get(font).generateShapes(text, options.size)
		const textGeometry = new THREE.ShapeGeometry(shapes, _shapeCurveSegments)

		const mesh = new THREE.Mesh(textGeometry, material)
		mesh.name = 'TextMesh'
		mesh.addClass('text-mesh')
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
					som.fonts.set(font, loadedFont)
					const shapes = loadedFont.generateShapes(text, options.size)
					const textGeometry = new THREE.ShapeGeometry(shapes, _shapeCurveSegments)
					textGeometry.name = 'TextGeometry'
					const mesh = new THREE.Mesh(textGeometry, material)
					mesh.name = 'TextMesh'
					mesh.addClass('text-mesh')
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
som.text = (text = '', material = null, fontPath = null, options = {}) => {
	const font = fontPath || '/static/potassium-es/fonts/helvetiker_regular.typeface.json'
	options = Object.assign(
		{
			size: 0.25,
			height: 0.05,
			curveSegments: 4,
			bevelEnabled: false
		},
		options || {}
	)

	let currentText = text

	material = material || new THREE.MeshLambertMaterial({ color: 0x999999 })

	const resultGroup = new THREE.Group()
	resultGroup.name = 'Text'
	resultGroup.addClass('text')
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
		textGroup.addClass('sub-text')
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
som.cube = (size = [1, 1, 1], options = {}) => {
	let material = null
	if (options.color) {
		material = new THREE.MeshLambertMaterial({ color: color })
	} else if (options.material) {
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
Load a glTF file
@return {THREE.Group}
*/
som.gltf = path => {
	const group = som.group()
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
For example, creating a MeshBasicMaterial will be som.meshBasicMaterial(...params).
*/
som.SUPPORT_CLASSES = [
	{ class: 'Mesh', name: 'mesh' },
	{ class: 'Line', name: 'line' },
	{ class: 'Euler', name: 'euler' },
	{ class: 'Vector3', name: 'vector3' },
	{ class: 'Geometry', name: 'geometry' },
	{ class: 'SphereBufferGeometry', name: 'sphereBufferGeometry' },
	{ class: 'MeshBasicMaterial', name: 'meshBasicMaterial' },
	{ class: 'LineBasicMaterial', name: 'lineBasicMaterial' },
	{ class: 'MeshLambertMaterial', name: 'meshLambertMaterial' }
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
