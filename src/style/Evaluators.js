
/**
Evaluators match and parse declaration values like `rgb(124, 23, 99)` or `1cm`

@type {Map<string, Evaluator} type name => evaluator for that type
*/
class Evaluators extends Set {
	/**
	@param {string} the value element of a KSS {Declaration}
	*/
	getEvaluator(value){
		for(let evaluator of this){
			if(evaluator.matches(value)) return evaluator
		}
		return null
	}
	parse(value){
		const evaluator = this.getEvaluator(value)
		if(evaluator === null) return undefined
		return evaluator.parse(value)
	}
}

class Evaluator {
	constructor(name, matchingRegex, parseFunction){
		this.name = name
		this.regex = matchingRegex
		this._parseFunction = parseFunction
	}

	matches(value){ return value.match(this.regex) !== null }

	parse(value){ return this._parseFunction(value) }
}

const Singleton = new Evaluators()

Singleton.add(new Evaluator('rgb color', /rgb\((?:([\.0-9])+,[\s]?){2}([\.0-9]{1})\)/gi, value => {
	return _parseNumberArray(value.substring(4, value.length - 1))
}))

Singleton.add(new Evaluator('long hash color', /^#[0-9A-F]{6}$/i, value => {
	const result = [
		_parseHexNumber(value.substring(1, 3)),
		_parseHexNumber(value.substring(3, 5)),
		_parseHexNumber(value.substring(5, 7))
	]
	if(result.some(num => Number.isNaN(num))) return undefined
	return result
}))

Singleton.add(new Evaluator('short hash color', /^#[0-9A-F]{3}$/i, value => {
	const result = [
		_parseHexNumber(value.substring(1, 2)),
		_parseHexNumber(value.substring(2, 3)),
		_parseHexNumber(value.substring(3, 4))
	]
	if(result.some(num => Number.isNaN(num))) return undefined
	return result
}))

const DistanceVectorRegex = /(\+?\-?\d+(?:cm|m)?)/gi
Singleton.add(new Evaluator('distance vector', DistanceVectorRegex, value => {
	const splitValues = value.match(DistanceVectorRegex)
	const parsedValues = splitValues.map(val => {
		return _parseDistance(val, val.endsWith('cm') ? 0.01 : 1)
	})
	if(parsedValues.some(pv => Number.isNaN(pv))) return undefined
	return parsedValues
}))

export default Singleton
export { Evaluators, Evaluator, Singleton }

const _parseHexNumber = function(strVal){
	return parseInt(strVal, 16)
}

const _parseDistance = function(value, multiplier=1){
	const numberVal = Number.parseFloat(value)
	if(Number.isNaN(numberVal)) return undefined
	return numberVal * multiplier
}

/**
parses string like '1, 3, 4.5'
*/
const _parseNumberArray = function(value){
	const parsedVal = value.split(',').filter(token => token.trim().length > 0).map(token => {
		return Number.parseFloat(token.trim())
	})
	if(parsedVal.some(val => Number.isNaN(val))) return undefined
	return parsedVal
}
