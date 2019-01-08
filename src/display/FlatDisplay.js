import SceneDisplay from './SceneDisplay.js'
import * as displayConstants from './Constants.js'

/**
FlatDisplay is mostly used during development as an easy way to render a portal or immersive scene to the flat page to check the rendering and layout of Components
WebVRDisplay and WebXRDisplay are the displays used in production.
*/
const FlatDisplay = class extends SceneDisplay {
	constructor(camera, scene, tickCallback = null) {
		super(displayConstants.IMMERSIVE, camera, scene, tickCallback)
		this._render = this._render.bind(this)

		this._tickCallback = tickCallback
		// Render size
		this._width = 1
		this._height = 1

		this._isStarted = false

		this._clock = new THREE.Clock()
		this._delta = this._clock.getDelta()

		this._renderer = new THREE.WebGLRenderer({
			antialias: true
		})
		this._renderer.domElement.setAttribute('class', 'flat-display')
		this._renderer.setClearColor(displayConstants.defaultBackgroundColor)
		this._renderer.autoClear = false
		this._renderer.shadowMap.enabled = true
		this._renderer.shadowMap.type = THREE.PCFShadowMap
	}

	get dom() {
		return this._renderer.domElement
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
		this._updateSize()
		requestAnimationFrame(this._render)
		return Promise.resolve()
	}

	stop() {
		if (this._isStarted === false) return Promise.resolve()
		this._isStarted = false
		return Promise.resolve()
	}

	_render() {
		if (this.isStarted === false) return
		requestAnimationFrame(this._render)
		this._updateSize()

		this._delta = this._clock.getDelta()
		if (this._tickCallback) {
			this._tickCallback()
		}

		this._renderer.clear()
		this._renderer.render(this._scene, this._camera)
	}

	_updateSize() {
		this._width = this.dom.clientWidth
		this._height = this.dom.clientHeight
		this._renderer.setPixelRatio(window.devicePixelRatio)
		this._camera.aspect = this._width / this._height
		this._camera.updateProjectionMatrix()
		this._renderer.setSize(this._width, this._height, false)
	}
}

export default FlatDisplay
