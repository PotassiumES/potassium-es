import Evaluators from './Evaluators.js'

/**
ComputedStyles holds the previous and computed declarations for a single Object3D

The computed styles are the combined output of a node's {AssignedStyles}, {LocalStyles}, and inherited computed parental styles.
*/
class ComputedStyles {
	/**
	@param {THREE.Object3D} node
	*/
	constructor(node) {
		this.node = node
		/** @type {Map<string, StyleInfo>} property -> style */
		this._previousStyles = new Map()
		/** @type {Map<string, StyleInfo>} property -> style */
		this._currentStyles = new Map()
		/** @type {StyleInfo[]} */
		this._changes = []
	}

	/**
	Compute the final styles for a node:
	- apply the assigned styles
	- apply local styles that aren't assigned
	- apply inherited styles that aren't assigned or local

	@todo calculate relative units like `em`
	@todo handle the 'inherit' and 'reset' style values
	@todo handle inherited sub values like `border-top: 10px` inherited on top of `border: 0`
	@todo handle value methods like `calc()`

	@param {AssignedStyles} assignedStyles
	@param {LocalStyles} localStyles
	@param {ComputedStyles} [parentalComputedStyles=null]
	*/
	computeStyles(assignedStyles, localStyles, parentalComputedStyles = null) {
		// Swap the previous and current maps
		_holdingVariable = this._previousStyles
		this._previousStyles = this._currentStyles
		this._currentStyles = _holdingVariable
		this._currentStyles.clear()

		// Empty the working list
		this._changes.splice(0, this._changes.length)
		_currentPropertiesArray.splice(0, _currentPropertiesArray.length)
		_changedVariablesArray.splice(0, _changedVariablesArray.length)

		// Assign the assigned styles
		for (const styleInfo of assignedStyles) {
			this._currentStyles.set(styleInfo.property, styleInfo)
			_currentPropertiesArray.push(styleInfo.property)
		}

		// Assign the local styles
		for (const styleInfo of localStyles) {
			// Don't overwrite assigned styles
			if (assignedStyles.has(styleInfo.property)) continue
			this._currentStyles.set(styleInfo.property, styleInfo)
			_currentPropertiesArray.push(styleInfo.property)
		}

		// If there are parental styles then add the inheritable ones for which there is not a local style
		if (parentalComputedStyles !== null) {
			for (const styleInfo of parentalComputedStyles) {
				// Skip if this is not a variable and not an inherited property
				if (styleInfo.property.startsWith('--') === false && InheritedProperties.includes(styleInfo.property) === false)
					continue
				// Skip if there is an assigned or local style that overrides the inherited property
				if (this._currentStyles.has(styleInfo.property)) continue
				// Ok, this is a cascaded style!
				this._currentStyles.set(styleInfo.property, styleInfo)
				_currentPropertiesArray.push(styleInfo.property)
			}
		}

		//Recalculate the changes list
		for (const property of _currentPropertiesArray) {
			const hasStyle = this._previousStyles.has(property)
			if (hasStyle === false) {
				this._changes.push(property)
				if (property.startsWith('--')) _changedVariablesArray.push(property)
			} else if (hasStyle && this._previousStyles.get(property).value !== this._currentStyles.get(property).value) {
				this._changes.push(property)
				if (property.startsWith('--')) _changedVariablesArray.push(property)
			}
		}
		for (const property of this._previousStyles.keys()) {
			if (this._currentStyles.has(property) === false) this._changes.push(property)
			if (property.startsWith('--')) _changedVariablesArray.push(property)
		}

		// Mark changed any declarations whose value is one of the changed variables
		for (const property of this._currentStyles.keys()) {
			if (this._changes.includes(property)) continue // Already marked as a change
			_workingVal = this._currentStyles.get(property).value
			if (_workingVal.startsWith('var(--') === false) continue
			_workingVal = _workingVal.substring(4, _workingVal.length - 1)
			if (_changedVariablesArray.includes(_workingVal)) {
				this._changes.push(property)
			}
		}
	}

	get(property) {
		return this._currentStyles.get(property) || null
	}

	getNumber(property, defaultValue = null) {
		const styleInfo = this.get(property)
		if (styleInfo === null) return defaultValue
		const parsedValue = Evaluators.parse(styleInfo.value, this.node)
		if (parsedValue === null) return defaultValue
		if (Array.isArray(parsedValue)) return parsedValue[0]
		return parsedValue
	}

	/*

	The fillLength allows us to quickly handle array values that auto-expand, like margin-width or padding.
	This method will fill the result array with enough copies of the parsedValue that when combined with parsedValue it is fillLength long
	For example:
		a parsedValue of: [1, 2, 3]
		with a fillValue of 7
		would result in: [1, 2, 3, 1, 2, 3, 1]

	@param {string} property
	@param {Array?} defaultValue - the default to return if the property is not set or not parsable
	@param {number?} expectedLength
	*/
	getNumberArray(property, defaultValue = null, fillLength = null) {
		const styleInfo = this.get(property)
		if (styleInfo === null) return defaultValue
		const parsedValue = Evaluators.parse(styleInfo.value, this.node)
		if (parsedValue === null) return defaultValue
		if (Array.isArray(parsedValue) === false) {
			console.error('Expected an array', parsedValue, typeof parsedValue)
			return defaultValue
		}
		if (parsedValue.length === 0) return defaultValue
		if (fillLength !== null && parsedValue.length < fillLength) {
			const numToFill = fillLength - parsedValue.length
			const fillValues = new Array(numToFill)
			for (let i = 0; i < numToFill; i++) {
				fillValues[i] = parsedValue[i % parsedValue.length]
			}
			parsedValue.push(...fillValues)
		}
		return parsedValue
	}

	getBoolean(property, defaultValue = null) {
		const styleInfo = this.get(property)
		if (styleInfo === null) return defaultValue
		return styleInfo.value === 'true'
	}

	getString(property, defaultValue = null) {
		const styleInfo = this.get(property)
		if (styleInfo === null) return defaultValue
		return styleInfo.value
	}

	/**
	changes is used by the Stylist to know which styles need to be updated on the Three.Object3D
	@return {Array<property{string}>} the declarations that changed since the last update
	*/
	get changes() {
		return this._changes
	}

	/** Iterate over the current declarations */
	*[Symbol.iterator]() {
		for (const styleInfo of this._currentStyles.values()) {
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

let _workingVal = null
let _holdingVariable = null
const _changedVariablesArray = new Array()
const _currentPropertiesArray = new Array()

/**
The name of properties that are inherited during the cascade.

Don't forget that --variables are also inherited!
*/
const InheritedProperties = [
	'border-collapse',
	'border-spacing',
	'caption-side',
	'color',
	'emissive',
	'cursor',
	'direction',
	'empty-cells',
	'font-family',
	'font-size',
	'font-style',
	'font-variant',
	'font-weight',
	'font-size-adjust',
	'font-stretch',
	'font',
	'letter-spacing',
	'line-height',
	'list-style-image',
	'list-style-position',
	'list-style-type',
	'list-style',
	'orphans',
	'quotes',
	'tab-size',
	'text-align',
	'text-align-last',
	'text-decoration-color',
	'text-indent',
	'text-justify',
	'text-shadow',
	'text-transform',
	'visibility',
	'white-space',
	'widows',
	'word-break',
	'word-spacing',
	'word-wrap'
]

const LayoutEffectingProperties = [
	'margin',
	'border-width',
	'padding',
	'scale',
	'display',
	'grid',
	'grid-template',
	'gap',
	'grid-auto-flow',
	'grid-auto-rows',
	'grid-auto-columns'
]

export default ComputedStyles
export { ComputedStyles, InheritedProperties, LayoutEffectingProperties }
