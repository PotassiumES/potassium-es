import EventHandler from './EventHandler.js'

/**
DisplayModeTracker keeps track of which display modes (flat, portal, and immersive) are possible
*/
export default class DisplayModeTracker extends EventHandler {
	constructor() {
		super()
		if (SINGLETON !== null) {
			throw new Error('Use DisplayModeTracker.Singleton, not new DisplayModeTracker()')
		}
		this._flatCapable = null
		this._portalCapable = null
		this._immersiveCapable = null

		this._mode = 'flat'
	}

	get flatCapable() {
		return this._flatCapable
	}

	get portalCapable() {
		return this._portalCapable
	}

	get immersiveCapable() {
		return this._immersiveCapable
	}

	setModes(flatCapable, portalCapable, immersiveCapable) {
		if (
			flatCapable == this._flatCapable &&
			portalCapable == this._portalCapable &&
			immersiveCapable == this._immersiveCapable
		)
			return
		this._flatCapable = !!flatCapable
		this._portalCapable = !!portalCapable
		this._immersiveCapable = !!immersiveCapable
		this._triggerUpdate()
	}

	get currentDisplayMode() {
		return this._mode
	}

	/**
	@param {string} mode like 'flat', 'portal', or 'immersive'
	*/
	set currentDisplayMode(mode) {
		if (mode === this._mode) return
		this._mode = mode
		this.trigger(DisplayModeTracker.DisplayModeChangedEvent, mode, this)
	}

	_triggerUpdate() {
		this.trigger(DisplayModeTracker.DisplayUpdatedEvent, this.flatCapable, this.portalCapable, this.immersiveCapable)
	}

	static get Singleton() {
		if (!SINGLETON) {
			SINGLETON = new DisplayModeTracker()
		}
		return SINGLETON
	}
}

let SINGLETON = null

DisplayModeTracker.DisplayUpdatedEvent = 'display-modes-updated'
DisplayModeTracker.DisplayModeChangedEvent = 'display-mode-changed'
