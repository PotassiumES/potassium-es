
/**
	EventListener holds information about listeners on an object with the EventHandler
*/
const EventListener = class {
	constructor(eventName, callback, once = false) {
		this.eventName = eventName
		this.callback = callback
		this.once = once
	}
	matches(eventName) {
		return this.eventName === EventHandler.ALL_EVENTS || eventName === this.eventName
	}
	distributeEvent(eventName, ...params) {
		if (this.matches(eventName)) {
			this.callback(eventName, ...params)
			return true
		}
		return false
	}
}

/**
EventHandler is the base class that implements event distribution
*/
const EventHandler = class {
	/** Send an event to listeners */
	trigger(eventName, ...params) {
		const listenersToRemove = []
		for (let listener of this.listeners) {
			if (listener.distributeEvent(eventName, ...params) && listener.once) {
				listenersToRemove.push(listener)
			}
		}
		for (let listener of listenersToRemove) {
			this.removeListener(listener.callback, listener.eventName)
		}
	}

	addListener(callback, eventName = EventHandler.ALL_EVENTS, once = false) {
		this.listeners.push(new EventListener(eventName, callback, once))
	}

	removeListener(callback, eventName = null) {
		let remove = false
		for (let i = 0; i < this.listeners.length; i++) {
			remove = false
			if (this.listeners[i].callback === callback) {
				if (eventName == null) {
					remove = true
				} else if (this.listeners[i].matches(eventName)) {
					remove = true
				}
			}
			if (remove) {
				this.listeners.splice(i, 1)
				i -= 1
			}
		}
	}

	/** @return {@EventListener[]} */
	get listeners() {
		if (typeof this._listeners == "undefined") {
			this._listeners = []
		}
		return this._listeners
	}

	clearListeners() {
		if (typeof this._listeners !== "undefined") {
			this._listeners.length = 0
		}
	}
}
EventHandler.ALL_EVENTS = Symbol("all events")


export default EventHandler