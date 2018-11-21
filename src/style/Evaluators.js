/**
Evaluators match and parse declaration values like `rgb(124, 23, 99)` or `1cm`

@type {Map<string, Evaluator} type name => evaluator for that type
*/
class Evaluators extends Set {
	/**
	@param {string} value the value element of a KSS {Declaration}
	@return {Evaluator}
	*/
	getEvaluator(value) {
		for (const evaluator of this) {
			if (evaluator.matches(value)) return evaluator
		}
		return null
	}
	/**
	@param {string} value
	@param {THREE.Object3D} node
	@return {Array<> | undefined} the evaluated value of the specific value type, like [r, g, b] for 'color' or [x, y, z] for 'centroid'
	*/
	parse(value, node) {
		const evaluator = this.getEvaluator(value)
		if (evaluator === null) return undefined
		return evaluator.parse(value, node)
	}
}

class Evaluator {
	constructor(name, matchingRegex, parseFunction) {
		this.name = name
		this.regex = matchingRegex
		this._parseFunction = parseFunction
	}

	matches(value) {
		return value.match(this.regex) !== null
	}

	parse(value, node) {
		return this._parseFunction(value, node)
	}
}

const Singleton = new Evaluators()

Singleton.add(
	new Evaluator('custom properties / variables', /^var\(\-\-[^-\)][\-a-z0-9_]*\)$/i, (value, node) => {
		const variableName = value.substring(4, value.length - 1)
		const variableStyle = node.styles.computedStyles.get(variableName)
		if (!variableStyle) return undefined
		return Singleton.parse(variableStyle.value, node)
	})
)

Singleton.add(
	new Evaluator('rgb color', /rgb\((?:([\.0-9])+,[\s]?){2}(([\.0-9]+){1})\)/gi, (value, node) => {
		const result = _parseNumberArray(value.substring(4, value.length - 1))
		if (typeof result === 'undefined') return undefined
		return result.map(val => val / 255.0)
	})
)

Singleton.add(
	new Evaluator('quaternion', /quaternion\((?:([\.0-9])+,[\s]?){3}(([\.0-9]+){1})\)/gi, (value, node) => {
		const result = _parseNumberArray(value.substring(11, value.length - 1))
		if (typeof result === 'undefined') return undefined
		return result
	})
)

Singleton.add(
	new Evaluator('long hash color', /^#[0-9A-F]{6}$/i, (value, node) => {
		const result = [
			_parseHexNumber(value.substring(1, 3)),
			_parseHexNumber(value.substring(3, 5)),
			_parseHexNumber(value.substring(5, 7))
		]
		if (result.some(num => Number.isNaN(num))) return undefined
		return result.map(val => val / 255.0)
	})
)

Singleton.add(
	new Evaluator('short hash color', /^#[0-9A-F]{3}$/i, (value, node) => {
		const result = [
			_parseHexNumber(value.substring(1, 2)),
			_parseHexNumber(value.substring(2, 3)),
			_parseHexNumber(value.substring(3, 4))
		]
		if (result.some(num => Number.isNaN(num))) return undefined
		return result.map(val => val / 255.0)
	})
)

const DistanceVectorRegex = /(\+?\-?[\d\.]+(?:cm|m)?)/gi
Singleton.add(
	new Evaluator('distance vector', DistanceVectorRegex, (value, node) => {
		const splitValues = value.match(DistanceVectorRegex)
		const parsedValues = splitValues.map(val => {
			return _parseDistance(val, val.endsWith('cm') ? 0.01 : 1)
		})
		if (parsedValues.some(pv => Number.isNaN(pv))) return undefined
		return parsedValues
	})
)

export default Singleton
export { Evaluators, Evaluator, Singleton }

const _parseHexNumber = function(strVal) {
	return parseInt(strVal, 16)
}

const _parseDistance = function(value, multiplier = 1) {
	const numberVal = Number.parseFloat(value)
	if (Number.isNaN(numberVal)) return undefined
	return numberVal * multiplier
}

/**
parses string like '1, 3, 4.5'
*/
const _parseNumberArray = function(value) {
	const parsedVal = value
		.split(',')
		.filter(token => token.trim().length > 0)
		.map(token => {
			return Number.parseFloat(token.trim())
		})
	if (parsedVal.some(val => Number.isNaN(val))) return undefined
	return parsedVal
}
