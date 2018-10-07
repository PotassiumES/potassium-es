
/**
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

	matches(value){ return value.match().length > 0 }

	parse(value){ return this._parseFunction(value) }
}

const Singleton = new Evaluators()

Singleton.add(new Evaluator('rgb color', /rgb\(.+\)/, value => {
	return _parseNumberArray(value.substring(4, value.length - 1))
}))

export default Singleton
export { Evaluators, Evaluator, Singleton }

/**
parses string like '1, 3, 4.5'
*/
const _parseNumberArray = function(value){
	return value.split(',').filter(token => token.trim().length > 0).map(token => {
		return Number.parseFloat(token.trim())
	})
}