import SceneDisplay from './SceneDisplay.js'
import * as displayConstants from './Constants.js'

/**
WebVRDisplay uses WebVR 1.1 to render a scene
*/
const WebVRDisplay = class extends SceneDisplay {
	constructor(vrDisplay, camera, scene, tickCallback) {
		super(displayConstants.IMMERSIVE, camera, scene, tickCallback)
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
		this._renderer.setClearColor(displayConstants.defaultBackgroundColor)
		this._renderer.autoClear = false
		this._renderer.shadowMap.enabled = true
		this._renderer.shadowMap.type = THREE.PCFShadowMap
		this._updateSize()

		window.addEventListener('vrdisplaypresentchange', ev => {
			if (this._vrDisplay === null) return
			this.trigger('vr-display-change', this._vrDisplay.isPresenting)
			if (this._vrDisplay.isPresenting === false) {
				document.body.removeChild(this._renderer.domElement)
			}
		})
	}

	get blendMode() {
		return displayConstants.OPAQUE
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
			document.body.appendChild(this._renderer.domElement)
			this._vrDisplay
				.requestPresent([
					{
						source: this._renderer.domElement
					}
				])
				.then(() => {
					this._updateSize()
					this._vrDisplay.requestAnimationFrame(this._render)
					resolve()
				})
				.catch(err => {
					this._isStarted = false
					document.body.removeChild(this._renderer.domElement)
					console.error('Error starting WebVR', err)
					reject(err)
				})
		})
	}

	stop() {
		if (this._isStarted === false) return Promise.resolve()
		this._isStarted = false
		if (this._vrDisplay.isPresenting === false) return Promise.resolve()
		return this._vrDisplay.exitPresent()
	}

	_render() {
		if (this._vrDisplay === null) return
		if (this._vrDisplay.isPresenting === false) return
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

	_updateSize() {
		if (!this._vrDisplay) return
		const eyeParams = this._vrDisplay.getEyeParameters('left')
		this._width = eyeParams.renderWidth * 2
		this._height = eyeParams.renderHeight
		this._renderer.setPixelRatio(1)
		this._camera.aspect = this._width / this._height
		this._camera.updateProjectionMatrix()
		this._renderer.setSize(this._width, this._height, false)
	}
}

export default WebVRDisplay
