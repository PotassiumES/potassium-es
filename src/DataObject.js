import EventHandler from './EventHandler.js'

/**
The abstract class for DataModel and DataCollection
It holds the event mixin and the generic function of fetching data from a remote service
*/
const DataObject = class extends EventHandler {
	/**
	@param {Object} [options={}]
	*/
	constructor(options = {}) {
		super()
		this.options = options
		this._new = true // True until the first fetch returns, regardless of http status
		this.cleanedUp = false
	}
	cleanup() {
		if (this.cleanedUp) return
		this.cleanedUp = true
		super.cleanup()
	}
	/** @type {bool} true until a fetch (even a failed fetch) returns */
	get isNew() {
		return this._new
	}
	/** @type {string} the URL (relative or full) as a string for the endpoint used by this.fetch */
	get url() {
		throw new Error('Extending classes must implement url()')
	}

	/** Clear out old data and set it to data, should trigger a 'reset' event */
	reset(data = {}) {
		throw new Error('Extending classes must implement reset')
	}
	parse(data) {
		// Extending classes can override this to parse the data received via a fetch
		return data
	}
	equals(obj) {
		// Extending classes can override this to allow less strict equality
		return this === obj
	}
	onFirstReset(func) {
		// If already reset, immediately call func, otherwise wait until the first reset and then call func
		if (this._new) {
			this.addListener(
				() => {
					func(this)
				},
				'reset',
				true
			)
		} else {
			func(this)
		}
	}
	get fetchOptions() {
		// Extending classes can override this to add headers, methods, etc to the fetch call
		return {
			credentials: 'same-origin'
		}
	}
	fetch() {
		// Ask the server for data for this model or collection
		return new Promise(
			function(resolve, reject) {
				this.trigger('fetching', this)
				this._innerFetch(this.url, this.fetchOptions)
					.then(response => {
						if (response.status != 200) {
							throw 'Fetch failed with status ' + response.status
						}
						return response.json()
					})
					.then(data => {
						data = this.parse(data)
						this._new = false
						this.reset(data)
						this.trigger('fetched', this, data, null)
						resolve(this)
					})
					.catch(err => {
						this._new = false
						this.trigger('fetched', this, null, err)
						reject(err)
					})
			}.bind(this)
		)
	}
	/**
	Use this to override the use of window.fetch
	For example, MockService overrides this to intercept fetch calls and return its own responses for matched endpoints
	*/
	_innerFetch(...params) {
		return fetch(...params)
	}

	/**
	Fetch each DataObject and then wait for them all to return
	Note: this resolves when the fetches complete, regardless of whether they succeed or fail.
	*/
	static fetchAll(...dataObjects) {
		const allAreFetched = () => {
			for (const dataObject of dataObjects) {
				if (dataObject.isNew) return false
			}
			return true
		}
		return new Promise((resolve, reject) => {
			if (allAreFetched()) {
				resolve(...dataObjects)
				return
			}
			for (const dataObject of dataObjects) {
				dataObject
					.fetch()
					.then(() => {
						if (allAreFetched()) resolve(...dataObjects)
					})
					.catch(err => {
						if (allAreFetched()) resolve(...dataObjects)
					})
			}
		})
	}
	save() {
		// Tell the server to create (POST) or update (PUT) this model or collection
		return new Promise(
			function(resolve, reject) {
				this.trigger('saving', this)
				const options = Object.assign({}, this.fetchOptions)
				if (this.isNew) {
					options.method = 'post'
				} else {
					options.method = 'put'
				}
				options.body = JSON.stringify(this.data)
				this._innerFetch(this.url, options)
					.then(response => {
						if (response.status != 200) {
							throw 'Save failed with status ' + response.status
						}
						return response.json()
					})
					.then(data => {
						data = this.parse(data)
						this.reset(data)
						this._new = false
						this.trigger('saved', this, data, null)
						resolve(this)
					})
					.catch(err => {
						this.trigger('saved', this, null, err)
						reject(err)
					})
			}.bind(this)
		)
	}
	delete() {
		return new Promise(
			function(resolve, reject) {
				this.trigger('deleting', this)
				const options = Object.assign({}, this.fetchOptions)
				options.method = 'delete'
				this._innerFetch(this.url, options)
					.then(response => {
						if (response.status != 200) {
							throw 'Delete failed with status ' + response.status
						}
						this.trigger('deleted', this, null)
						resolve()
					})
					.catch(err => {
						this.trigger('deleted', this, err)
						reject(err)
					})
			}.bind(this)
		)
	}
}

DataObject._NO_CHANGE = Symbol('no change')

export default DataObject
