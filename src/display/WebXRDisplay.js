import { WebGLRenderer } from 'three/src/Three.js'
import SceneDisplay from './SceneDisplay.js'
import * as displayConstants from './Constants.js'

/**
WebXRDisplay uses the WebXR Device API to render a scene
*/
const WebXRDisplay = class extends SceneDisplay {
	constructor(xrDevice, displayMode, domElement, camera, scene, tickCallback = null) {
		super(displayMode, camera, scene, tickCallback)
		this._render = this._render.bind(this)
		this._xrDevice = xrDevice
		this._dom = domElement

		this._renderer = null
		this._session = null // XRSession
		this._eyeLevelFrameOfReference = null

		this._bodyBackgroundColor = null

		// The context and renderer for our 3D scene
		this._glCanvas = null
		this._glContext = null // Will be created during session setup

		if (this._displayMode === displayConstants.PORTAL) {
			// Create the output context for the composited session render
			this._xrCanvas = dom.canvas({ class: 'xr-canvas' })
			this._xrContext = this._xrCanvas.getContext('xrpresent')
			if (this._xrContext === null) {
				throw new Error('Could not create the XR context')
			}
		} else {
			// immersive mode engines don't use this canvas as the composited results are rendered into the headset
			this._xrCanvas = null
			this._xrContext = null
		}
	}

	get renderer() {
		return this._renderer
	}

	get isStarted() {
		return this._session !== null
	}

	start() {
		return new Promise((resolve, reject) => {
			let sessionInitParamers
			if (this._displayMode === displayConstants.PORTAL) {
				sessionInitParamers = {
					outputContext: this._xrContext
				}
			} else {
				sessionInitParamers = {
					exclusive: true
				}
			}
			if (this._session !== null) {
				this._session.end()
				this._session = null
			}

			this._glCanvas = dom.canvas({ class: 'gl-canvas' })
			this._glContext = this._glCanvas.getContext('webgl', {
				compatibleXRDevice: this._xrDevice
			})
			if (!this._glContext) throw new Error('Could not create a webgl context')

			this._renderer = new WebGLRenderer({
				canvas: this._glCanvas,
				context: this._glContext,
				antialias: false,
				alpha: false
			})
			this._renderer.autoClear = false
			this._renderer.setPixelRatio(1)
			this._renderer.setClearColor('#000', 0)

			this._xrDevice
				.requestSession(sessionInitParamers)
				.then((session) => {
					this._session = session
					// Set the session's base layer into which the app will render
					this._session.baseLayer = new XRWebGLLayer(this._session, this._glContext)

					if (this._displayMode === displayConstants.PORTAL) {
						this._dom.appendChild(this._xrCanvas)
					}

					this._session
						.requestFrameOfReference('eye-level')
						.then((frameOfReference) => {
							this._eyeLevelFrameOfReference = frameOfReference
							this._session.requestAnimationFrame(this._render)
							this._bodyBackgroundColor = document.body.style['background-color']
							document.body.style['background-color'] = 'inherit'
							resolve(this._displayMode)
						})
						.catch((err) => {
							document.body.style['background-color'] = this._bodyBackgroundColor
							reject(err)
						})
				})
				.catch((err) => {
					reject(err)
				})
		})
	}

	stop() {
		return new Promise((resolve, reject) => {
			if (this._session !== null) {
				this._session.end()
				this._session = null
				if (this._displayMode === displayConstants.PORTAL) {
					this._dom.removeChild(this._xrCanvas)
				}
			}
			document.body.style['background-color'] = this._bodyBackgroundColor
			resolve(this._displayMode)
		})
	}

	_render(t, frame) {
		if (this._session === null || !this._session.baseLayer) {
			return
		}
		this._session.requestAnimationFrame(this._render)

		const pose = frame.getDevicePose(this._eyeLevelFrameOfReference)
		if (!pose) {
			console.log('No pose')
			return
		}

		if (this._tickCallback) {
			this._tickCallback()
		}
		if (this._session === null || !this._session.baseLayer) {
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

export default WebXRDisplay
