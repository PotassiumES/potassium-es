import el from "./El.js"
import graph from "./Graph.js"
import Engine from "./Engine.js"
import Router from "./Router.js"
import Component from "./Component.js"
import AssetLoader from './AssetLoader.js'
import EventHandler from "./EventHandler.js"
import { throttledConsoleLog } from "./throttle.js"
import DisplayModeTracker from './DisplayModeTracker.js'

import ActionMap from "action-input/src/action/ActionMap"
import ClickFilter from "action-input/src/filter/ClickFilter"
import MinMaxFilter from "action-input/src/filter/MinMaxFilter"
import ActionManager from "action-input/src/action/ActionManager"
import MouseInputSource from "action-input/src/input/MouseInputSource"
import TouchInputSource from "action-input/src/input/TouchInputSource"
import GamepadInputSource from "action-input/src/input/GamepadInputSource"
import KeyboardInputSource from "action-input/src/input/KeyboardInputSource"

import TextInputFilter from "./input/TextInputFilter.js"
import ActivePickFilter from "./input/ActivePickFilter.js"
import PickingInputSource from "./input/PickingInputSource.js"
import VirtualKeyboardInputSource from "./input/VirtualKeyboardInputSource.js"

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
	constructor() {
		super()
		this._handlePortalTick = this._handlePortalTick.bind(this)
		this._handleImmersiveTick = this._handleImmersiveTick.bind(this)

		this._router = new Router()
		this._assetLoader = AssetLoader.Singleton
		this._displayModeTracker = DisplayModeTracker.Singleton

		this._displayMode = App.FLAT

		this._virtualKeyboardInputSource = new VirtualKeyboardInputSource()
		this._virtualKeyboardInputSource.keyboardGroup.quaternion.setFromEuler(graph.euler(0, -45, 0))
		this._virtualKeyboardInputSource.keyboardGroup.position.set(0.8, 0, -0.8)
		this._virtualKeyboardInputSource.keyboardGroup.visible = false
		
		this._pickingInputSource = new PickingInputSource()

		this._actionManager = new ActionManager(false)
		this._actionManager.addFilter("click", new ClickFilter(this._actionManager.queryInputPath))
		this._actionManager.addFilter("active-pick", new ActivePickFilter(this._actionManager.queryInputPath))
		this._actionManager.addFilter("text-input", new TextInputFilter())
		this._actionManager.addFilter("min-max", new MinMaxFilter())
		this._actionManager.addInputSource("picking", this._pickingInputSource)
		this._actionManager.addInputSource("mouse", new MouseInputSource())
		this._actionManager.addInputSource("touch", new TouchInputSource())
		this._actionManager.addInputSource("gamepad", new GamepadInputSource())
		this._actionManager.addInputSource("keyboard", new KeyboardInputSource())
		this._actionManager.addInputSource("virtual-keyboard", this._virtualKeyboardInputSource)

		/** @todo figure out how action map files should be bundled */
		this._actionManager.addActionMap(
			"flat",
			new ActionMap([...this._actionManager.filters], "/static/potassium-es/actions/flat-action-map.json")
		)
		this._actionManager.addActionMap(
			"portal",
			new ActionMap([...this._actionManager.filters], "/static/potassium-es/actions/portal-action-map.json")
		)
		this._actionManager.addActionMap(
			"immersive",
			new ActionMap([...this._actionManager.filters], "/static/potassium-es/actions/immersive-action-map.json")
		)
		this._actionManager.switchToActionMaps("flat")

		// Route activate actions to the target Component
		this._actionManager.addActionListener("/action/activate", (actionName, value, actionParameters) => {
			if (actionParameters !== null && actionParameters.targetComponent) {
				actionParameters.targetComponent.handleAction(actionName, value, actionParameters)
			}
			if (value && actionParameters !== null && actionParameters.pointer === "left") {
				this._virtualKeyboardInputSource.handleLeftActivate()
			}
			if (value && actionParameters !== null && actionParameters.pointer === "right") {
				this._virtualKeyboardInputSource.handleRightActivate()
			}
		})

		this._actionManager.addActionListener("/action/activate-dom", (actionName, value, actionParameters) => {
			if (actionParameters !== null && actionParameters.targetComponent) {
				actionParameters.targetComponent.handleAction("/action/activate", value, actionParameters)
			}
		})

		// Route text input actions to the Component that has text input focus
		this._actionManager.addActionListener("/action/text-input", (actionName, value, actionParameters) => {
			if (Component.TextInputFocus !== null) {
				Component.TextInputFocus.handleAction(actionName, value, actionParameters)
			}
		})

		// The engines call back from their raf loops, but in flat mode the App uses window.requestAnimationFrame to call ActionManager.poll
		this._handleWindowAnimationFrame = this._handleWindowAnimationFrame.bind(this)

		/**
		The root DOM elmenent that will contain everything for every display mode
		Add this to your app's DOM
		*/
		this._el = el.div({ class: "app" })

		/** Flat display mode DOM elements */
		this._flatEl = el.div({ class: "flat-root" }).appendTo(this._el)

		/** Portal display mode overlay DOM and 3D scene */
		this._portalEl = el.div({ class: "portal-root" }).appendTo(this._el)
		this._portalScene = graph.scene()
		this._portalEngine = new Engine(this._portalScene, Engine.PORTAL, this._handlePortalTick)
		this._portalEngine.addListener(Engine.STOPPED, (eventName, engine) => {
			if(this._displayMode === App.PORTAL){
				this.setDisplayMode(App.FLAT)
			}
		})

		/** Immersive display mode 3D scene */
		this._immersiveEl = el.div({ class: "immersive-root" }).appendTo(this._el)
		this._immersiveScene = graph.scene()
		this._immersiveEngine = new Engine(
			this._immersiveScene,
			Engine.IMMERSIVE,
			this._handleImmersiveTick
		)
		this._immersiveEngine.addListener((eventName, engine) => {
			if(this._displayMode === App.IMMERSIVE){
				this.setDisplayMode(App.FLAT)
			}
		}, Engine.STOPPED)

		/* Set up WebXR, WebVR, or fallback based displays for the portal and immersive engines */
		Engine.chooseDisplays(this._portalEngine, this._immersiveEngine).then(() => {
			this._displayModeTracker.setModes(true, this._portalEngine.hasDisplay, this._immersiveEngine.hasDisplay)
		}).catch(err => {
			console.error('Error setting engine displays', err)
		})

		/* Set up hands and pointers */
		this._leftHand = graph.group(this._makeHand(0x9999ff)).appendTo(this._immersiveScene)
		this._leftPointer = this._makePointer(0x99ff99)
		this._leftPointer.visible = false
		this._leftHand.add(this._leftPointer)
		this._rightHand = graph.group(this._makeHand(0xff9999)).appendTo(this._immersiveScene)
		this._rightPointer = this._makePointer(0x99ff99)
		this._rightPointer.visible = false
		this._rightHand.add(this._rightPointer)
		/* Set up the virtual keyboard */
		this._immersiveScene.add(this._virtualKeyboardInputSource.keyboardGroup)

		// When the mode changes, notify all of the children Components
		this.addListener((eventName, mode) => {
			this._actionManager.switchToActionMaps(mode)

			/** @todo use a better method than flatEl traversal */
			const dive = node => {
				if (typeof node.component !== "undefined" && typeof node.component.handleDisplayModeChange === "function") {
					node.component.handleDisplayModeChange(mode)
				}
				for (let i = 0; i < node.children.length; i++) {
					dive(node.children[i])
				}
			}
			dive(this._flatEl)
		}, App.DisplayModeChangedEvent)

		this._updateClasses()
		window.requestAnimationFrame(this._handleWindowAnimationFrame)
	}

	/** @value {Router} */
	get router() {
		return this._router
	}
	/** @value {AssetLoader} */
	get assetLoader(){
		return this._assetLoader
	}
	/** @value {HTMLElement} */
	get el() {
		return this._el
	}
	/** @value {HTMLElement} */
	get flatEl() {
		return this._flatEl
	}
	/** @value {HTMLElement} */
	get portalEl() {
		return this._portalEl
	}
	/** @value {THREE.Group} */
	get portalScene() {
		return this._portalScene
	}
	/** @value {THREE.Group} */
	get immersiveScene() {
		return this._immersiveScene
	}
	/** @value {ActionManager} */
	get actionManager() {
		return this._actionManager
	}

	/**
	appendComponent adds the childComponent's flatEl, portalEl, portalGraph, and immersiveGraph to this Component's equivalent attributes.
	@param {Component} childComponent
	*/
	appendComponent(childComponent) {
		this._flatEl.appendChild(childComponent.flatEl)
		this._portalEl.appendChild(childComponent.portalEl)
		this._portalScene.add(childComponent.portalGraph)
		this._immersiveScene.add(childComponent.immersiveGraph)
	}
	/*
	removeComponent removes the childComponent's flatEl, portalEl, portalGraph, and immersiveGraph from this Component's equivalent attributes.
	@param {Component} childComponent
	*/
	removeComponent(childComponent) {
		this._flatEl.removeChild(childComponent.flatEl)
		this._portalEl.removeChild(childComponent.portalEl)
		this._portalScene.remove(childComponent.portalGraph)
		this._immersiveScene.remove(childComponent.immersiveGraph)
	}

	/** @value {string} flat|portal|immersive */
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
						resolve(App.PORTAL)
					})
					.catch(err => {
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
						resolve(App.IMMERSIVE)
					})
					.catch(err => {
						this.trigger(App.DisplayModeFailedEvent, App.IMMERSIVE)
						reject(err)
					})
			})
		}
		throw new Error("Unhandled display mode", value)
	}

	_makeHand(color) {
		/** @todo make this a portable resource, perhaps by embedding it in an ES module */
		return graph.obj(
			"/static/potassium-es/models/Controller.obj",
			(group, obj) => {
				const body = group.getObjectByName("Body_Cylinder") // Magic string for temp OBJ
				if (!body) {
					console.error("Did not find a hand group to color", group)
					return
				}
				body.material.color.set(color)
			},
			(...params) => {
				console.error("Error loading hands", ...params)
			}
		)
	}

	_makePointer(color) {
		const material = graph.lineBasicMaterial({ color: color })
		const geometry = graph.geometry()
		geometry.vertices.push(graph.vector3(0, 0, 0), graph.vector3(0, 0, -1000))
		const pointer = graph.line(geometry, material)
		pointer.name = "pointer"
		return pointer
	}

	_handlePortalTick() {
		// Update picking
		this._pickingInputSource.clearIntersectObjects()
		const touchInput = this._actionManager.queryInputPath("/input/touch/normalized-position")
		if (touchInput !== null && touchInput[0] !== null) {
			this._pickingInputSource.touch = this._portalEngine.pickScreen(...touchInput[0])
		}

		this._actionManager.poll()
	}

	_handleImmersiveTick() {
		// Update hand poses, visibility, and pointers
		const leftPosition = this._actionManager.queryInputPath("/input/gamepad/left/position")[0]
		if (leftPosition) {
			this._leftHand.position.set(...leftPosition)
		} else {
			this._leftHand.position.set(...App.DefaultLeftHandPosition)
		}
		const leftOrientation = this._actionManager.queryInputPath("/input/gamepad/left/orientation")[0]
		if (leftOrientation) {
			this._leftHand.quaternion.set(...leftOrientation)
			this._leftPointer.visible =
				this._actionManager.queryInputPath("/input/gamepad/left/button/0/touched")[0] || false
			this._leftHand.visible = true
		} else {
			// If it's not at least a 3dof controller, we don't show it
			this._leftHand.visible = false
		}
		const rightPosition = this._actionManager.queryInputPath("/input/gamepad/right/position")[0]
		if (rightPosition) {
			this._rightHand.position.set(...rightPosition)
		} else {
			this._rightHand.position.set(...App.DefaultRightHandPosition)
		}
		const rightOrientation = this._actionManager.queryInputPath("/input/gamepad/right/orientation")[0]
		if (rightOrientation) {
			this._rightHand.quaternion.set(...rightOrientation)
			this._rightPointer.visible =
				this._actionManager.queryInputPath("/input/gamepad/right/button/0/touched")[0] || false
			this._rightHand.visible = true
		} else {
			// If it's not at least a 3dof controller, we don't show it
			this._rightHand.visible = false
		}

		// Update picking
		this._pickingInputSource.clearIntersectObjects()
		if (this._leftHand.visible && this._leftPointer.visible) {
			this._leftHand.visible = false
			this._pickingInputSource.left = this._immersiveEngine.pickPose(this._leftPointer)
			this._leftHand.visible = true
		} else {
			this._pickingInputSource.left = null
		}
		if (this._rightHand.visible && this._rightPointer.visible) {
			this._rightHand.visible = false
			this._pickingInputSource.right = this._immersiveEngine.pickPose(this._rightPointer)
			this._rightHand.visible = true
		} else {
			this._pickingInputSource.right = null
		}
		this._virtualKeyboardInputSource.handlePick(this._pickingInputSource.left, this._pickingInputSource.right)
		this._actionManager.poll()
	}

	_handleWindowAnimationFrame() {
		if (this._displayMode !== App.FLAT) return
		window.requestAnimationFrame(this._handleWindowAnimationFrame)
		this._actionManager.poll()
	}

	_updateClasses() {
		this._el.removeClass("flat-mode")
		this._el.removeClass("portal-mode")
		this._el.removeClass("immersive-mode")
		this._el.addClass(this._displayMode + "-mode")
	}
}

App.DefaultLeftHandPosition = [-0.1, -0.4, -0.2]
App.DefaultRightHandPosition = [0.1, -0.4, -0.2]

App.FLAT = "flat"
App.PORTAL = "portal"
App.IMMERSIVE = "immersive"
App.DISPLAY_MODES = [App.FLAT, App.PORTAL, App.IMMERSIVE]

App.DisplayModeChangedEvent = "display-mode-changed"
App.DisplayModeFailedEvent = "display-mode-failed"

export default App
