import { Declaration, DeclarationList } from './Declaration.js'
import { Combinator, SelectorElement, SelectorFragmentList } from './Selector.js'

/**
Stylesheet is initialized with KSS data JSON emitted by postcss-potassium. 
It holds the parsed data used to apply styles to a Three.js scene.
*/
class Stylesheet {
	/**
	@param {Object} kssData the style JSON emitted by postcss-potassium
	*/
	constructor(kssData) {
		this._data = kssData
		for (let i = 0; i < this._data.rules.length; i++) {
			;(this._data.rules[i].index = i),
				(this._data.rules[i].selectors = this._parseSelectors(this._data.rules[i].selectors))
			this._data.rules[i].declarations = this._parseDeclarations(this._data.rules[i].declarations)
		}
		this._loadIndex = -1 // Will be set by Stylist
	}

	/**
	The Stylist sets this to the index in the load order the stylesheet
	Used to break ties in cascade precedence
	*/
	get loadIndex() {
		return this._loadIndex
	}
	set loadIndex(val) {
		this._loadIndex = val
	}

	get data() {
		return this._data
	}

	updateLocalStyles(node, traverseChildren = true) {
		// Get a list of this node and all descendents
		const nodes = []
		if (traverseChildren) {
			node.traverse(n => {
				nodes.push(n)
			})
		} else {
			nodes.push(node)
		}

		// Now test each rule against each node in nodes
		for (let rule of this._data.rules) {
			for (let n of nodes) {
				const matchingSelector = rule.selectors.find(sfList => sfList.matches(n))
				if (!matchingSelector) continue
				n.matchingRules.push({
					rule: rule,
					stylesheet: this,
					selector: matchingSelector
				})
				for (let declaration of rule.declarations) {
					n.localStyles.add(declaration, matchingSelector, this, rule)
				}
				n.localStyles.sort()
			}
		}
	}

	/**
	@param {Array<string>} rawSelectors selector strings
	@return {Array<SelectorFragmentList>}
	*/
	_parseSelectors(rawSelectors) {
		return rawSelectors.map(rawSelector => {
			return SelectorFragmentList.Parse(rawSelector)
		})
	}

	/**
	@param rawDeclarations {Array<string>}
	@return {Array<DeclarationList>}
	*/
	_parseDeclarations(rawDeclarations) {
		const declarations = rawDeclarations.map(rawDeclaration => new Declaration(rawDeclaration))
		return new DeclarationList(declarations)
	}
}

export default Stylesheet
