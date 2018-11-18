import dom from './DOM.js'
import som from './SOM.js'
import EventHandler from './EventHandler.js'
import AudioManager from './AudioManager.js'
import DisplayModeTracker from './DisplayModeTracker.js'

/**
Component contains the reactive logic for a responsive UI element.
It supports all three display modes on the wider web: flat, portal, and immersive.

Flat display mode is the original web, displayed on PC screens and handheld screens.

Flat controls in a Component are represented by a DOM hierarchy.

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
	@param {HTMLElement} [options.flatDOM]
	@param {HTMLElement} [options.portalDOM]
	@param {THREE.Object3D} [options.portalSOM]
	@param {THREE.Object3D} [options.immersiveSOM]
	@param {string} [options.name=null] = if not null, use Component.setName with the value
	@param {string} [options.classes=null] - if not null, a string to add to the class attribute of the DOMs and SOMs
	@param {boolean} [options.usesFlat=true] - if set to false the flatDOM will be hidden
	@param {boolean} [options.usesPortalOverlay=true] - if set to false the portalDOM will be hidden
	@param {boolean} [options.usesPortalSpatial=true] - if set to false the portalSOM will be hidden
	@param {boolean} [options.usesImmersive=true] - if set to false the immersiveSOM is hidden
	@param {string} [options.activationAnchor=null] if defined, activating this Component will change the document.href.location to this URL
	*/
	constructor(dataObject = null, options = {}, inheritedOptions = {}) {
		super()
		this.dataObject = dataObject // a DataModel or DataCollection
		this.options = Object.assign(
			{
				usesFlat: true,
				flatDOM: null,

				usesPortalOverlay: true,
				portalDOM: null,

				usesPortalSpatial: true,
				portalSOM: null,

				classes: null,
				name: null,

				usesImmersive: true,
				immersiveSOM: null,

				activationAnchor: null
			},
			inheritedOptions,
			options
		)
		this.cleanedUp = false

		this._binder = new Binder(this)

		this.focus = this.focus.bind(this)
		this.blur = this.blur.bind(this)

		// One Component at a time may accept text input focus
		this._acceptsTextInputFocus = false

		// Set up the DOM hierarchies and Three.js scene graphs for the three display modes:

		// Flat display mode elements for page controls
		this._flatDOM = this.options.flatDOM || dom.div()
		this._flatDOM.component = this
		this._flatDOM.addClass(
			'dom', // dom (Document Object Model) is set on both flat and portal DOM elements
			'flat-dom'
		)
		if (this.usesFlat === false) {
			this._flatDOM.addClass('hidden')
		}

		// Portal display mode elements for overlay controls
		this._portalDOM = this.options.portalDOM || dom.div()
		this._portalDOM.component = this
		this._portalDOM.addClass(
			'dom', // dom (Document Object Model) is set on both flat and portal DOM elements
			'portal-dom'
		)
		if (this.options.usesPortalOverlay === false) {
			this._portalDOM.addClass('hidden')
		}

		// Portal display mode 3D graph for spatial controls
		this._portalSOM = this.options.portalSOM || som.group()
		this._portalSOM.component = this
		this._portalSOM.addClass(
			'som', // som (Spatial Object Model) is set on both portal-dom and immersive-som
			'portal-som'
		)
		if (this.options.usesPortalSpatial === false) {
			this._portalSOM.visible = false
		}

		// Immersive display mode 3D graph for spatial controls
		this._immersiveSOM = this.options.immersiveSOM || som.group()
		this._immersiveSOM.component = this
		this._immersiveSOM.addClass(
			'som', // som (Spatial Object Model) is set on both portal-som and immersive-som
			'immersive-som'
		)
		if (this.options.usesImmersive === false) {
			this._immersiveSOM.visible = false
		}

		// All Components are selectable by the 'component' class
		this.addClass('component')

		if(this.options.classes){
			this.addClass(...this.options.classes.split(/\s/).filter(cls => cls.trim().length > 0))
		}

		this._updateClasses()

		if(this.options.name) {
			this.setName(this.options.name)
		}

		this.listenTo('focus', this._flatDOM, this.focus)
		this.listenTo('blur', this._flatDOM, this.blur)
		this.listenTo('focus', this._portalDOM, this.focus)
		this.listenTo('blur', this._portalDOM, this.blur)

		this.listenTo(DisplayModeTracker.DisplayModeChangedEvent, DisplayModeTracker.Singleton, this.handleDisplayModeChange)
	}

	cleanup() {
		if (this.cleanedUp) return
		this.cleanedUp = true
		super.cleanup()
		this._binder.cleanup()
		return this
	}

	/**
	options that should be passed into children Components like so:

		this._childComponent = new Component(
			dataObject,
			options,
			this.inheritedOptions
		).appendTo(this)

	The main function of the inherited options is to pass down the information of whether to use each display mode.
	This will make your application faster by giving Components the ability to save a lot of memory and processing time when entire display modes like immersive aren't wanted.

	@type {Object}
	*/
	get inheritedOptions() {
		return {
			usesFlat: this.options.usesFlat,
			usesPortalOverlay: this.options.usesPortalOverlay,
			usesPortalSpatial: this.options.usesPortalSpatial,
			usesImmersive: this.options.usesImmersive
		}
	}

	get displayModeTracker(){
		return DisplayModeTracker.Singleton
	}

	get currentDisplayMode(){
		return DisplayModeTracker.Singleton.currentDisplayMode
	}

	/* 
	Called when the containing App changes display mode: App.FLAT, App.PORTAL, or App.IMMERSIVE
	Ancestors of this class should override this to react to state changes or just read this.currentDisplayMode to make choices
	*/
	handleDisplayModeChange(eventName, mode, displayModeTracker) {
		console.log('display mode change', eventName, mode, displayModeTracker)
	}

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

	/** @type {HTMLElement} */
	get flatDOM() {
		return this._flatDOM
	}
	/** @type {HTMLElement} */
	get portalDOM() {
		return this._portalDOM
	}
	/** @type {THREE.Object3D} */
	get portalSOM() {
		return this._portalSOM
	}
	/** @type {THREE.Object3D} */
	get immersiveSOM() {
		return this._immersiveSOM
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
	get usesDOM() {
		return this.usesFlat || this.usesPortalOverlay
	}
	get usesSOM() {
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
		return this
	}

	/** Call to remove this from text input focus */
	blur() {
		if (Component.TextInputFocus !== this) return
		Component.TextInputFocus = null
		this._updateClasses()
		return this
	}

	/** @type {boolean} */
	get hasFocus() {
		return this === Component._TextInputFocus
	}

	/**
	appendComponent adds the childComponent's flatDOM, portalDOM, portalSOM, and immersiveSOM to this Component's equivalent attributes.
	@param {Component} childComponent
	*/
	appendComponent(childComponent) {
		if (this.options.usesFlat) this._flatDOM.appendChild(childComponent.flatDOM)
		if (this.options.usesPortalOverlay) this._portalDOM.appendChild(childComponent.portalDOM)
		if (this.options.usesPortalSpatial) this._portalSOM.add(childComponent.portalSOM)
		if (this.options.usesImmersive) this._immersiveSOM.add(childComponent.immersiveSOM)
		return this
	}
	/**
	removeComponent removes the childComponent's flatDOM, portalDOM, portalSOM, and immersiveSOM from this Component's equivalent attributes.
	@param {Component} childComponent
	*/
	removeComponent(childComponent) {
		if (this.options.usesFlat) this._flatDOM.removeChild(childComponent.flatDOM)
		if (this.options.usesPortalOverlay) this._portalDOM.removeChild(childComponent.portalDOM)
		if (this.options.usesPortalSpatial) this._portalSOM.remove(childComponent.portalSOM)
		if (this.options.usesImmersive) this._immersiveSOM.remove(childComponent.immersiveSOM)
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
	Sets the name attribute on portal and immersive graphs as well as the data-name attribute on flatDOM and portalDOM
	*/
	setName(name) {
		this._flatDOM.setAttribute('data-name', name)
		this._portalDOM.setAttribute('data-name', name)
		this._portalSOM.name = name
		this._immersiveSOM.name = name
		return this
	}

	/**
	add class attributes to both flat and portal DOM elements
	@param {string[]} classNames
	*/
	addClass(...classNames) {
		this._flatDOM.addClass(...classNames)
		this._portalDOM.addClass(...classNames)
		this._portalSOM.addClass(...classNames)
		this._immersiveSOM.addClass(...classNames)
		return this
	}

	/**
	remove class attributes to both flat and portal DOM elements
	@param {string[]} classNames
	*/
	removeClass(...classNames) {
		this._flatDOM.removeClass(...classNames)
		this._portalDOM.removeClass(...classNames)
		this._portalSOM.removeClass(...classNames)
		this._immersiveSOM.removeClass(...classNames)
		return this
	}

	/**
	hides the flatDOM, portalDOM, portalSOM, and immersiveSOM if their `uses*` option was true
	*/
	hide() {
		this.flatDOM.addClass('hidden')
		this.portalDOM.addClass('hidden')
		if (this.options.usesPortalSpatial) this.portalSOM.visible = false
		if (this.options.usesImmersive) this.immersiveSOM.visible = false
		return this
	}

	/**
	shows the flatDOM, portalDOM, portalSOM, and immersiveSOM if their `uses*` option was true
	*/
	show() {
		if (this.options.usesFlat) this.flatDOM.removeClass('hidden')
		if (this.options.usesPortalOverlay) this.portalDOM.removeClass('hidden')
		if (this.options.usesPortalSpatial) this.portalSOM.visible = true
		if (this.options.usesImmersive) this.immersiveSOM.visible = true
		return this
	}

	/**
	Listen to a DOM or Component event.
	For example:
		this.buttonDOM = dom.button()
		this.listenTo('click', this.buttonDOM, this.handleClick)

		this.textComponent = new TextComponent(...)
		this.listenTo(Component.TextInputEvent, this.textComponent, (eventName, ...params) => { ... })

	@param {string} eventName
	@param {HTMLElement or EventHandler} target
	@param {function} callback
	@param {function} context
	*/
	listenTo(eventName, target, callback, context = null) {
		this._binder.listenTo(eventName, target, callback, context)
	}

	/**
	@param {string} dataField
	@param {HTMLElement or Object3D} target
	@param {function} formatter
	@param {DataModel} dataModel
	*/
	bindText(dataField, target, formatter = null, dataModel = this.dataObject) {
		this._binder.bindText(dataField, target, formatter, dataModel)
	}

	/*
	Set the attributeName attribute of target DOM or SOM to the value of dataModel.get(dataField) as it changes
	formatter defaults to the identity function but can be any function that accepts the value and returns a string

	@param {string} dataField
	@param {HTMLElement or Object3D} target
	@param {string} attributeName
	@param {function} formatter
	@param {DataModel} dataModel
	*/
	bindAttribute(dataField, target, attributeName, formatter = null, dataModel = this.dataObject) {
		this._binder.bindAttribute(dataField, target, attributeName, formatter, dataModel)
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

/**
Binder listens for events on and changes characteristics of an HTMLElement or Component in response.
This is part of what makes a Component "reactive".
*/
const Binder = class {
	constructor(component) {
		this._component = component
		this._boundCallbacks = [] // { callback, dataObject } to be unbound during cleanup
		this._eventCallbacks = [] // { callback, eventName, target } to be unregistered during cleanup
	}
	cleanup() {
		for (const bindInfo of this._boundCallbacks) {
			bindInfo.dataObject.removeListener(bindInfo.callback)
		}
		for (const info of this._eventCallbacks) {
			if (info.target.isObject3D) {
				info.target.removeListener(info.callback, info.eventName)
			} else {
				info.target.removeEventListener(info.eventName, info.callback)
			}
		}
	}

	/**
	Listen to a DOM or EventHandler event.
	For example:
		this.buttonDOM = dom.button()
		this.listenTo('click', this.buttonDOM, this.handleClick)

		this.textComponent = new TextComponent(...)
		this.listenTo(Component.TextInputEvent, this.textComponent, (eventName, ...params) => { ... })

	@param {string} eventName
	@param {HTMLElement or EventHandler} target
	@param {function} callback
	@param {function} context
	*/
	listenTo(eventName, target, callback, context = null) {
		const boundCallback = context === null ? callback : callback.bind(context)
		const info = {
			eventName: eventName,
			target: target,
			originalCallback: callback,
			context: context,
			callback: boundCallback
		}
		if (target instanceof EventHandler) {
			target.addListener(info.callback, eventName)
		} else {
			target.addEventListener(eventName, info.callback)
		}
		this._eventCallbacks.push(info)
	}

	/**
	@param {string} dataField
	@param {HTMLElement or Object3D} target
	@param {function} formatter
	@param {DataModel} dataModel
	*/
	bindText(dataField, target, formatter = null, dataModel = this._component.dataObject) {
		if (formatter === null) {
			formatter = value => {
				if (value === null) return ''
				if (typeof value === 'string') return value
				return '' + value
			}
		}
		const callback = () => {
			const result = formatter(dataModel.get(dataField))
			if (target.isObject3D) {
				target.text = typeof result === 'string' ? result : ''
			} else {
				target.innerText = typeof result === 'string' ? result : ''
			}
		}
		dataModel.addListener(callback, `changed:${dataField}`)
		callback()
		this._boundCallbacks.push({
			callback: callback,
			dataObject: dataModel
		})
	}

	/*
	Set the attributeName attribute of target DOM or SOM to the value of dataModel.get(dataField) as it changes
	formatter defaults to the identity function but can be any function that accepts the value and returns a string

	@param {string} dataField
	@param {HTMLElement or Object3D} target
	@param {string} attributeName
	@param {function} formatter
	@param {DataModel} dataModel
	*/
	bindAttribute(dataField, target, attributeName, formatter = null, dataModel = this._component.dataObject) {
		if (formatter === null) {
			formatter = value => {
				if (value === null) return ''
				if (typeof value === 'string') return value
				return '' + value
			}
		}
		const callback = () => {
			if (target.isObject3D) {
				target.attributes.set(attributeName, formatter(dataModel.get(dataField)))
			} else {
				target.setAttribute(attributeName, formatter(dataModel.get(dataField)))
			}
		}
		dataModel.addListener(callback, `changed:${dataField}`)
		callback()
		this._boundCallbacks.push({
			callback: callback,
			dataObject: dataModel
		})
	}
}

export default Component
