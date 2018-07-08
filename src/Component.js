import el from "./El.js"
import graph from "./Graph.js"
import EventHandler from "./EventHandler.js"

/**
	Component contains the reactive logic for a responsive UI element.
	It supports all three display modes on the wider web: flat, portal, and immersive.

	Flat display mode is the original web, displayed on PC screens and handheld screens.

	Flat display mode controls in a Component are represented by a DOM hierarchy.

	Portal display mode is for "magic window" or "aquarium" setups.
	The most common portal display is a handheld screen that looks into a real or virtual space.
	A stationary wall screen could also be a portal, changing the view by tracking the user's eyes.

	Portal display mode in a Component has two main parts:
	
	- a Three.js scene graph for spatial controls and environment objects
	- a DOM hierarchy that is laid on top of the 3D scene

	Immersive display mode is for displays that you wear on your face:
	
	- an opaque head mounted display for VR
	- a opaque head mounted display with pass-through cameras for AR
	- see-through glasses for AR

	(and everything in between)

	Immersive display mode in a Component is represented by a Three.js scene graph

	Components may also register themselves to accept text input actions by setting Component.acceptsTextInputFocus = true
	By default, if the component accepts text input actions and receives an /action/activate with a value of true, it will set
	itself as the global text input focus by setting Component.TextInputFocus = this
*/
const Component = class extends EventHandler {
	/**
	* @param {DataObject} dataObject
	* @param {Object} options
	*/
	constructor(dataObject = null, options = {}) {
		super()
		this.dataObject = dataObject // a DataModel or DataCollection
		this.options = options
		this.cleanedUp = false

		this.focus = this.focus.bind(this)
		this.blur = this.blur.bind(this)

		// One Component at a time may accept text input focus
		this._acceptsTextInputFocus = false

		// Set up the DOM hierarchies and Three.js scene graphs for the three display modes:

		// Flat display mode elements for page controls
		this._flatEl = this.options.flatEl || el.div()
		this._flatEl.component = this

		// Portal display mode 3D graph for spatial controls
		this._portalGraph = this.options.portalGraph || graph.group()
		this._portalGraph.component = this

		// Portal display mode elements for overlay controls
		this._portalEl = this.options.portalEl || el.div()
		this._portalEl.component = this

		// Immersive display mode 3D graph for spatial controls
		this._immersiveGraph = this.options.immersiveGraph || graph.group()
		this._immersiveGraph.component = this

		this.boundCallbacks = [] // { callback, dataObject } to be unbound during cleanup
		this.domEventCallbacks = [] // { callback, eventName, targetEl } to be unregistered during cleanup

		this.listenToEl("focus", this._flatEl, this.focus)
		this.listenToEl("blur", this._flatEl, this.blur)
		this.listenToEl("focus", this._portalEl, this.focus)
		this.listenToEl("blur", this._portalEl, this.blur)
	}

	cleanup() {
		if (this.cleanedUp) return
		this.cleanedUp = true
		this.clearListeners()
		for (let bindInfo of this.boundCallbacks) {
			bindInfo.dataObject.removeListener(bindInfo.callback)
		}
		for (let domInfo of this.domEventCallbacks) {
			domInfo.targetEl.removeEventListener(domInfo.eventName, domInfo.callback)
		}
	}

	/* 
	Called when a App parent changes display mode: App.FLAT, App.PORTAL, or App.IMMERSIVE
	*/
	handleDisplayModeChange(mode) {}

	/*
	Called when an action is targeted at a Component
	*/
	handleAction(actionName, value, actionParameters) {
		if (actionName === "/action/activate" && value === true) {
			this.focus()
		}
		this.trigger(Component.ActionEvent, actionName, value, actionParameters)
		if (actionName === "/action/text-input" && value && this === Component.TextInputFocus) {
			this.trigger(Component.TextInputEvent, actionParameters)
		}
	}

	get flatEl() {
		return this._flatEl
	}
	get portalEl() {
		return this._portalEl
	}
	get portalGraph() {
		return this._portalGraph
	}
	get immersiveGraph() {
		return this._immersiveGraph
	}

	/*
	True if action-input text actions are accepted by this Component 
	*/
	get acceptsTextInputFocus() {
		return this._acceptsTextInputFocus
	}
	set acceptsTextInputFocus(bool) {
		if (this._acceptsTextInputFocus === bool) return
		this._acceptsTextInputFocus = bool
		if (this._acceptsTextInputFocus === false && this === Component.TextInputFocus) {
			Component.TextInputFocus = null
		}
	}

	focus() {
		if (this._acceptsTextInputFocus === false) return false
		Component.TextInputFocus = this
	}

	blur() {
		if (Component.TextInputFocus !== this) return
		Component.TextInputFocus = null
	}

	/*
	appendComponent adds the childComponent's flatEl, portalEl, portalGraph, and immersiveGraph to this Component's equivalent attributes.
	*/
	appendComponent(childComponent) {
		this._flatEl.appendChild(childComponent.flatEl)
		this._portalEl.appendChild(childComponent.portalEl)
		this._portalGraph.add(childComponent.portalGraph)
		this._immersiveGraph.add(childComponent.immersiveGraph)
	}
	/*
	removeComponent removes the childComponent's flatEl, portalEl, portalGraph, and immersiveGraph from this Component's equivalent attributes.
	*/
	removeComponent(childComponent) {
		this._flatEl.removeChild(childComponent.flatEl)
		this._portalEl.removeChild(childComponent.portalEl)
		this._portalGraph.remove(childComponent.portalGraph)
		this._immersiveGraph.remove(childComponent.immersiveGraph)
	}

	// Helper functions to add and remove class attributes to both flat and portal DOM elements
	addClass(className) {
		this._flatEl.addClass(className)
		this._portalEl.addClass(className)
	}
	removeClass(className) {
		this._flatEl.removeClass(className)
		this._portalEl.removeClass(className)
	}

	/*
		Listen to a DOM event.
		For example:
			this.buttonEl = el.button()
			this.listenToEl('click', this.buttonEl, this.handleClick)
	*/
	listenToEl(eventName, targetEl, callback, context = this) {
		const boundCallback = context === null ? callback : callback.bind(context)
		const info = {
			eventName: eventName,
			targetEl: targetEl,
			originalCallback: callback,
			context: context,
			callback: boundCallback
		}
		targetEl.addEventListener(eventName, info.callback)
		this.domEventCallbacks.push(info)
	}
	/*
		Set the targetElement.innerText to the value of dataObject.get(fieldName) as it changes
		dataObject defaults to this.dataObject but can be any DataModel or DataCollection
		formatter defaults to the identity function but can be any function that accepts the value and returns a string
	*/
	bindTextEl(fieldName, targetElement, formatter = null, dataObject = this.dataObject) {
		if (formatter === null) {
			formatter = value => {
				if (value === null) return ""
				if (typeof value === "string") return value
				return "" + value
			}
		}
		const callback = () => {
			const result = formatter(dataObject.get(fieldName))
			targetElement.innerText = typeof result === "string" ? result : ""
		}
		dataObject.addListener(callback, `changed:${fieldName}`)
		callback()
		this.boundCallbacks.push({
			callback: callback,
			dataObject: dataObject
		})
	}
	/*
		Set the attributeName attribute of targetElement to the value of dataObject.get(fieldName) as it changes
		formatter defaults to the identity function but can be any function that accepts the value and returns a string
	*/
	bindAttributeEl(fieldName, targetElement, attributeName, formatter = null, dataObject = this.dataObject) {
		if (formatter === null) {
			formatter = value => {
				if (value === null) return ""
				if (typeof value === "string") return value
				return "" + value
			}
		}
		const callback = () => {
			targetElement.setAttribute(attributeName, formatter(dataObject.get(fieldName)))
		}
		dataObject.addListener(callback, `changed:${fieldName}`)
		callback()
		this.boundCallbacks.push({
			callback: callback,
			dataObject: dataObject
		})
	}

	static get TextInputFocus() {
		return Component._TextInputFocus
	}
	static set TextInputFocus(component) {
		if (component === Component._TextInputFocus) return
		if (component && !component.acceptsTextInputFocus) return
		const blurredComponent = Component._TextInputFocus
		Component._TextInputFocus = component
		if (blurredComponent) {
			blurredComponent.trigger(Component.BlurEvent, blurredComponent)
		}
		if (component) {
			component.trigger(Component.FocusEvent, component)
		}
	}
}

/** The Component that should receive text input because it is in focus */
Component._TextInputFocus = null

/* Events */
Component.ActionEvent = "component-action-event"
Component.TextInputEvent = "component-text-input-event"
Component.FocusEvent = "component-focus-event"
Component.BlurEvent = "component-blur-event"

export default Component
