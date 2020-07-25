import * as ta from './three/Additions.js'

import { Quaternion, Euler, Vector3, Matrix4, Clock } from 'three/src/Three.js'

import dom from './DOM.js'
import som from './SOM.js'
import Router from './Router.js'
import * as paths from './Paths.js'
import Component from './Component.js'
import Localizer from './Localizer.js'
import Engine from './display/Engine.js'
import AssetLoader from './AssetLoader.js'
import EventHandler from './EventHandler.js'
import FlatDisplay from './display/FlatDisplay.js'
import { throttledConsoleLog } from './throttle.js'
import DisplayModeTracker from './DisplayModeTracker.js'
import * as displayConstants from './display/Constants.js'

import Stylist from './style/Stylist.js'

import ActionMap from 'action-input/src/action/ActionMap'
import ClickFilter from 'action-input/src/filter/ClickFilter'
import MinMaxFilter from 'action-input/src/filter/MinMaxFilter'
import ActionManager from 'action-input/src/action/ActionManager'
import MouseInputSource from 'action-input/src/input/MouseInputSource'
import TouchInputSource from 'action-input/src/input/TouchInputSource'
import GamepadInputSource from 'action-input/src/input/GamepadInputSource'
import KeyboardInputSource from 'action-input/src/input/KeyboardInputSource'

import TextInputSource from './input/TextInputSource.js'
import ActivePickFilter from './input/ActivePickFilter.js'
import PickingInputSource from './input/PickingInputSource.js'

/**
 * App contains the orchestration logic for the entirety of what is being displayed for a given app, including the app chrome like navigation.
 *
 * It contains the root data structures for each display mode:
 *
 * - For flat mode it holds a DOM element.
 * - For portal mode it holds a DOM element for overlay controls and a 3D scene for spatial controls and virtual environments.
 * - For immersive mode it holds a 3D scene for spatial controls as well as virtual environments.
 *
 * It manages WebXR sessions for portal and immersive modes.
 * It also toggles the visibility of the flat and portal DOM fragments as display modes change.
 *
 * App communicates these changes to {@link Component}s via events so that they may react.
 */
const App = class extends EventHandler {
	/**
	@param {Object} [options]
	@param {Component} [options.textInputComponent=null]
	*/
	constructor(options) {
		super()
		this._options = Object.assign(
			{
				textInputComponent: null
			},
			options
		)
		this._handlePortalTick = this._handlePortalTick.bind(this)
		this._handleImmersiveTick = this._handleImmersiveTick.bind(this)
		this._handleFlatDisplayTick = this._handleFlatDisplayTick.bind(this)
		this._handleWindowMessage = this._handleWindowMessage.bind(this)

		this._stylist = new Stylist()
		this._stylist.addListener((eventName, stylist) => {
			setInterval(() => {
				switch (this.displayMode) {
					case App.IMMERSIVE:
						this._stylist.style(this._immersiveScene, this._immersiveEngine.renderer)
						break
					case App.PORTAL:
						this._stylist.style(this._portalScene, this._portalEngine.renderer)
						break
					case App.FLAT:
						if (this._debugScene !== null) {
							this._stylist.style(this._debugScene, this._flatDisplay.renderer)
						}
						break
				}
			}, 100)
		}, Stylist.LINKS_LOADED_EVENT)
		this._stylist.loadLinks()

		this._router = new Router()
		this._assetLoader = AssetLoader.Singleton
		this._displayModeTracker = DisplayModeTracker.Singleton

		this._displayMode = App.FLAT

		this._pickingInputSource = new PickingInputSource()

		this._actionManager = new ActionManager(false)
		this._actionManager.addFilter('click', new ClickFilter(this._actionManager.queryInputPath))
		this._actionManager.addFilter('active-pick', new ActivePickFilter(this._actionManager.queryInputPath))
		this._actionManager.addFilter('min-max', new MinMaxFilter())
		this._actionManager.addInputSource('picking', this._pickingInputSource)
		this._actionManager.addInputSource('mouse', new MouseInputSource())
		this._actionManager.addInputSource('touch', new TouchInputSource())
		this._actionManager.addInputSource('gamepad', new GamepadInputSource())
		this._actionManager.addInputSource('keyboard', new KeyboardInputSource())
		this._actionManager.addInputSource('text', Component.TextInputReceiver.textInputSource)

		/** @todo figure out how action map files should be bundled */
		this._actionManager.addActionMap(
			'flat',
			new ActionMap([...this._actionManager.filters], paths.Static + '/potassium-es/actions/flat-action-map.json')
		)
		this._actionManager.addActionMap(
			'portal',
			new ActionMap([...this._actionManager.filters], paths.Static + '/potassium-es/actions/portal-action-map.json')
		)
		this._actionManager.addActionMap(
			'immersive',
			new ActionMap([...this._actionManager.filters], paths.Static + '/potassium-es/actions/immersive-action-map.json')
		)
		/** the 'flat-dev' action map is used during dev when App.toggleFlatDisplay is used */
		this._actionManager.addActionMap(
			'flat-dev',
			new ActionMap([...this._actionManager.filters], paths.Static + '/potassium-es/actions/flat-dev-action-map.json')
		)
		this._actionManager.switchToActionMaps('flat')

		// Route activate actions to the target Component
		this._actionManager.addActionListener(
			'/action/activate',
			(actionPath, active, value, actionParameters, filterParameters, inputSource) => {
				if (value) {
					value.handleAction(actionPath, active, value, actionParameters, filterParameters, inputSource)
				}
			}
		)

		this._actionManager.addActionListener(
			'/action/activate-dom',
			(actionPath, active, value, actionParameters, filterParameters, inputSource) => {
				if (value) {
					value.handleAction('/action/activate', active, value, actionParameters, filterParameters, inputSource)
				}
			}
		)

		// Route text input actions to the Component that has text input focus
		this._actionManager.addActionListener(
			'/action/text-input',
			(actionPath, active, value, actionParameters, filterParameters, inputSource) => {
				if (active && Component.TextInputFocus !== null) {
					Component.TextInputFocus.handleAction(
						actionPath,
						active,
						value,
						actionParameters,
						filterParameters,
						inputSource
					)
				}
			}
		)

		// Route flat-dev actions for moving around the camera in FlatDisplay
		this._actionManager.addActionListener(
			'/action/transform-scene',
			(actionPath, active, value, actionParameters, filterParameters, inputSource) => {
				if (this._flatCamera === null) return
				if (active === false) {
					this._flatTransformation = null
					this._flatClock.stop()
					return
				}
				this._flatClock.start() // resets delta to zero
				this._flatTransformation = {
					reset: actionParameters.reset === true,
					translation: actionParameters.translation || null,
					rotation: actionParameters.rotation || null
				}
				if (actionParameters.translation) {
					this._flatTransformation.translation = _calculateTranslation(
						actionParameters.translation,
						this._flatCamera.quaternion
					)
				}
				if (actionParameters.rotation) {
					this._flatTransformation.rotation = new Quaternion().setFromEuler(new Euler(...actionParameters.rotation))
				}
			}
		)

		// The engines call back from their raf loops, but in flat mode the App uses window.requestAnimationFrame to call ActionManager.poll
		this._handleWindowAnimationFrame = this._handleWindowAnimationFrame.bind(this)

		/**
		The root DOM elmenent that will contain everything for every display mode
		Add this to your page's DOM
		*/
		this._dom = dom.div({ class: 'app page-app' })

		/** Flat display mode DOM elements */
		this._flatDOM = dom
			.div({
				class: 'flat-root dom-root'
			})
			.appendTo(this._dom)
		this._flatDOM.setAttribute('data-name', 'FlatRoot')
		this._flatDOM.app = this

		/** Portal display mode overlay DOM */
		this._portalDOM = dom
			.div({
				class: 'portal-root dom-root'
			})
			.appendTo(this._dom)
		this._portalDOM.setAttribute('data-name', 'PortalRoot')
		this._portalDOM.app = this

		/** Portal display mode 3D scene */
		this._portalScene = som.scene()
		this._portalScene.addClass('portal-scene', 'app', 'spatial-app')
		this._portalScene.name = 'PortalScene'
		this._portalEngine = new Engine(this._portalScene, displayConstants.PORTAL, this._handlePortalTick)
		this._portalEngine.addListener((eventName, engine) => {
			if (this._displayMode === App.PORTAL) {
				this.setDisplayMode(App.FLAT)
			}
		}, Engine.STOPPED)

		/** Portal display Spatial Object Model (SOM) container */
		this._portalSOM = som.group().appendTo(this._portalScene)
		this._portalSOM.addClass('som-root', 'portal-root', 'portal-som')
		this._portalSOM.name = 'PortalSOM'

		/** Immersive display mode 3D scene */
		this._immersiveScene = som.scene()
		this._immersiveScene.addClass('immersive-scene', 'app', 'spatial-app')
		this._immersiveScene.name = 'ImmersiveScene'
		this._immersiveEngine = new Engine(this._immersiveScene, displayConstants.IMMERSIVE, this._handleImmersiveTick)
		this._immersiveEngine.addListener((eventName, engine) => {
			if (this._displayMode === App.IMMERSIVE) {
				this.setDisplayMode(App.FLAT)
			}
		}, Engine.STOPPED)

		/** Immersive display Spatial Object Model (SOM) container */
		this._immersiveSOM = som.group().appendTo(this._immersiveScene)
		this._immersiveSOM.addClass('som-root', 'immersive-root', 'immersive-som')
		this._immersiveSOM.name = 'ImmersiveSOM'

		/* Set up WebXR, WebVR, or fallback based displays for the portal and immersive engines */
		Engine.chooseDisplays(this._portalEngine, this._immersiveEngine)
			.then(() => {
				this._displayModeTracker.setModes(true, this._portalEngine.hasDisplay, this._immersiveEngine.hasDisplay)
			})
			.catch((err) => {
				console.error('Error setting engine displays', err)
			})

		/*
		_flatDisplay is populated if you you call App.toggleFlatDisplay(...)
		@type {Engine.SceneDisplay}
		*/
		this._flatDisplay = null
		this._debugScene = null // either _portalScene or _immersiveScene
		this._flatCamera = null // a Camera
		this._flatClock = null // a Clock
		/* _flatTransformation is used to transform the camera during dev based on input triggered actions */
		this._flatTransformation = null

		/* Set up hands and pointers */
		this._madeHands = false // Hands are lazily loaded
		this._leftHand = som.group().appendTo(this._immersiveScene)
		this._leftHand.addClass('left-hand')
		this._leftHand.name = 'LeftHand'
		this._leftHand.visible = false
		this._leftPointer = this._makePointer(0x99ff99)
		this._leftPointer.addClass('left-pointer')
		this._leftPointer.name = 'LeftPointer'
		this._leftPointer.visible = false
		this._leftHand.add(this._leftPointer)
		this._rightHand = som.group().appendTo(this._immersiveScene)
		this._rightHand.addClass('right-hand')
		this._rightHand.name = 'RightHand'
		this._rightHand.visible = false
		this._rightPointer = this._makePointer(0x99ff99)
		this._rightPointer.addClass('right-pointer')
		this._rightPointer.name = 'RightPointer'
		this._rightPointer.visible = false
		this._rightHand.add(this._rightPointer)

		/* Set up text input group */
		this._immersiveInputGroup = som.group().addClass('som-input-group')
		this._immersiveInputGroup.name = 'InputGroup'
		this._immersiveScene.add(this._immersiveInputGroup)
		if (this._options.textInputComponent !== null) {
			this._immersiveInputGroup.add(this._options.textInputComponent.immersiveSOM)
		}

		// When the mode changes, notify all of the children Components
		this.addListener((eventName, mode) => {
			this._actionManager.switchToActionMaps(mode)

			/* Component listens for events on the DisplayModeTracker and updates itself accordingly */
			DisplayModeTracker.Singleton.displayMode = mode

			/* style once right at the start to avoid seeing unstyled scenes */
			switch (mode) {
				case App.IMMERSIVE:
					// Lazily load hands if necessary
					if (this._madeHands === false) {
						this._leftHand.add(this._makeHand(0xff9999))
						this._rightHand.add(this._makeHand(0xff9999))
						this._madeHands = true
					}
					this._stylist.style(this._immersiveScene, this._immersiveEngine.renderer)
					break
				case App.PORTAL:
					this._stylist.style(this._portalScene, this._portalEngine.renderer)
					break
			}
		}, App.DisplayModeChangedEvent)

		this._updateClasses()
		window.requestAnimationFrame(this._handleWindowAnimationFrame)

		// Listen for messages from the potassium-inspector WebExtension
		window.addEventListener('message', this._handleWindowMessage)
	}

	/** @type {Router} */
	get router() {
		return this._router
	}
	/** @type {AssetLoader} */
	get assetLoader() {
		return this._assetLoader
	}
	/** @type {HTMLElement} */
	get dom() {
		return this._dom
	}
	/** @type {HTMLElement} */
	get flatDOM() {
		return this._flatDOM
	}
	/** @type {HTMLElement} */
	get portalDOM() {
		return this._portalDOM
	}
	/** @type {THREE.Group} */
	get portalScene() {
		return this._portalScene
	}
	/** @type {THREE.Group} */
	get portalSOM() {
		return this._portalSOM
	}
	/** @type {THREE.Group} */
	get immersiveScene() {
		return this._immersiveScene
	}
	/** @type {THREE.Group} */
	get immersiveSOM() {
		return this._immersiveSOM
	}
	/** @type {ActionManager} */
	get actionManager() {
		return this._actionManager
	}

	/**
	appendComponent adds the childComponent's flatDOM, portalDOM, portalSOM, and immersiveSOM to this Component's equivalent attributes.
	@param {Component} childComponent
	*/
	appendComponent(childComponent) {
		this._flatDOM.appendChild(childComponent.flatDOM)
		this._portalDOM.appendChild(childComponent.portalDOM)
		this._portalSOM.add(childComponent.portalSOM)
		this._immersiveSOM.add(childComponent.immersiveSOM)
	}
	/*
	removeComponent removes the childComponent's flatDOM, portalDOM, portalSOM, and immersiveSOM from this Component's equivalent attributes.
	@param {Component} childComponent
	*/
	removeComponent(childComponent) {
		this._flatDOM.removeChild(childComponent.flatDOM)
		this._portalDOM.removeChild(childComponent.portalDOM)
		this._portalSOM.remove(childComponent.portalSOM)
		this._immersiveSOM.remove(childComponent.immersiveSOM)
	}

	/** @type {string} flat|portal|immersive */
	get displayMode() {
		return this._displayMode
	}
	/**
	@param {string} value flat|portal|immersive
	@return {Promise<string>} display mode
	*/
	setDisplayMode(value) {
		if (this._displayMode === value)
			return new Promise((resolve, reject) => {
				resolve(this._displayMode)
			})
		if (value === App.FLAT) {
			return new Promise((resolve, reject) => {
				this._displayMode = App.FLAT
				this._portalEngine.stop()
				this._immersiveEngine.stop()
				this._updateClasses()
				this.trigger(App.DisplayModeChangedEvent, App.FLAT)
				this._displayModeTracker.currentDisplayMode = App.FLAT
				window.requestAnimationFrame(this._handleWindowAnimationFrame)
				resolve(App.FLAT)
			})
		}
		if (value === App.PORTAL) {
			return new Promise((resolve, reject) => {
				this._immersiveEngine.stop()
				this._portalEngine
					.start()
					.then(() => {
						this._displayMode = App.PORTAL
						this._updateClasses()
						this.trigger(App.DisplayModeChangedEvent, App.PORTAL)
						this._displayModeTracker.currentDisplayMode = App.PORTAL
						resolve(App.PORTAL)
					})
					.catch((err) => {
						this.trigger(App.DisplayModeFailedEvent, App.PORTAL)
						reject(err)
					})
			})
		}
		if (value === App.IMMERSIVE) {
			return new Promise((resolve, reject) => {
				this._portalEngine.stop()
				this._immersiveEngine
					.start()
					.then(() => {
						this._displayMode = App.IMMERSIVE
						this._updateClasses()
						this.trigger(App.DisplayModeChangedEvent, App.IMMERSIVE)
						this._displayModeTracker.currentDisplayMode = App.IMMERSIVE
						resolve(App.IMMERSIVE)
					})
					.catch((err) => {
						this.trigger(App.DisplayModeFailedEvent, App.IMMERSIVE)
						reject(err)
					})
			})
		}
		throw new Error('Unhandled display mode', value)
	}

	toggleEdges() {
		if (this._debugScene !== null) {
			this._debugScene.toggleEdges(true)
			return
		}
		switch (this.displayMode) {
			case App.FLAT:
				return
			case App.PORTAL:
				this.portalSOM.toggleEdges(true)
				return
			case App.IMMERSIVE:
				this.immersiveSOM.toggleEdges(true)
				return
		}
	}

	/**
	toggleFlatDisplay enables creators to see a debugging view into the immersive scene on their flat screens.
	This is handy for coding and styling spatial controls when a headset is not available or you are having a good hair day and don't want to mess with success.
	@param {bool} [show=null] - if true, create and show the display, otherwise tear it down
	@param {bool} [immersive=true] - if true then show the immersive scene, otherwise show the portal scene
	*/
	toggleFlatDisplay(show = null, immersive = true) {
		if (show === null) {
			show = this._flatDisplay === null ? true : false
		}
		if (show) {
			if (this._flatDisplay !== null) {
				if (immersive) {
					if (this._debugScene === this._immersiveScene) return
				} else {
					if (this._debugScene === this._portalScene) return
				}
				document.body.removeChild(this._flatDisplay.dom)
				this._flatDisplay.stop()
			}
			this._dom
				.removeClass('flat-mode', 'immersive-mode', 'portal-mode')
				.addClass(immersive ? 'immersive-mode' : 'portal-mode')
			this._debugScene = immersive ? this._immersiveScene : this._portalScene
			this._flatCamera = som.perspectiveCamera([45, 1, 0.05, 10000])
			this._flatClock = new Clock(false)
			this._flatCamera.name = 'flat-camera'
			this._flatCamera.matrixAutoUpdate = true
			this._flatDisplay = new FlatDisplay(this._flatCamera, this._debugScene, this._handleFlatDisplayTick)
			this._stylist.style(this._debugScene, this._flatDisplay.renderer)
			document.body.prepend(this._flatDisplay.dom)
			this._flatDisplay.start()
			this._actionManager.activateActionMaps('flat-dev')

			this._displayModeTracker.currentDisplayMode = immersive ? App.IMMERSIVE : App.PORTAL
		} else {
			if (this._flatDisplay === null) return
			this._dom.removeClass('immersive-mode', 'portal-mode').addClass('flat-mode')
			document.body.removeChild(this._flatDisplay.dom)
			this._flatDisplay.stop()
			this._flatDisplay = null
			this._flatCamera = null
			this._flatClock = null
			this._debugScene = null
			this._actionManager.deactivateActionMaps('flat-dev')
			this._displayModeTracker.currentDisplayMode = App.FLAT
		}
	}

	set localizerGathering(shouldGather) {
		Localizer.Singleton.gathering = shouldGather
	}

	get localizerGathering() {
		return Localizer.Singleton.gathering
	}

	get localizerGatheredData() {
		return Localizer.Singleton.gatheredData
	}

	/**
	The potassium-inspector sends messages using window.postMessage this method watches for them
	*/
	_handleWindowMessage(event) {
		switch (event.data.action) {
			case App.GetKSSAction:
				const rawKSS = this._stylist.stylesheets[0] ? this._stylist.stylesheets[0].raw : ''
				window.postMessage(
					{
						action: App.PutKSSAction,
						kss: rawKSS
					},
					'*'
				)
				break
			case App.GetStyleTreeAction:
				const styleTree =
					event.data.scene === 'portal' ? this._portalScene.getStyleTree() : this._immersiveScene.getStyleTree()
				window.postMessage(
					{
						tree: styleTree,
						action: App.PutStyleTreeAction
					},
					'*'
				)
				break
			case App.ShowFlatDisplayAction:
				this.toggleFlatDisplay(true, event.data.display !== 'portal')
				break
			case App.HideFlatDisplayAction:
				this.toggleFlatDisplay(false)
				break
			case App.ToggleEdgesAction:
				this.toggleEdges()
				break
		}
	}

	/** Called while showing the debug flat display */
	_handleFlatDisplayTick() {
		if (this._flatCamera === null || this._flatTransformation === null) return
		if (this._flatTransformation.reset) {
			if (this._flatTransformation.translation) {
				this._debugScene.position.set(...this._flatTransformation.translation)
			} else {
				this._debugScene.position.set(0, 0, 0)
			}
			if (this._flatTransformation.rotation) {
				this._debugScene.quaternion.setFromEuler(new Euler(...this._flatTransformation.rotation))
			} else {
				this._debugScene.quaternion.set(0, 0, 0, 1)
			}
			return
		} else {
			const delta = this._flatClock.getDelta()
			if (this._flatTransformation.rotation) {
				this._debugScene.quaternion.multiply(this._flatTransformation.rotation)
			}
			if (this._flatTransformation.translation) {
				this._debugScene.position.set(
					this._debugScene.position.x + this._flatTransformation.translation[0] * delta,
					this._debugScene.position.y + this._flatTransformation.translation[1] * delta,
					this._debugScene.position.z + this._flatTransformation.translation[2] * delta
				)
			}
		}
	}

	_makeHand(color) {
		/** @todo make this a portable resource, perhaps by embedding it in an ES module */
		return som.obj(
			paths.Static + '/potassium-es/models/Controller.obj',
			(group, obj) => {
				const body = group.getObjectByName('Body_Cylinder') // Magic string for temp OBJ
				if (!body) {
					console.error('Did not find a hand group to color', group)
					return
				}
				body.material.color.set(color)
			},
			(...params) => {
				console.error('Error loading hands', ...params)
			}
		)
	}

	_makePointer(color) {
		const material = som.lineBasicMaterial({ color: color })
		const geometry = som.geometry()
		geometry.vertices.push(som.vector3(0, 0, 0), som.vector3(0, 0, -1000))
		const pointer = som.line(geometry, material)
		pointer.name = 'pointer'
		return pointer
	}

	_handlePortalTick() {
		// Update picking
		this._pickingInputSource.clearIntersectObjects()
		this._actionManager.queryInputPath('/input/touch/normalized-position/0', _workingQueryArray_1)
		if (_workingQueryArray_1[0]) {
			this._pickingInputSource.touch = this._portalEngine.pickScreen(
				_workingQueryArray_1[1][0],
				_workingQueryArray_1[1][1]
			)
		}

		// Update actions
		this._actionManager.poll()
	}

	_handleImmersiveTick() {
		// Update hand poses, visibility, and pointers
		this._actionManager.queryInputPath('/input/gamepad/left/position', _workingQueryArray_1)
		if (_workingQueryArray_1[0]) {
			this._leftHand.position.set(_workingQueryArray_1[1][0], _workingQueryArray_1[1][1], _workingQueryArray_1[1][2])
		} else {
			this._leftHand.position.set(
				App.DefaultLeftHandPosition[0],
				App.DefaultLeftHandPosition[1],
				App.DefaultLeftHandPosition[2]
			)
		}
		this._actionManager.queryInputPath('/input/gamepad/left/orientation', _workingQueryArray_1)
		if (_workingQueryArray_1[0]) {
			this._leftHand.quaternion.set(
				_workingQueryArray_1[1][0],
				_workingQueryArray_1[1][1],
				_workingQueryArray_1[1][2],
				_workingQueryArray_1[1][3]
			)
			this._actionManager.queryInputPath('/input/gamepad/left/button/0/touched', _workingQueryArray_1)
			this._actionManager.queryInputPath('/input/gamepad/left/button/4/touched', _workingQueryArray_2)
			this._leftPointer.visible = _workingQueryArray_1[0] || _workingQueryArray_2[0]
			this._leftHand.visible = true
		} else {
			// If it's not at least a 3dof controller, we don't show it
			this._leftHand.visible = false
		}
		this._actionManager.queryInputPath('/input/gamepad/right/position', _workingQueryArray_1)
		if (_workingQueryArray_1[0]) {
			this._rightHand.position.set(_workingQueryArray_1[1][0], _workingQueryArray_1[1][1], _workingQueryArray_1[1][2])
		} else {
			this._rightHand.position.set(
				App.DefaultRightHandPosition[0],
				App.DefaultRightHandPosition[1],
				App.DefaultRightHandPosition[2]
			)
		}
		this._actionManager.queryInputPath('/input/gamepad/right/orientation', _workingQueryArray_1)
		if (_workingQueryArray_1[0]) {
			this._rightHand.quaternion.set(
				_workingQueryArray_1[1][0],
				_workingQueryArray_1[1][1],
				_workingQueryArray_1[1][2],
				_workingQueryArray_1[1][3]
			)
			this._actionManager.queryInputPath('/input/gamepad/right/button/0/touched', _workingQueryArray_1)
			this._actionManager.queryInputPath('/input/gamepad/right/button/4/touched', _workingQueryArray_2)
			this._rightPointer.visible = _workingQueryArray_1[0] || _workingQueryArray_2[0]
			this._rightHand.visible = true
		} else {
			// If it's not at least a 3dof controller, we don't show it
			this._rightHand.visible = false
		}

		// Update picking
		this._pickingInputSource.clearIntersectObjects()
		if (this._leftHand.visible && this._leftPointer.visible) {
			// Turn off the hand during picking
			this._leftHand.visible = false
			this._pickingInputSource.left = this._immersiveEngine.pickPose(this._leftPointer)
			this._leftHand.visible = true
		} else {
			this._pickingInputSource.left = null
		}
		if (this._rightHand.visible && this._rightPointer.visible) {
			// Turn off the hand during picking
			this._rightHand.visible = false
			this._pickingInputSource.right = this._immersiveEngine.pickPose(this._rightPointer)
			this._rightHand.visible = true
		} else {
			this._pickingInputSource.right = null
		}
		this._actionManager.poll()
	}

	_handleWindowAnimationFrame() {
		if (this._displayMode !== App.FLAT) return
		window.requestAnimationFrame(this._handleWindowAnimationFrame)
		this._actionManager.poll()
	}

	_updateClasses() {
		this._dom.removeClass('flat-mode')
		this._dom.removeClass('portal-mode')
		this._dom.removeClass('immersive-mode')
		this._dom.addClass(this._displayMode + '-mode')
	}
}

/** Actions for messages between the page and the potassium-inspector WebExtension */

App.GetKSSAction = 'getKSS'
App.PutKSSAction = 'putKSS'
App.GetStyleTreeAction = 'getStyleTree'
App.PutStyleTreeAction = 'putStyleTree'
App.ShowFlatDisplayAction = 'showFlatDisplay'
App.HideFlatDisplayAction = 'hideFlatDisplay'
App.ToggleEdgesAction = 'toggleEdges'

App.DefaultLeftHandPosition = [-0.1, -0.4, -0.2]
App.DefaultRightHandPosition = [0.1, -0.4, -0.2]

App.FLAT = 'flat'
App.PORTAL = 'portal'
App.IMMERSIVE = 'immersive'
App.DISPLAY_MODES = [App.FLAT, App.PORTAL, App.IMMERSIVE]

App.DisplayModeChangedEvent = 'display-mode-changed'
App.DisplayModeFailedEvent = 'display-mode-failed'

export default App

const _yAxis = new Vector3(0, 1, 0)
const _zeroVector3 = new Vector3(0, 0, 0)
const _workingVector3_1 = new Vector3()
const _workingVector3_2 = new Vector3()
const _workingMatrix4_1 = new Matrix4()
const _workingQueryArray_1 = new Array(2)
const _workingQueryArray_2 = new Array(2)

/**
@param {number[]} inputTranslation [x, y, z]
@param {THREE.Quaternion} orientation
@return {number[]?} the orientated output translation
*/
const _calculateTranslation = function (inputTranslation, orientation) {
	// set up the input vector
	_workingVector3_1.set(...inputTranslation)
	_workingVector3_1.x *= -1
	if (_workingVector3_1.length() <= 0) return null

	// Get the orientation vector
	_workingVector3_2.set(0, 0, 1)
	_workingVector3_2.applyQuaternion(orientation)

	// Get the rotation matrix from origin to the orientation
	_workingMatrix4_1.lookAt(_zeroVector3, _workingVector3_2, _yAxis)

	// Apply the rotation matrix to the input vector
	_workingVector3_1.applyMatrix4(_workingMatrix4_1)
	_workingVector3_1.x *= -1
	_workingVector3_1.y *= -1
	return _workingVector3_1.toArray()
}
