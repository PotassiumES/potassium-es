import el from './El.js'
import graph from './Graph.js'
import EventHandler from './EventHandler.js'
import AudioManager from './AudioManager.js'

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
	@param {DataObject} [dataObject]
	@param {Object} [options]
	@param {Element} [options.flatEl]
	@param {Element} [options.portalEl]
	@param {THREE.Object3D} [options.portalGraph]
	@param {THREE.Object3D} [options.immersiveGraph]
	@param {boolean} [options.usesFlat=true] - if set to false the flatEl will be hidden
	@param {boolean} [options.usesPortalOverlay=true] - if set to false the portalEl will be hidden
	@param {boolean} [options.usesPortalSpatial=true] - if set to false the portalGraph will be hidden
	@param {boolean} [options.usesImmersive=true] - if set to false the immersiveGraph is hidden
	@param {string} [options.activationAnchor=null] if defined, activating this Component will change the document.href.location to this URL
	*/
	constructor(dataObject = null, options = {}) {
		super()
		this.dataObject = dataObject // a DataModel or DataCollection
		this.options = Object.assign(
			{
				usesFlat: true,
				flatEl: null,

				usesPortalOverlay: true,
				portalEl: null,

				usesPortalSpatial: true,
				portalGraph: null,

				usesImmersive: true,
				immersiveGraph: null,

				activationAnchor: null
			},
			options
		)
		this.cleanedUp = false

		this.focus = this.focus.bind(this)
		this.blur = this.blur.bind(this)

		// One Component at a time may accept text input focus
		this._acceptsTextInputFocus = false

		// Set up the DOM hierarchies and Three.js scene graphs for the three display modes:

		// Flat display mode elements for page controls
		this._flatEl = this.options.flatEl || el.div()
		this._flatEl.component = this
		this._flatEl.addClass(
			'dom', // dom (Document Object Model) is set on both flat-el and portal-el
			'flat-el'
		)
		if (this.options.usesFlat === false) {
			this._flatEl.addClass('hidden')
		}

		// Portal display mode elements for overlay controls
		this._portalEl = this.options.portalEl || el.div()
		this._portalEl.component = this
		this._portalEl.addClass(
			'dom', // dom (Document Object Model) is set on both flat-el and portal-el
			'portal-el'
		)
		if (this.options.usesPortalOverlay === false) {
			this._portalEl.addClass('hidden')
		}

		// Portal display mode 3D graph for spatial controls
		this._portalGraph = this.options.portalGraph || graph.group()
		this._portalGraph.component = this
		this._portalGraph.addClass(
			'som', // som (Spatial Object Model) is set on both portal-graph and immersive-graph
			'portal-graph'
		)
		if (this.options.usesPortalSpatial === false) {
			this._portalGraph.visible = false
		}

		// Immersive display mode 3D graph for spatial controls
		this._immersiveGraph = this.options.immersiveGraph || graph.group()
		this._immersiveGraph.component = this
		this._immersiveGraph.addClass(
			'som', // som (Spatial Object Model) is set on both portal-graph and immersive-graph
			'immersive-graph'
		)
		if (this.options.usesImmersive === false) {
			this._immersiveGraph.visible = false
		}

		// All Components are selectable by the 'component' class
		this.addClass('component')

		this.boundCallbacks = [] // { callback, dataObject } to be unbound during cleanup
		this.domEventCallbacks = [] // { callback, eventName, targetEl } to be unregistered during cleanup

		this._updateClasses()

		this.listenToEl('focus', this._flatEl, this.focus)
		this.listenToEl('blur', this._flatEl, this.blur)
		this.listenToEl('focus', this._portalEl, this.focus)
		this.listenToEl('blur', this._portalEl, this.blur)
	}

	cleanup() {
		if (this.cleanedUp) return
		this.cleanedUp = true
		this.clearListeners()
		for (const bindInfo of this.boundCallbacks) {
			bindInfo.dataObject.removeListener(bindInfo.callback)
		}
		for (const domInfo of this.domEventCallbacks) {
			domInfo.targetEl.removeEventListener(domInfo.eventName, domInfo.callback)
		}
	}

	/* 
	Called when a App parent changes display mode: App.FLAT, App.PORTAL, or App.IMMERSIVE
	*/
	handleDisplayModeChange(mode) {}

	/** @type {string} */
	get activationAnchor() {
		return this.options.activationAnchor || null
	}
	/** @type {string} */
	set activationAnchor(value) {
		this.options.activationAnchor = value
		this._updateClasses()
	}

	/**
	Called when an action is targeted at a Component
	*/
	handleAction(actionName, value, actionParameters) {
		if (actionName === '/action/activate' && value === true) {
			if (typeof this.options.activationAnchor === 'string') {
				document.location.href = this.options.activationAnchor
			}
			this.focus()
		}
		this.trigger(Component.ActionEvent, actionName, value, actionParameters)
		if (actionName === '/action/text-input' && value && this === Component.TextInputFocus) {
			this.trigger(Component.TextInputEvent, actionParameters)
		}
	}

	/** @type {Element} */
	get flatEl() {
		return this._flatEl
	}
	/** @type {Element} */
	get portalEl() {
		return this._portalEl
	}
	/** @type {THREE.Object3D} */
	get portalGraph() {
		return this._portalGraph
	}
	/** @type {THREE.Object3D} */
	get immersiveGraph() {
		return this._immersiveGraph
	}

	// helper methods to eliminate boilerplate when testing various mode usages
	get usesFlat() {
		return this.options.usesFlat
	}
	get usesPortal() {
		return this.options.usesPortalOverlay || this.options.usesPortalSpatial
	}
	get usesPortalOverlay() {
		return this.options.usesPortalOverlay
	}
	get usesPortalSpatial() {
		return this.options.usesPortalSpatial
	}
	get usesImmersive() {
		return this.options.usesImmersive
	}
	get usesSpatial() {
		return this.options.usesPortalSpatial || this.options.usesImmersive
	}
	get usesValues() {
		return {
			usesFlat: this.options.usesFlat,
			usesPortalOverlay: this.options.usesPortalOverlay,
			usesPortalSpatial: this.options.usesPortalSpatial,
			usesImmersive: this.options.usesImmersive
		}
	}

	/**
	True if action-input text actions are accepted by this Component 
	@type {boolean}
	*/
	get acceptsTextInputFocus() {
		return this._acceptsTextInputFocus
	}
	/** @type {boolean} */
	set acceptsTextInputFocus(bool) {
		if (this._acceptsTextInputFocus === bool) return
		this._acceptsTextInputFocus = bool
		if (this._acceptsTextInputFocus === false && this === Component.TextInputFocus) {
			Component.TextInputFocus = null
		}
	}

	/** Call to set this to the text input focus */
	focus() {
		if (this._acceptsTextInputFocus === false) return false
		Component.TextInputFocus = this
		this._updateClasses()
	}

	/** Call to remove this from text input focus */
	blur() {
		if (Component.TextInputFocus !== this) return
		Component.TextInputFocus = null
		this._updateClasses()
	}

	/** @type {boolean} */
	get hasFocus() {
		return this === Component._TextInputFocus
	}

	/**
	appendComponent adds the childComponent's flatEl, portalEl, portalGraph, and immersiveGraph to this Component's equivalent attributes.
	@param {Component} childComponent
	*/
	appendComponent(childComponent) {
		if(this.options.usesFlat) this._flatEl.appendChild(childComponent.flatEl)
		if(this.options.usesPortalOverlay) this._portalEl.appendChild(childComponent.portalEl)
		if(this.options.usesPortalSpatial) this._portalGraph.add(childComponent.portalGraph)
		if(this.options.usesImmersive) this._immersiveGraph.add(childComponent.immersiveGraph)
		return this
	}
	/**
	removeComponent removes the childComponent's flatEl, portalEl, portalGraph, and immersiveGraph from this Component's equivalent attributes.
	@param {Component} childComponent
	*/
	removeComponent(childComponent) {
		if(this.options.usesFlat) this._flatEl.removeChild(childComponent.flatEl)
		if(this.options.usesPortalOverlay) this._portalEl.removeChild(childComponent.portalEl)
		if(this.options.usesPortalSpatial) this._portalGraph.remove(childComponent.portalGraph)
		if(this.options.usesImmersive) this._immersiveGraph.remove(childComponent.immersiveGraph)
		return this
	}

	/**
	A handy method for quick creation and setting of a parent:
	this._fooComponent = new FooComponent().appendTo(parentComponent)
	@param {Component} parentComponent
	*/
	appendTo(parentComponent) {
		parentComponent.appendComponent(this)
		return this
	}

	/**
	Sets the name attribute on portal and immersive graphs as well as the data-name attribute on flatEl and portalEl
	*/
	setName(name) {
		this._flatEl.setAttribute('data-name', name)
		this._portalEl.setAttribute('data-name', name)
		this._portalGraph.name = name
		this._immersiveGraph.name = name
	}

	/**
	add class attributes to both flat and portal DOM elements
	@param {string[]} classNames
	*/
	addClass(...classNames) {
		classNames.forEach(className => {
			this._flatEl.addClass(className)
			this._portalEl.addClass(className)
			this._portalGraph.addClass(className)
			this._immersiveGraph.addClass(className)
		})
	}

	/**
	remove class attributes to both flat and portal DOM elements
	@param {string[]} classNames
	*/
	removeClass(...classNames) {
		classNames.forEach(className => {
			this._flatEl.removeClass(className)
			this._portalEl.removeClass(className)
			this._portalGraph.removeClass(className)
			this._immersiveGraph.removeClass(className)
		})
	}

	/**
	hides the flatEl, portalEl, portalGraph, and immersiveGraph if their `uses*` option was true
	*/
	hide() {
		if (this.options.usesFlat) this.flatEl.addClass('hidden')
		if (this.options.usesPortalOverlay) this.portalEl.addClass('hidden')
		if (this.options.usesPortalSpatial) this.portalGraph.visible = false
		if (this.options.usesImmersive) this.immersiveGraph.visible = false
	}

	/**
	shows the flatEl, portalEl, portalGraph, and immersiveGraph if their `uses*` option was true
	*/
	show() {
		if (this.options.usesFlat) this.flatEl.removeClass('hidden')
		if (this.options.usesPortalOverlay) this.portalEl.removeClass('hidden')
		if (this.options.usesPortalSpatial) this.portalGraph.visible = true
		if (this.options.usesImmersive) this.immersiveGraph.visible = true
	}

	/**
	Listen to a DOM event.
	For example:
		this.buttonEl = el.button()
		this.listenToEl('click', this.buttonEl, this.handleClick)

	@param {string} eventName
	@param {Element} targetEl
	@param {function} callback
	@param {function} context
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
	/**
	Set the targetElement.innerText to the value of dataObject.get(fieldName) as it changes
	dataObject defaults to this.dataObject but can be any DataModel or DataCollection
	formatter defaults to the identity function but can be any function that accepts the value and returns a string

	@param {string} fieldName
	@param {Element} targetElement
	@param {function} formatter
	@param {DataModel} dataModel
	*/
	bindTextEl(fieldName, targetElement, formatter = null, dataModel = this.dataModel) {
		if (formatter === null) {
			formatter = value => {
				if (value === null) return ''
				if (typeof value === 'string') return value
				return '' + value
			}
		}
		const callback = () => {
			const result = formatter(dataModel.get(fieldName))
			targetElement.innerText = typeof result === 'string' ? result : ''
		}
		dataModel.addListener(callback, `changed:${fieldName}`)
		callback()
		this.boundCallbacks.push({
			callback: callback,
			dataObject: dataModel
		})
	}
	/*
	Set the attributeName attribute of targetElement to the value of dataModel.get(fieldName) as it changes
	formatter defaults to the identity function but can be any function that accepts the value and returns a string

	@param {string} fieldName
	@param {Element} targetElement
	@param {string} attributeName
	@param {function} formatter
	@param {DataModel} dataModel
	*/
	bindAttributeEl(fieldName, targetElement, attributeName, formatter = null, dataModel = this.dataModel) {
		if (formatter === null) {
			formatter = value => {
				if (value === null) return ''
				if (typeof value === 'string') return value
				return '' + value
			}
		}
		const callback = () => {
			targetElement.setAttribute(attributeName, formatter(dataModel.get(fieldName)))
		}
		dataModel.addListener(callback, `changed:${fieldName}`)
		callback()
		this.boundCallbacks.push({
			callback: callback,
			dataObject: dataModel
		})
	}

	/**
	Updates classes based on activationAnchor and focus 
	*/
	_updateClasses() {
		if (this.hasFocus) {
			this.addClass('focus')
		} else {
			this.removeClass('focus')
		}
		if (this.activationAnchor) {
			this.addClass('anchored')
		} else {
			this.removeClass('anchored')
		}
	}

	/** @type {Component} */
	static get TextInputFocus() {
		return Component._TextInputFocus
	}
	/** @type {Component} */
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

	/** @type {AudioManager} */
	static get AudioManager() {
		return Component._AudioManager
	}
}

/** The Component that should receive text input because it is in focus */
Component._TextInputFocus = null

/** Components all share one {@link AudioManager}, retrieved by Component.AudioManager */
Component._AudioManager = new AudioManager()

/* Events */
Component.ActionEvent = 'component-action-event'
Component.TextInputEvent = 'component-text-input-event'
Component.FocusEvent = 'component-focus-event'
Component.BlurEvent = 'component-blur-event'

export default Component
