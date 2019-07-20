import { Vector2, Vector3, Raycaster, Quaternion } from 'three/src/Three.js'

import dom from '../DOM.js'
import som from '../SOM.js'
import EventHandler from '../EventHandler.js'
import { throttledConsoleLog } from '../throttle.js'

import SceneDisplay from './SceneDisplay.js'
import * as displayConstants from './Constants.js'

import FlatDisplay from './FlatDisplay.js'
import WebXRDisplay from './WebXRDisplay.js'
import WebVRDisplay from './WebVRDisplay.js'
import WebXRViewerDisplay from './WebXRViewerDisplay.js'

/**
Engine wraps up the THREE.Renderer and manages moving into and out of WebXR or WebVR Sessions
*/
const Engine = class extends EventHandler {
	/**
	@param {THREE.Scene} scene
	@param {string} mode displayConstants.PORTAL or displayConstants.IMMERSIVE
	@param {function} [tickCallback=null] this is called while rendering each frame 
	*/
	constructor(scene, mode, tickCallback = null) {
		if (displayConstants.DISPLAY_MODES.indexOf(mode) === -1) {
			throw new Error('Unknown engine mode', mode)
		}
		super()
		this._scene = scene
		this._displayMode = mode
		this._tickCallback = tickCallback

		this._dom = dom.div({ class: 'engine' }) // This will contain a canvas for portal mode
		this._dom.addClass(this._displayMode + '-engine')

		this._camera = som.perspectiveCamera([45, 1, 0.5, 10000])
		this._camera.name = mode + '-camera'
		this._camera.matrixAutoUpdate = false

		this._raycaster = new Raycaster()
		this._workingQuat = new Quaternion()

		this._sceneDisplay = null
	}

	get hasDisplay() {
		return this._sceneDisplay !== null
	}

	get sceneDisplay() {
		return this._sceneDisplay
	}

	set sceneDisplay(sceneDisplay) {
		this._sceneDisplay = sceneDisplay
	}

	get renderer() {
		if (this._sceneDisplay === null) return null
		return this._sceneDisplay.renderer
	}

	get dom() {
		return this._dom
	}

	get scene() {
		return this._scene
	}

	get camera() {
		return this._camera
	}

	get tickCallback() {
		return this._tickCallback
	}

	start() {
		if (this._sceneDisplay === null) return Promise.reject()
		return this._sceneDisplay.start()
	}

	stop() {
		if (this._sceneDisplay === null) return Promise.resolve()
		return this._sceneDisplay.stop()
	}

	pickScreen(normalizedMouseX, normalizedMouseY) {
		_workingVector2_1.x = normalizedMouseX
		_workingVector2_1.y = normalizedMouseY
		this._raycaster.setFromCamera(_workingVector2_1, this._camera)
		_workingPickResults.splice(0, _workingPickResults.length)
		this._raycaster.intersectObjects(this._scene.children, true, _workingPickResults)
		if (_workingPickResults.length === 0) return null
		return _workingPickResults[0]
	}

	pickPose(pointObject3D) {
		this._raycaster.ray.origin.setFromMatrixPosition(pointObject3D.matrixWorld)
		pointObject3D.getWorldQuaternion(this._workingQuat)
		this._raycaster.ray.direction.set(0, 0, -1).applyQuaternion(this._workingQuat)
		this._raycaster.ray.direction.normalize()
		_workingPickResults.splice(0, _workingPickResults.length)
		this._raycaster.intersectObjects(this._scene.children, true, _workingPickResults)
		if (_workingPickResults.length === 0) return null
		return _workingPickResults[0]
	}

	/**
	Determines the available display APIs (WebXR or WebVR) and uses that info to set up an appropriate SceneDisplay for each Engine
	@param {Engine} portalEngine
	@param {Engine} immersiveEngine
	*/
	static async chooseDisplays(portalEngine, immersiveEngine) {
		// If the non-standard WebXR Viewer API is present
		if (typeof navigator.xr === 'object' && typeof window._convertRayToARKitScreenCoordinates === 'function') {
			try {
				const xrDevice = await navigator.xr.requestDevice()
				if (xrDevice) {
					portalEngine.sceneDisplay = new WebXRViewerDisplay(
						xrDevice,
						portalEngine.dom,
						portalEngine.camera,
						portalEngine.scene,
						portalEngine.tickCallback
					)
				} else {
					console.error('No WebXR Viewer Display')
				}
			} catch (err) {
				console.error('Error requesting xr device', err)
			}
			return // The WebXR Viewer can only do portal mode
		}

		// If WebXR is present
		if (navigator.xr && typeof navigator.xr.requestDevice === 'function') {
			try {
				const xrDevice = await navigator.xr.requestDevice()
				// If WebXR can do exclusive AR sessions
				try {
					const xrContext = dom.canvas().getContext('xrpresent')
					if (!xrContext) {
						throw new Error('Could not create an xr context')
					}
					await xrDevice.supportsSession({
						outputContext: xrContext
					})
					// set portal engine display to WebXR
					portalEngine.sceneDisplay = new WebXRDisplay(
						xrDevice,
						displayConstants.PORTAL,
						portalEngine.dom,
						portalEngine.camera,
						portalEngine.scene,
						portalEngine.tickCallback
					)
				} catch (err) {
					// Portal mode not available via WebXR
				}

				//If WebXR can do exclusive VR sessions
				try {
					await xrDevice.supportsSession({
						immersive: true
					})
					// set immersive engine to WebXR mode
					immersiveEngine.sceneDisplay = new WebXRDisplay(
						xrDevice,
						displayConstants.PORTAL,
						portalEngine.dom,
						portalEngine.camera,
						portalEngine.scene,
						portalEngine.tickCallback
					)
				} catch (err) {
					// Immersive mode not available via WebXR
				}
			} catch (err) {
				// No available WebXR device
			}
		}

		// If the immersive engine does not have a display and WebVR is present
		if (immersiveEngine.hasDisplay === false && typeof navigator.getVRDisplays === 'function') {
			let displays = await navigator.getVRDisplays()
			// If there is a WebVR device
			displays = displays.filter(display => display.capabilities.canPresent)
			if (displays.length > 0) {
				// set immersive engine display to use WebVR
				immersiveEngine.sceneDisplay = new WebVRDisplay(
					displays[0],
					immersiveEngine.camera,
					immersiveEngine.scene,
					immersiveEngine.tickCallback
				)
				immersiveEngine.sceneDisplay.addListener((eventName, isPresenting) => {
					immersiveEngine.trigger(isPresenting ? Engine.STARTED : Engine.STOPPED, immersiveEngine)
				})
			}
		}
	}
}

const _workingVector2_1 = new Vector2()
const _workingPickResults = new Array()

Engine.STARTED = 'engine-started'
Engine.STOPPED = 'engine-stopped'
Engine.EVENTS = [Engine.STARTED, Engine.STOPPED]

export default Engine
