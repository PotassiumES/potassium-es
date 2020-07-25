import { WebGLRenderer } from 'three/src/Three.js'
import SceneDisplay from './SceneDisplay.js'
import * as displayConstants from './Constants.js'

class WebXRViewerDisplay extends SceneDisplay {
	constructor(xrDevice, domElement, camera, scene, tickCallback = null) {
		super(displayConstants.PORTAL, camera, scene, tickCallback)
		this._render = this._render.bind(this)
		this._xrDevice = xrDevice
		this._dom = domElement

		this._isStarted = false

		this._xrSession = null
		this._eyeLevelFrameOfReference = null

		this._outputCanvas = document.createElement('canvas')
		this._outputCanvas.setAttribute('class', 'xr-canvas')
		this._outputContext = this._outputCanvas.getContext('xrpresent')
		if (!this._outputContext) {
			console.error('No output context', xrCanvas)
		}

		this._glCanvas = document.createElement('canvas')
		this._glCanvas.setAttribute('class', 'xr-canvas')
		this._glContext = this._glCanvas.getContext('webgl', {
			compatibleXRDevice: this._xrDevice
		})
		if (!this._glContext) {
			console.error('No XR context', this._glContext)
		}

		this._camera.fov = 70
		this._camera.aspect = document.documentElement.offsetWidth / document.documentElement.offsetHeight
		this._camera.near = 0.1
		this._camera.far = 1000
		this._camera.matrixAutoUpdate = false
		this._camera.updateProjectionMatrix()
		this._scene.add(this._camera)

		this._renderer = new WebGLRenderer({
			canvas: this._glCanvas,
			context: this._glContext,
			antialias: false,
			alpha: false
		})
		this._renderer.autoClear = false
		this._renderer.setPixelRatio(1)
		this._resize()
	}

	get blendMode() {
		return displayConstants.ALPHA_BLEND
	}

	get renderer() {
		return this._renderer
	}

	get isStarted() {
		return this._isStarted
	}

	start() {
		if (this._isStarted) return Promise.reject('Already started')
		this._isStarted = true
		return new Promise((resolve, reject) => {
			this._bgColor = document.body.style['background-color']
			document.body.style['background-color'] = 'rgba(0, 0, 0, 0)'

			this._dom.appendChild(this._outputCanvas)

			this._outputCanvas.width = document.documentElement.offsetWidth
			this._outputCanvas.height = document.documentElement.offsetHeight
			this._glCanvas.width = document.documentElement.offsetWidth
			this._glCanvas.height = document.documentElement.offsetHeight

			this._xrDevice
				.requestSession({ outputContext: this._outputContext })
				.then((session) => {
					this._xrSession = session
					this._xrSession.baseLayer = new XRWebGLLayer(this._xrSession, this._glContext)

					this._xrSession
						.requestFrameOfReference('eye-level')
						.then((frameOfReference) => {
							this._eyeLevelFrameOfReference = frameOfReference
							// Kick off rendering
							this._xrSession.requestAnimationFrame(this._render)
							resolve()
						})
						.catch((err) => {
							document.body.style['background-color'] = this._bgColor
							this._isStarted = false
							reject(err)
						})
				})
				.catch((err) => {
					this._dom.removeChild(this._outputCanvas)
					document.body.style['background-color'] = this._bgColor
					this._isStarted = false
					reject(err)
				})
		})
	}

	stop() {
		if (this._isStarted === false) return Promise.resolve()
		this._isStarted = false
		if (this._xrSession === null || this._xrSession.ended) return Promise.resolve()
		document.body.style['background-color'] = this._bgColor
		this._xrSession.end()
		this._xrSession = null
		return Promise.resolve()
	}

	_resize() {
		const w = document.body.clientWidth
		const h = document.body.clientHeight
		this._renderer.setSize(w, h, true)
		this._outputCanvas.width = w
		this._outputCanvas.height = h
		this._glCanvas.width = w
		this._glCanvas.height = h
	}

	_render(t, frame) {
		if (this._isStarted === false || this._xrSession === null || this._xrSession.ended) return
		this._xrSession.requestAnimationFrame(this._render)

		if (this._tickCallback) {
			this._tickCallback()
		}

		if (
			document.documentElement.offsetHeight != this._glCanvas.height ||
			document.documentElement.offsetWidth != this._glCanvas.width
		) {
			this._resize()
		}

		this._renderer.clear()

		_workingPose = frame.getDevicePose(this._eyeLevelFrameOfReference)
		if (!_workingPose) {
			console.log('No pose')
			return
		}
		for (_workingView of frame.views) {
			_workingViewport = this._xrSession.baseLayer.getViewport(_workingView)

			this._camera.matrix.fromArray(_workingPose.getViewMatrix(_workingView))
			this._camera.projectionMatrix.fromArray(_workingView.projectionMatrix)
			this._camera.updateMatrixWorld()

			this._renderer.setViewport(
				_workingViewport.x,
				_workingViewport.y,
				_workingViewport.width,
				_workingViewport.height
			)
			this._renderer.clearDepth()
			this._renderer.render(this._scene, this._camera)
			break
		}
	}
}

let _workingView = null
let _workingViewport = null
let _workingPose = null

export default WebXRViewerDisplay
