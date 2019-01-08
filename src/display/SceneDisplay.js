import EventHandler from '../EventHandler.js'
import * as displayConstants from './Constants.js'

/**
SceneDisplay is an abstract base class used by Engine to render a 3D scene
See {@link WebVRDisplay} for {@link WebXRDisplay} ancestor classes that use different APIs (WebVR and WebXR Device API)
*/
const SceneDisplay = class extends EventHandler {
	/**
	@param {string} displayMode one of displayConstants.DISPLAY_MODES
	@param {THREE.Camera} camera
	@param {THREE.Scene} scene
	@param {function} tickCallback
	*/
	constructor(displayMode, camera, scene, tickCallback = null) {
		if (displayConstants.DISPLAY_MODES.indexOf(displayMode) === -1) {
			throw new Error('Unknown display mode', displayMode)
		}
		super()
		this._displayMode = displayMode
		this._camera = camera
		this._scene = scene
		this._tickCallback = tickCallback
	}

	get blendMode() {
		throw new Error('Not implemented')
	}

	get isStarted() {
		throw new Error('Not implemented')
	}

	get renderer() {
		throw new Error('Not implemented')
	}

	start() {
		throw new Error('Not implemented')
	}

	stop() {
		throw new Error('Not implemented')
	}
}

export default SceneDisplay
