import {
	Declaration,
	DeclarationList
} from './Declaration.js'
import {
	Combinator,
	SelectorElement,
	SelectorFragmentList
} from './Selector.js'

/**
Stylesheet is initialized with KSS data JSON emitted by postcss-potassium. 
It holds the parsed data used to apply styles to a Three.js scene.
*/
class Stylesheet {
	/**
	@param {Object} kssData the style JSON emitted by postcss-potassium
	*/
	constructor(kssData){
		this._data = kssData
		for(let i=0; i < this._data.rules.length; i++){
			this._data.rules[i].index = i,
			this._data.rules[i].selectors = this._parseSelectors(this._data.rules[i].selectors)
			this._data.rules[i].declarations = this._parseDeclarations(this._data.rules[i].declarations)
		}
		this._loadIndex = -1 // Will be set by Stylist
	}

	/**
	The Stylist sets this to the index in the load order the stylesheet
	Used to break ties in cascade precedence
	*/
	get loadIndex(){ return this._loadIndex }
	set loadIndex(val){ this._loadIndex = val }

	get data(){ return this._data }

	updateLocalStyles(node){
		// Get a list of this node and all descendents
		const nodes = []
		node.traverse(n => {
			nodes.push(n)
		})

		// Now test each rule against each node in nodes
		for(let rule of this._data.rules){
			for(let n of nodes){
				const matchingSelector = rule.selectors.find(sfList => sfList.matches(n))
				if(!matchingSelector) continue
				n.matchingRules.push({
					rule: rule,
					stylesheet: this,
					selector: matchingSelector
				})
				for(let declaration of rule.declarations){
					n.localStyles.add(declaration, matchingSelector, this, rule)
				}
				n.localStyles.sort()
			}
		}
	}

	/**
	@param {Array[selector data]}
	@return {Array[SelectorFragmentList]}
	*/
	_parseSelectors(rawSelectors){
		return rawSelectors.map(rawSelector => {
			return new SelectorFragmentList(this._parseSelector(rawSelector))
		})
	}

	_splitSelectors(rawSelector){
		let results = []
		let current = []
		let startQuote = null
		let inBrackets = false
		for(let i=0; i < rawSelector.length; i++){
			const char = rawSelector[i]
			if(char === ' '){
				if(current.length === 0) continue
				if(startQuote === null && inBrackets === false){
					results.push(current.join(''))
					current = []
					continue
				}
			}
			if((char === '"' || char === "'") && startQuote === null){
				// start a quoted string
				startQuote = char
			} else if (startQuote === char){
				// end a quoted string
				startQuote = null
			} else if(char === '['){
				inBrackets = true
			} else if(char === ']'){
				inBrackets = false
			}
			current.push(char)
		}
		if(current.length !== 0) results.push(current.join(''))
		return results
	}

	/*
	Breaks up the rawSelector into an array of SelectorFragments (SelectorElements or Combinators)
	@param {string} rawSelector a selector string like 'div.action[foo=23][bar~=grik i] > .pickle:active'
	@return {Array<SelectorFragment>}
	*/
	_parseSelector(rawSelector){
		const rawFragments = this._splitSelectors(rawSelector).filter(rf => rf.trim().length > 0)
		const results = []
		let previousWasElement = false
		for(let rf of rawFragments){
			if(Combinator.TYPES.includes(rf)){
				results.push(new Combinator(rf))
				previousWasElement = false
			} else {
				if(previousWasElement){
					// Insert an implied descendant combinator
					results.push(new Combinator('>>'))
				}
				results.push(new SelectorElement(rf))
				previousWasElement = true
			}
		}
		return results
	}

	_parseDeclarations(rawDeclarations){
		const declarations = rawDeclarations.map(rawDeclaration => new Declaration(rawDeclaration))
		return new DeclarationList(declarations)
	}
}

export default Stylesheet
