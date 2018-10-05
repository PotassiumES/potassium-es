
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
		for(let rule of this._data.rules){
			rule.selectors = this._parseSelectors(rule.selectors)
			rule.declarations = this._parseDeclarations(rule.declarations)
		}
	}

	get data(){ return this._data }

	_parseSelectors(rawSelectors){
		return rawSelectors.map(rawSelector => {
			return new SelectorFragmentList(this._parseSelector(rawSelector))
		})
	}

	/*
	Breaks up the rawSelector into an array of SelectorFragments (SelectorElements or Combinators)
	@param {string} rawSelector a selector string like 'div.action[foo=23][bar~=grik] > .pickle:not(p)'
	@return {Array[SelectorFragment]}
	*/
	_parseSelector(rawSelector){
		const rawFragments = rawSelector.split(/\s/).filter(rf => rf.trim().length > 0)
		return rawFragments.map(rf => {
			if(Combinator.TYPES.includes(rf)){
				return new Combinator(rf)
			} else {
				return new SelectorElement(rf)
			}
		})
	}

	_parseDeclarations(rawDeclarations){
		const declarations = rawDeclarations.map(rawDeclaration => new Declaration(rawDeclaration))
		return new DeclarationList(declarations)
	}
}

/**
List of SelectorFragments (SelectorElements and Combinators)
*/
class SelectorFragmentList {
	constructor(selectorFragments){
		// Selectors in reversed order, from most to least specific
		this._reversedFragments = selectorFragments.reverse()
	}

	matches(node){
	}
}

/**
An abstract class for Selectors and Combinator
*/
class SelectorFragment {}

/**
SelectorElement holds a parsed version of a single element in a selector.
Example element strings:
	.foo:active
	div.group[foo=23][bar=moon]
*/
class SelectorElement extends SelectorFragment {
	/**
	@param {string} selector the string of a single selector element
	*/
	constructor(rawSelector){
		super()
		this._raw = rawSelector

		const [rawElements, rawAttributes, rawPseudos] = this._splitRaw()

		/** @type {Array[Object{ type {SelectorElement.ELEMENT_TYPES}, value {string} }]} */
		this._elements = this._parseElements(rawElements)

		/** @type {Array[Object{ key {string}, operator {SelectorElement.ATTRIBUTE_TYPES}, value {string} }, caseInsensitive {bool}] } */
		this._attributes = this._parseAttributes(rawAttributes)

		/** @type {Array[Object{ type { SelectorElement.PSEUDO_CLASS | SelectorElement.PSEUDO_ELEMENT }, value, parameters[]:[] }]} */
		this._pseudos = this._parsePseudos(rawPseudos)
	}

	/** @type {string} */
	get raw() { return this._raw }

	/**
	@return {bool}
	*/
	matches(node){

	}

	_parseElements(rawElements){
		if(!rawElements) return []
		return rawElements.match(/(\.|#)?([\w-]*|\*)/g).filter(element => element.trim().length > 0).map(element => {
			if(element.startsWith('.')){
				return {
					type: SelectorElement.CLASS_ELEMENT,
					value: element.substring(1)
				}
			} else if(element.startsWith('#')){
				return {
					type: SelectorElement.ID_ELEMENT,
					value: element.substring(1)
				}
			} else if(element === '*'){
				return {
					type: SelectorElement.WILDCARD_ELEMENT,
					value: ''
				}
			} else {
				return {
					type: SelectorElement.TAG_ELEMENT,
					value: element
				}
			}
		})
	}

	_parseAttributes(rawAttributes){
		if(!rawAttributes) return []
		return rawAttributes.match(/\[[^\]]+\]/g).map(ra => {
			ra = ra.slice(1, ra.length - 1) // remove brackets
			const key = ra.match(/[^=~+|*$\^]*/)[0] || ''
			const operator = ra.match(/[=~+|*$\^]+/)[0] || ''
			const value = ra.slice(key.length + operator.length)
			const caseInsensitive = value.endsWith(' i') || value.endsWith(' I')
			if(caseInsensitive) value = value.substring(0, value.length - 2).toLowerCase()
			return {
				key: key,
				operator: SelectorElement.ATTRIBUTE_TYPE_MAP.get(operator) || SelectorElement.ATTRIBUTE_EXISTS,
				value: value,
				caseInsensitive: caseInsensitive
			}
		})
	}

	/**
	:active
	::before
	@todo handle pseudos that are fuctions like :matches() and :not()
	*/
	_parsePseudos(rawPseudos){
		if(!rawPseudos) return []
		return rawPseudos.match(/:{1,2}[^:]+/g).map(pseudo => {
			if(pseudo.startsWith('::')){
				return {
					type: SelectorElement.PSEUDO_ELEMENT,
					value: pseudo.substring(2)
				}
			} else {
				return {
					type: SelectorElement.PSEUDO_CLASS,
					value: pseudo.substring(1)
				}
			}
		})
	}

	/**
	@return {Array[rawElements, rawAttributes, rawPseudos]}
	*/
	_splitRaw(){
		let rawElements = this.raw
		let rawAttributes = ''
		let rawPseudos = ''

		// Split out attributes
		const firstAttributeIndex = rawElements.indexOf('[')
		if(firstAttributeIndex !== -1){
			const lastAttributeIndex = rawElements.lastIndexOf(']')
			if(lastAttributeIndex === -1) throw new Error('Bad attributes', rawElements)
			rawAttributes = rawElements.substring(firstAttributeIndex, lastAttributeIndex + 1)
			rawElements = rawElements.slice(0, firstAttributeIndex) + rawElements.slice(lastAttributeIndex + 1)
		}

		// Split out pseudos
		const firstPseudoIndex = rawElements.indexOf(':')
		if(firstPseudoIndex !== -1){
			rawPseudos = rawElements.substring(firstPseudoIndex)
			rawElements = rawElements.slice(0, firstPseudoIndex)
		}

		return [rawElements, rawAttributes, rawPseudos]	
	}
}

SelectorElement.CLASS_ELEMENT = Symbol('class-element')
SelectorElement.ID_ELEMENT = Symbol('id-element')
SelectorElement.TAG_ELEMENT = Symbol('tag-element')
SelectorElement.WILDCARD_ELEMENT = Symbol('wildcard-element')

SelectorElement.ELEMENT_TYPES = [
	SelectorElement.CLASS_ELEMENT,
	SelectorElement.ID_ELEMENT,
	SelectorElement.TAG_ELEMENT,
	SelectorElement.WILDCARD_ELEMENT
]

SelectorElement.ATTRIBUTE_EXISTS = Symbol('declaration-attribute-exists')				// [attr]
SelectorElement.ATTRIBUTE_EQUALS = Symbol('declaration-attribute-equals')				// [attr=val]
SelectorElement.ATTRIBUTE_EQUALS_HYPHEN = Symbol('declaration-attribute-equals-hypen')	// [attr|=val]
SelectorElement.ATTRIBUTE_LISTED = Symbol('declaration-attribute-listed')				// [attr~=val]
SelectorElement.ATTRIBUTE_CONTAINS = Symbol('declaration-attribute-contains')			// [attr*=val]
SelectorElement.ATTRIBUTE_STARTS_WITH = Symbol('declaration-attribute-starts-with')		// [attr^=val]
SelectorElement.ATTRIBUTE_ENDS_WITH = Symbol('declaration-attribute-ends-with')			// [attr$=val]

SelectorElement.ATTRIBUTE_TYPES = [
	SelectorElement.ATTRIBUTE_EXISTS,
	SelectorElement.ATTRIBUTE_EQUALS,
	SelectorElement.ATTRIBUTE_EQUALS_HYPHEN,
	SelectorElement.ATTRIBUTE_LISTED,
	SelectorElement.ATTRIBUTE_CONTAINS,
	SelectorElement.ATTRIBUTE_STARTS_WITH,
	SelectorElement.ATTRIBUTE_ENDS_WITH
]

SelectorElement.ATTRIBUTE_TYPE_MAP = new Map([
	['', SelectorElement.ATTRIBUTE_EXISTS],
	['=', SelectorElement.ATTRIBUTE_EQUALS],
	['|=', SelectorElement.ATTRIBUTE_EQUALS_HYPHEN],
	['~=', SelectorElement.ATTRIBUTE_LISTED],
	['*=', SelectorElement.ATTRIBUTE_CONTAINS],
	['^=', SelectorElement.ATTRIBUTE_STARTS_WITH],
	['$=', SelectorElement.ATTRIBUTE_ENDS_WITH]
])

SelectorElement.PSEUDO_CLASS = Symbol('pseudo-class')
SelectorElement.PSEUDO_ELEMENT = Symbol('pseudo-element')

class Combinator extends SelectorFragment {
	constructor(rawFragment){
		super()
		this._raw = rawFragment
		this._type = Combinator.TYPES.find(t => this._raw === t) || Combinator.DESCENDANT
	}

	get raw(){ return this.raw }
	get type(){ return this._type }
}

Combinator.DESCENDANT = '>>'
Combinator.CHILD = '>'
Combinator.ADJACENT_SIBLING = '+'
Combinator.GENERAL_SIBLING = '~'

Combinator.TYPES = [
	Combinator.DESCENDANT,
	Combinator.CHILD,
	Combinator.ADJACENT_SIBLING,
	Combinator.GENERAL_SIBLING
]

class DeclarationList {
	constructor(declarations){
		this._declarations = declarations
	}
}

class Declaration {
	constructor(rawDeclaration){
		this._property = rawDeclaration.property
		this._value = rawDeclaration.value
	}

	get property(){ return this._property }
	get value(){ return this._value }
}

export default Stylesheet
export {
	Stylesheet,
	SelectorFragmentList, SelectorFragment,
	SelectorElement,
	Combinator,
	DeclarationList, Declaration
}