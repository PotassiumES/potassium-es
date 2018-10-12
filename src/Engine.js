import el from './El.js'
import graph from './Graph.js'
import EventHandler from './EventHandler.js'
import {throttledConsoleLog} from './throttle.js'

const defaultBackgroundColor = new THREE.Color(0x99DDff)

/**
Engine wraps up the THREE.Renderer and manages moving into and out of WebXR or WebVR Sessions
*/
const Engine = class extends EventHandler {
	/**
	@param {THREE.Scene} scene
	@param {string} mode Engine.PORTAL or Engine.IMMERSIVE
	@param {function} [tickCallback=null] this is called while rendering each frame 
	*/
	constructor(scene, mode, tickCallback=null) {
		if (Engine.DISPLAY_MODES.indexOf(mode) === -1) {
			throw new Error("Unknown engine mode", mode)
		}
		super()
		this._scene = scene
		this._displayMode = mode
		this._tickCallback = tickCallback

		this._el = el.div({ class: "engine" }) // This will contain a canvas for portal mode
		this._el.addClass(this._displayMode + "-engine")

		this._camera = graph.perspectiveCamera([45, 1, 0.5, 10000])
		this._camera.name = mode + "-camera"
		this._camera.matrixAutoUpdate = false

		this._raycaster = new THREE.Raycaster()
		this._workingQuat = new THREE.Quaternion()

		this._sceneDisplay = null 
	}

	get hasDisplay(){ return this._sceneDisplay !== null }

	get sceneDisplay(){ return this._sceneDisplay }

	set sceneDisplay(sceneDisplay){ this._sceneDisplay = sceneDisplay }

	get el() {
		return this._el
	}

	get scene() {
		return this._scene
	}

	get camera() {
		return this._camera
	}

	get tickCallback(){
		return this._tickCallback
	}

	start(){
		if(this._sceneDisplay === null) return Promise.reject()
		return this._sceneDisplay.start()
	}

	stop(){
		if(this._sceneDisplay === null) return Promise.resolve()
		return this._sceneDisplay.stop()
	}

	pickScreen(normalizedMouseX, normalizedMouseY) {
		this._raycaster.setFromCamera(
			{
				x: normalizedMouseX,
				y: normalizedMouseY
			},
			this._camera
		)
		const intersects = this._raycaster.intersectObjects(this._scene.children, true)
		if (intersects.length === 0) return null
		return intersects[0]
	}

	pickPose(pointObject3D) {
		this._raycaster.ray.origin.setFromMatrixPosition(pointObject3D.matrixWorld)
		pointObject3D.getWorldQuaternion(this._workingQuat)
		this._raycaster.ray.direction.set(0, 0, -1).applyQuaternion(this._workingQuat)
		this._raycaster.ray.direction.normalize()
		const intersects = this._raycaster.intersectObjects(this._scene.children, true)
		if (intersects.length === 0) return null
		return intersects[0]
	}

	/**
	Determines the available display APIs (WebXR or WebVR) and uses that info to set up an appropriate SceneDisplay for each Engine
	@param {Engine} portalEngine
	@param {Engine} immersiveEngine
	*/
	static async chooseDisplays(portalEngine, immersiveEngine){		
		// If WebXR is present
		if(navigator.xr && typeof navigator.xr.requestDevice === 'function'){
			try {
				const xrDevice = await navigator.xr.requestDevice()
				// If WebXR can do exclusive AR sessions
				try {
					const xrContext = el.canvas().getContext("xrpresent")
					if(!xrContext){
						throw new Error('Could not create an xr context')						
					}
					await xrDevice.supportsSession({
						outputContext: xrContext
					})
					// set portal engine display to WebXR
					portalEngine.sceneDisplay = new WebXRDisplay(xrDevice, Engine.PORTAL, portalEngine.el, portalEngine.camera, portalEngine.scene, portalEngine.tickCallback)
				} catch(err){
					// Portal mode not available via WebXR
				}

				//If WebXR can do exclusive VR sessions
				try {
					await xrDevice.supportsSession({
						immersive: true
					})
					// set immersive engine to WebXR mode
					immersiveEngine.sceneDisplay = new WebXRDisplay(xrDevice, Engine.PORTAL, portalEngine.el, portalEngine.camera, portalEngine.scene, portalEngine.tickCallback)
				} catch (err){
					// Immersive mode not available via WebXR
				}
			} catch(err) {
				// No available WebXR device
			}
		}

		// If the immersive engine does not have a display and WebVR is present
		if(immersiveEngine.hasDisplay === false && typeof navigator.getVRDisplays === 'function'){
			let displays = await navigator.getVRDisplays()
			// If there is a WebVR device
			displays = displays.filter(display => display.capabilities.canPresent)
			if(displays.length > 0){
				// set immersive engine display to use WebVR
				immersiveEngine.sceneDisplay = new WebVRDisplay(displays[0], immersiveEngine.camera, immersiveEngine.scene, immersiveEngine.tickCallback)
				immersiveEngine.sceneDisplay.addListener((eventName, isPresenting) => {
					immersiveEngine.trigger(isPresenting ? Engine.STARTED : Engine.STOPPED, immersiveEngine)
				})
			}
		}

		// If immersive engine has no display by this point then it can't be used

		// If portal engine does not have a display, use the fallback display
		/*
		if(portalEngine.hasDisplay === false){
			portalEngine.sceneDisplay = new FallbackPortalDisplay(portalEngine.camera, portalEngine.scene, portalEngine.tickCallback)
		}
		*/
	}
}

Engine.PORTAL = "portal"
Engine.IMMERSIVE = "immersive"
Engine.DISPLAY_MODES = [Engine.PORTAL, Engine.IMMERSIVE]

Engine.OPAQUE = "opaque"
Engine.ADDITIVE = "additive"
Engine.ALPHA_BLEND = "alpha-blend"
Engine.BLEND_MODES = [Engine.OPAQUE, Engine.ADDITIVE, Engine.ALPHA_BLEND]

Engine.STARTED = 'engine-started'
Engine.STOPPED = 'engine-stopped'
Engine.EVENTS = [Engine.STARTED, Engine.STOPPED]

export default Engine

/**
SceneDisplay is an abstract base class used by Engine to render a 3D scene
See {@link WebVRDisplay} for {@link WebXRDisplay} ancestor classes that use different APIs (WebVR and WebXR Device API)
*/
const SceneDisplay = class extends EventHandler {
	/**
	@param {string} displayMode one of Engine.DISPLAY_MODES
	@param {THREE.Camera} camera
	@param {THREE.Scene} scene
	@param {function} tickCallback
	*/
	constructor(displayMode, camera, scene, tickCallback=null){
		if (Engine.DISPLAY_MODES.indexOf(displayMode) === -1) {
			throw new Error("Unknown display mode", displayMode)
		}
		super()
		this._displayMode = displayMode
		this._camera = camera
		this._scene = scene
		this._tickCallback = tickCallback
	}

	get blendMode(){
		throw new Error('Not implemented')
	}

	get isStarted(){
		throw new Error('Not implemented')
	}

	start(){
		throw new Error('Not implemented')
	}

	stop(){
		throw new Error('Not implemented')
	}
}

/**
WebVRDisplay uses WebVR 1.1 to render a scene
*/
const WebVRDisplay = class extends SceneDisplay {
	constructor(vrDisplay, camera, scene, tickCallback){
		super(Engine.IMMERSIVE, camera, scene, tickCallback)
		this._render = this._render.bind(this)
		this._vrDisplay = vrDisplay

		// Render size
		this._width = 1
		this._height = 1

		this._isStarted = false
		this._vrFrameData = new VRFrameData()

		this._scene.matrixAutoUpdate = false

		this._clock = new THREE.Clock()
		this._delta = this._clock.getDelta()

		this._renderer = new THREE.WebGLRenderer({
			antialias: true
		})
		this._renderer.domElement.setAttribute('class', 'webvr-display')
		//this._renderer.domElement.style.display = 'none'
		this._renderer.setClearColor(defaultBackgroundColor)
		this._renderer.autoClear = false
		this._renderer.shadowMap.enabled = true
		this._renderer.shadowMap.type = THREE.PCFShadowMap
		this._updateSize()

		window.addEventListener('vrdisplaypresentchange', ev => {
			if(this._vrDisplay === null) return
			this.trigger('vr-display-change', this._vrDisplay.isPresenting)
			if(this._vrDisplay.isPresenting === false){
				document.body.removeChild(this._renderer.domElement)
			}
		})
	}

	get blendMode(){ return Engine.OPAQUE }

	get isStarted(){ return this._isStarted }

	start(){
		if(this._isStarted) return Promise.reject('Already started')			
		this._isStarted = true
		return new Promise((resolve, reject) => {
			document.body.appendChild(this._renderer.domElement)
			this._vrDisplay.requestPresent([{
				source: this._renderer.domElement
			}]).then(() => {
				this._updateSize()
				this._vrDisplay.requestAnimationFrame(this._render)
				resolve()
			}).catch(err => {
				this._isStarted = false
				document.body.removeChild(this._renderer.domElement)
				console.error('Error starting WebVR', err)
				reject(err)
			})
		})
	}

	stop(){
		if(this._isStarted === false) return Promise.resolve()
		this._isStarted = false
		if(this._vrDisplay.isPresenting === false) return Promise.resolve()
		return this._vrDisplay.exitPresent()
	}

	_render(){
		if(this._vrDisplay === null) return
		if(this._vrDisplay.isPresenting === false) return
		this._vrDisplay.requestAnimationFrame(this._render)

		this._delta = this._clock.getDelta()
		this._vrDisplay.getFrameData(this._vrFrameData)
		if (this._tickCallback) {
			this._tickCallback()
		}

		// The view is assumed to be full-window in VR because the canvas element fills the entire HMD screen[s]
		this._renderer.clear()
		this._renderer.setViewport(0, 0, this._width * 0.5, this._height)

		// Render left eye
		this._camera.projectionMatrix.fromArray(this._vrFrameData.leftProjectionMatrix)
		this._scene.matrix.fromArray(this._vrFrameData.leftViewMatrix)
		this._scene.updateMatrixWorld(true)
		this._renderer.render(this._scene, this._camera)

		// Prep for right eye
		this._renderer.clearDepth()
		this._renderer.setViewport(this._width * 0.5, 0, this._width * 0.5, this._height)

		// Render right eye
		this._camera.projectionMatrix.fromArray(this._vrFrameData.rightProjectionMatrix)
		this._scene.matrix.fromArray(this._vrFrameData.rightViewMatrix)
		this._scene.updateMatrixWorld(true)
		this._renderer.render(this._scene, this._camera)

		this._vrDisplay.submitFrame()
	}

	_updateSize(){
		if(!this._vrDisplay) return
		const eyeParams = this._vrDisplay.getEyeParameters('left')
		this._width = eyeParams.renderWidth * 2
		this._height = eyeParams.renderHeight
		this._renderer.setPixelRatio(1)
		this._camera.aspect = this._width / this._height
		this._camera.updateProjectionMatrix()
		this._renderer.setSize(this._width, this._height, false)
	}
}

/**
WebXRDisplay uses the WebXR Device API to render a scene
*/
const WebXRDisplay = class extends SceneDisplay {
	constructor(xrDevice, displayMode, domEl, camera, scene, tickCallback = null){
		super(displayMode, camera, scene, tickCallback)
		this._render = this._render.bind(this)
		this._xrDevice = xrDevice
		this._el = domEl

		this._session = null // XRSession
		this._eyeLevelFrameOfReference = null

		this._bodyBackgroundColor = null

		// The context and renderer for our 3D scene
		this._glCanvas = null
		this._glContext = null // Will be created during session setup

		if (this._displayMode === Engine.PORTAL) {
			// Create the output context for the composited session render
			this._xrCanvas = el.canvas({ class: "xr-canvas" })
			this._xrContext = this._xrCanvas.getContext("xrpresent")
			if (this._xrContext === null) {
				throw new Error("Could not create the XR context")
			}
		} else {
			// immersive mode engines don't use this canvas as the composited results are rendered into the headset
			this._xrCanvas = null
			this._xrContext = null
		}		
	}

	get isStarted(){
		return this._session !== null
	}

	start() {
		return new Promise((resolve, reject) => {
			if (this._displayMode === Engine.PORTAL) {
				var sessionInitParamers = {
					outputContext: this._xrContext
				}
			} else {
				var sessionInitParamers = {
					exclusive: true
				}
			}
			if (this._session !== null) {
				this._session.end()
				this._session = null
			}

			this._glCanvas = el.canvas({ class: "gl-canvas" })
			this._glContext = this._glCanvas.getContext("webgl", {
				compatibleXRDevice: this._xrDevice
			})
			if (!this._glContext) throw new Error("Could not create a webgl context")

			this._renderer = new THREE.WebGLRenderer({
				canvas: this._glCanvas,
				context: this._glContext,
				antialias: false,
				alpha: false
			})
			this._renderer.autoClear = false
			this._renderer.setPixelRatio(1)
			this._renderer.setClearColor("#000", 0)

			this._xrDevice
				.requestSession(sessionInitParamers)
				.then(session => {
					this._session = session
					// Set the session's base layer into which the app will render
					this._session.baseLayer = new XRWebGLLayer(this._session, this._glContext)

					if (this._displayMode === Engine.PORTAL) {
						this._el.appendChild(this._xrCanvas)
					}

					this._session
						.requestFrameOfReference("eye-level")
						.then(frameOfReference => {
							this._eyeLevelFrameOfReference = frameOfReference
							this._session.requestAnimationFrame(this._render)
							this._bodyBackgroundColor = document.body.style['background-color']
							document.body.style['background-color'] = 'inherit'
							resolve(this._displayMode)
						})
						.catch(err => {
							document.body.style['background-color'] = this._bodyBackgroundColor
							reject(err)
						})
				})
				.catch(err => {
					reject(err)
				})
		})
	}

	stop() {
		return new Promise((resolve, reject) => {
			if (this._session !== null) {
				this._session.end()
				this._session = null
				if (this._displayMode === Engine.PORTAL) {
					this._el.removeChild(this._xrCanvas)
				}
			}
			document.body.style['background-color'] = this._bodyBackgroundColor
			resolve(this._displayMode)
		})
	}

	_render(t, frame) {
		if(this._session === null || !this._session.baseLayer){
			return
		}
		this._session.requestAnimationFrame(this._render)

		const pose = frame.getDevicePose(this._eyeLevelFrameOfReference)
		if (!pose) {
			console.log("No pose")
			return
		}

		if(this._tickCallback) {
			this._tickCallback()
		}
		if(this._session === null || !this._session.baseLayer){
			return
		}
	
		this._renderer.setSize(this._session.baseLayer.framebufferWidth, this._session.baseLayer.framebufferHeight, false)
		this._renderer.clear()

		// Render each view into this._session.baseLayer.context
		for (const view of frame.views) {
			// Each XRView has its own projection matrix, so set the camera to use that
			this._camera.matrix.fromArray(pose.getViewMatrix(view))
			this._camera.updateMatrixWorld()
			this._camera.projectionMatrix.fromArray(view.projectionMatrix)

			// Set up the renderer to the XRView's viewport and then render
			this._renderer.clearDepth()
			const viewport = this._session.baseLayer.getViewport(view)
			this._renderer.setViewport(viewport.x, viewport.y, viewport.width, viewport.height)
			this._renderer.render(this._scene, this._camera)
		}
	}
}

/**
FallbackPortalDisplay is used on handsets when WebXR and WebVR are not present
*/
const FallbackPortalDisplay = class extends SceneDisplay {
	constructor(camera, scene, tickCallback){
		super(Engine.PORTAL, camera, scene, tickCallback)
	}

	stop(){}
}
