import DataObject from './DataObject.js'

/**
	DataModel holds a map of string,value pairs, sometimes fetched from or sent to a back-end server.

	It fires events when values are changed so that {Component}s and other logic can react.
*/
export default class extends DataObject {
	/**
	@param {Object} [data={}]
	@param {Object} [options={}]
	@param {Object} [fieldDataObjects=null] a map of dataField (string) to DataObject (class), used to create sub-objects in this Model's data
	*/
	constructor(data = {}, options = {}) {
		super(options)
		if (typeof this.options.fieldDataObjects === 'undefined') {
			this.options.fieldDataObjects = {}
		}
		this.data = {}
		this.collection = null // set or unset by a DataCollection that claims or releases the model
		this.setBatch(data)
	}
	cleanup() {
		super.cleanup()
		this.data = null
	}
	has(dataField) {
		return typeof this.data[dataField] !== 'undefined'
	}
	/**
	Find a value held within this DataModel. 
	@return may be native types or, if mapped by options.fieldDataObjects, another DataObject
	*/
	get(dataField, defaultValue = null) {
		if (typeof this.data[dataField] === 'undefined' || this.data[dataField] === null || this.data[dataField] === '') {
			return defaultValue
		}
		return this.data[dataField]
	}
	/**
	Set a key/value pair
	*/
	set(dataField, value) {
		const batch = {}
		batch[dataField] = value
		return this.setBatch(batch)
	}

	/**
	Set a group of values. The 'values' parameter should be an object that works in for(key in values) loops like a dictionary: {}
	If a key is in options.fieldDataObjects then the value will be used to contruct a DataObject and that will be the saved value.
	*/
	setBatch(values) {
		const changes = {}
		let changed = false
		for (const key in values) {
			const result = this._set(key, values[key])
			if (result !== DataObject._NO_CHANGE) {
				changed = true
				changes[key] = result
				this.trigger(`changed:${key}`, this, key, result)
			}
		}
		if (changed) {
			this.trigger('changed', this, changes)
		}
		return changes
	}
	increment(dataField, amount = 1) {
		const currentVal = dataField in this.data ? this.data[dataField] : 0
		this.set(dataField, currentVal + amount)
	}
	_set(dataField, data) {
		// _set does not fire any events, so you probably want to use set or setBatch
		if (data instanceof DataObject) {
			if (this.data[dataField] instanceof DataObject) {
				this.data[dataField].reset(data.data)
			} else {
				this.data[dataField] = data
			}
		} else if (this.options.fieldDataObjects[dataField]) {
			if (this.data[dataField]) {
				this.data[dataField].reset(data)
			} else {
				this.data[dataField] = new this.options.fieldDataObjects[dataField](data)
			}
		} else {
			if (this.data[dataField] === data) {
				return DataObject._NO_CHANGE
			}
			if (this.data[dataField] instanceof DataObject) {
				this.data[dataField].reset(data)
			} else {
				this.data[dataField] = data
			}
		}
		return this.data[dataField]
	}
	delete() {
		return new Promise((resolve, reject) => {
			super
				.delete()
				.then((...params) => {
					if (this.collection !== null) {
						this.collection.remove(this)
					}
					resolve(...params)
				})
				.catch((...params) => {
					reject(...params)
				})
		})
	}
	reset(data = {}) {
		for (const key in this.data) {
			if (typeof data[key] === 'undefined') {
				this.data[key] = null
			}
		}
		this.setBatch(data)
		this.trigger('reset', this)
	}
	equals(obj) {
		if (obj === null || typeof obj === 'undefined') return false
		if (this === obj) return true
		if (typeof obj !== typeof this) return false
		if (obj.get('id') === this.get('id')) return true
		return false
	}
}
