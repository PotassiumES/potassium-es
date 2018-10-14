import StyleInfo from './StyleInfo.js'
import Declaration from './Declaration.js'

/**
AssignedStyles tracks programmatically (not via KSS) assigned styles for a node
Assigned styles are never overwritten by local (KSS defined) or inherited styles
*/
class AssignedStyles {
	constructor(node) {
		this._node = node
		/** @type Map<string, StyleInfo> property -> style info */
		this._map = new Map()
	}

	/**
	@param {string} property like 'font-size'
	@return {bool} true if the property is set
	*/
	has(property) {
		return this._map.has(property)
	}

	/**
	@param {string} property like 'font-size'
	@return {StyleInfo}
	*/
	get(property) {
		return this._map.get(property) || null
	}

	/**
	@param {string} property like 'font-size'
	@return {bool} true if property existed
	*/
	delete(property) {
		return this._map.delete(property)
	}

	/**
	@param {string} property like 'font-size'
	@param {string} value like '2em'
	@param {bool} important
	*/
	set(property, value, important = false) {
		const declaration = new Declaration({
			value: value,
			property: property,
			important: important
		})
		this._map.set(property, new StyleInfo(declaration))
	}

	/** Iterate over the {StyleInfo}s */
	*[Symbol.iterator]() {
		for (const [property, styleInfo] of this._map) yield styleInfo
	}
}

export default AssignedStyles
