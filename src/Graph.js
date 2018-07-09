/*
A handy, chain oriented API for creating Three.js scenes
*/
import Engine from "./Engine.js"
import AssetLoader from './AssetLoader.js'

const graph = {}
export default graph

const assetLoader = AssetLoader.Singleton
const fontLoader = new THREE.FontLoader()
const mtlLoader = new THREE.MTLLoader()
const objLoader = new THREE.OBJLoader()

/*
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

	// A convenience function to allow chaining like `let group = graph.group().appendTo(scene)`
	instance.appendTo = function(parent) {
		parent.add(this)
		return this
	}

	// A convenience function to allow appending dictionaries of attributes, arrays of subchildren, or children
	instance.append = function(child = null) {
		if (child === null) {
			return
		}
		if (typeof child === "object" && typeof child.matrixWorld === "undefined") {
			// If it's an object but not an Object3D, consider it a dictionary of attributes
			for (let key in child) {
				if (child.hasOwnProperty(key) == false) continue
				this[key] = child[key]
			}
		} else {
			this.add(child)
		}
		return this
	}

	// Append the children parameters
	for (let i = 0; i < params.length; i++) {
		if (i == 0 && consumedFirstParam) continue
		instance.append(params[i])
	}
	return instance
}

graph.engine = (scene, camera, mode, tickCallback) => {
	return new Engine(scene, camera, mode, tickCallback)
}

graph.fonts = new Map() // url => THREE.Font

function loadText(resultGroup, text, material, font, options) {
	if (graph.fonts.has(font)) {
		const textGeometry = new THREE.TextGeometry(text, Object.assign({ font: graph.fonts.get(font) }, options))
		resultGroup.add(new THREE.Mesh(textGeometry, material))
	} else {
		assetLoader.get(font).then(blob => {
			if(!blob){
				console.error('Failed to fetch the font', font)
				return
			}
			const blobURL = URL.createObjectURL(blob)
			fontLoader.load(
				blobURL,
				loadedFont => {
					graph.fonts.set(font, loadedFont)
					const textGeometry = new THREE.TextGeometry(text, Object.assign({ font: loadedFont }, options))
					resultGroup.add(new THREE.Mesh(textGeometry, material))
					URL.revokeObjectURL(blobURL)
				},
				() => {},
				err => {
					console.error("Could not load font", font, err)
					URL.revokeObjectURL(blobURL)
				}
			)


		})
	}
}

graph.text = (text = "", material = null, fontPath = null, options = {}) => {
	const font = fontPath || "/static/potassium-es/fonts/helvetiker_regular.typeface.json"
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

	material = material || new THREE.MeshLambertMaterial({ color: 0x999999 })

	const resultGroup = new THREE.Group()
	resultGroup.name = "text"

	const textGroup = new THREE.Group()
	resultGroup.add(textGroup)
	loadText(textGroup, text, material, font, options)

	resultGroup.setText = newText => {
		resultGroup.remove(...resultGroup.children)
		const textGroup = new THREE.Group()
		resultGroup.add(textGroup)
		loadText(textGroup, newText, material, font, options)
	}
	return resultGroup
}

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

graph.gltf = path => {
	let group = graph.group()
	loadGLTF(path)
		.then(gltf => {
			group.add(gltf.scene)
		})
		.catch((...params) => {
			console.error("could not load gltf", ...params)
		})
	return group
}

/*
The methods created from these info just pass through any params to the class constructor.
For example, creating a MeshBasicMaterial will be graph.meshBasicMaterial(...params).
*/
graph.SUPPORT_CLASSES = [
	{ class: "Line", name: "line" },
	{ class: "Euler", name: "euler" },
	{ class: "Vector3", name: "vector3" },
	{ class: "Geometry", name: "geometry" },
	{ class: "MeshBasicMaterial", name: "meshBasicMaterial" },
	{ class: "LineBasicMaterial", name: "lineBasicMaterial" },
	{ class: "MeshLambertMaterial", name: "meshLambertMaterial" }
]
for (let classInfo of graph.SUPPORT_CLASSES) {
	const innerClazz = classInfo.class
	graph[classInfo.name] = function(...params) {
		return new THREE[innerClazz](...params)
	}
}

// The methods created from these classes use the graph.nodeFuction (see below)
graph.GRAPH_CLASSES = [
	{ class: "Scene", name: "scene" },
	{ class: "Group", name: "group" },
	{ class: "AmbientLight", name: "ambientLight" },
	{ class: "PerspectiveCamera", name: "perspectiveCamera" },
	{ class: "HemisphereLight", name: "hemisphereLight" },
	{ class: "DirectionalLight", name: "directionalLight" },
	{ class: "AmbientLight", name: "ambientLight" }
]

// This loop generates the element generating functions like graph.group(...)
for (let graphClassInfo of graph.GRAPH_CLASSES) {
	const innerClazz = graphClassInfo.class
	graph[graphClassInfo.name] = function(...params) {
		return graph.nodeFunction(innerClazz, ...params)
	}
}

THREE.Object3D.prototype.prettyPrint = function(depth = 0) {
	let tabs = ""
	for (let i = 0; i < depth; i++) {
		tabs += "  "
	}
	console.log(
		tabs,
		this.name || "-",
		this.position.x,
		this.position.y,
		this.position.z,
		"[",
		this.quaternion.x,
		this.quaternion.y,
		this.quaternion.z,
		this.quaternion.w,
		"]"
	)
	for (let i = 0; i < this.children.length; i++) {
		this.children[i].prettyPrint(depth + 1)
	}
}

THREE.Object3D.prototype.getComponent = function() {
	let obj = this
	while (true) {
		if (obj.component) return obj.component
		if (!obj.parent) return null
		obj = obj.parent
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
			resolve(gltf)
		})
	})
}

function loadObj(objPath) {
	const objName = objPath.split("/")[objPath.split("/").length - 1]
	const baseURL = objPath.substring(0, objPath.length - objName.length)
	const mtlName = objName.split(".")[objName.split(":").length - 1] + ".mtl"
	const mtlPath = baseURL + mtlName

	return new Promise((resolve, reject) => {
		assetLoader.get(mtlPath).then(mtlBlob => {
			if(mtlBlob === null){
				reject(`Could not load ${mtlPath}`)
				return
			}

			assetLoader.get(objPath).then(objBlob => {
				if(objBlob === null) {
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
								resolve(obj)
							},
							() => {},
							(...params) => {
								console.error("Failed to load obj", ...params)
								reject(...params)
								URL.revokeObjectURL(objURL)
							}
						)
						URL.revokeObjectURL(mtlURL)
					},
					() => {},
					(...params) => {
						console.error("Failed to load mtl", ...params)
						reject(...params)
						URL.revokeObjectURL(mtlURL)
					}
				)
			})
		})
	})
}
