import el from "./El.js"

/*
Engine wraps up the THREE.Renderer and manages moving into and out of XRSessions
*/
const Engine = class {
	constructor(scene, camera, mode, tickCallback = null) {
		if (Engine.MODES.indexOf(mode) === -1) {
			throw new Error("Unknown engine mode", mode)
		}
		this._render = this._render.bind(this)
		this._mode = mode
		this._tickCallback = tickCallback
		this._el = el.div({ class: "engine" }) // This will contain a canvas for portal mode
		this._el.addClass(this._mode + "-engine")
		this._scene = scene
		this._camera = camera
		this._camera.name = mode + "-camera"
		this._camera.matrixAutoUpdate = false
		this._scene.add(this._camera)

		this._raycaster = new THREE.Raycaster()
		this._workingQuat = new THREE.Quaternion()

		if (this._mode === Engine.PORTAL) {
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

		// The context and renderer for our 3D scene
		this._glCanvas = null
		this._glContext = null // Will be created during session setup
		this._renderer = null

		this._session = null // An XRSession
		this._eyeLevelFrameOfReference = null
	}
	get el() {
		return this._el
	}
	get scene() {
		return this._scene
	}

	start() {
		return new Promise((resolve, reject) => {
			if (typeof navigator.xr === "undefined") {
				reject("XR is not available, so portal and immersive are not supported")
				return
			}
			navigator.xr
				.requestDevice()
				.then(device => {
					if (this._mode === Engine.PORTAL) {
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
						compatibleXRDevice: device
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

					device
						.requestSession(sessionInitParamers)
						.then(session => {
							this._session = session
							// Set the session's base layer into which the app will render
							this._session.baseLayer = new XRWebGLLayer(this._session, this._glContext)

							if (this._mode === Engine.PORTAL) {
								this._el.appendChild(this._xrCanvas)
							}

							this._session
								.requestFrameOfReference("eyeLevel")
								.then(frameOfReference => {
									this._eyeLevelFrameOfReference = frameOfReference
									this._session.requestAnimationFrame(this._render)
									resolve(this._mode)
								})
								.catch(err => {
									reject(err)
								})
						})
						.catch(err => {
							reject(err)
						})
				})
				.catch(err => {
					reject("Error getting XR displays", err)
					return
				})
		})
	}

	stop() {
		return new Promise((resolve, reject) => {
			if (this._session !== null) {
				this._session.end()
				this._session = null
				if (this._mode === Engine.PORTAL) {
					this._el.removeChild(this._xrCanvas)
				}
			}
			resolve(this._mode)
		})
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

	_render(t, frame) {
		if (this._session === null) {
			return
		}
		this._session.requestAnimationFrame(this._render)

		const pose = frame.getDevicePose(this._eyeLevelFrameOfReference)
		if (!pose) {
			console.log("No pose")
			return
		}

		if (this._tickCallback) {
			this._tickCallback()
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

Engine.PORTAL = "portal"
Engine.IMMERSIVE = "immersive"
Engine.MODES = [Engine.PORTAL, Engine.IMMERSIVE]

export default Engine
