import StyleInfo from './StyleInfo.js'
import Declaration from './Declaration.js'
import { LayoutEffectingProperties } from './ComputedStyles.js'
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
		this._node.styles.stylesAreDirty = true
		if (LayoutEffectingProperties.includes(property)) {
			this._node.styles.setAncestorsLayoutDirty()
		}
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
		this._node.styles.stylesAreDirty = true
		if (LayoutEffectingProperties.includes(property)) {
			this._node.styles.setAncestorsLayoutDirty()
		}
	}

	get infos() {
		return this._map.values()
	}

	/** Iterate over the {StyleInfo}s */
	*[Symbol.iterator]() {
		for (const styleInfo of this._map.values()) {
			yield styleInfo
		}
	}

	log(showVars = false) {
		for (const styleInfo of this) {
			if (showVars === false && styleInfo.property.startsWith('--')) continue
			console.log(styleInfo.toString())
		}
	}
}

export default AssignedStyles
