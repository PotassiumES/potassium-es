
/**
SelectorFragmentList is a list of SelectorElements and Combinators (which both extend SelectorFragment)
Example strings that represent a selector fragment list:

Single selector elements:
- .class
- #id
- tag

Multiple selector elements:
- tag .class .another-class

Multiple elements with explicit combinators
- tag > .class:active + .another-class

*/
class SelectorFragmentList {
	constructor(selectorFragments){
		// Selectors in reversed order from how they are written
		this._reversedFragments = selectorFragments.reverse()
		this._specificity = this._calculateSpecificity()
	}

	/**
	@see [Cascade on MDN](https://developer.mozilla.org/en-US/docs/Learn/CSS/Introduction_to_CSS/Cascade_and_inheritance)
	@return {float} 
	*/
	get specificity(){ return this._specificity }

	/**
	Go through the list of selectors and combinators and check whether this node matches
	@param {THREE.Object3D} node
	@param {int} fragmentIndex the index in the reversed list of fragments at which to start
	@return {bool}
	*/
	matches(node, fragmentIndex=0){
		if(fragmentIndex < 0 || fragmentIndex >= this._reversedFragments.length){
			console.error('Invalid fragmentIndex', fragmentIndex, node, this)
			return false
		}
		let fragment = this._reversedFragments[fragmentIndex]

		// Handle a combinator
		if(fragment instanceof Combinator){
			// Refuse if there is a combinator but no following element
			if(fragmentIndex + 1 >= this._reversedFragments.length) return false
			// Refuse if there are two combinators in a row
			if(this._reversedFragments[fragmentIndex + 1] instanceof Combinator) return false

			switch(fragment.type){
				case Combinator.DESCENDANT:
					// Run up the ancestors until you either match or reach the root
					let parent = node.parent
					let parentMatched = false
					while(parent !== null){
						if(this.matches(parent, fragmentIndex + 1)){
							parentMatched = true
							break
						} else {
							parent = parent.parent
						}
					}
					// Refuse if the descendent match failed
					if(parentMatched === false) return false
					// Accept if there are no more fragments after the post-combinator fragment
					if(fragmentIndex + 2 >= this._reversedFragments.length) return true
					// Refuse if this is the root but there are more fragments to match
					if(parent.parent === null) return false
					// Move on to the parent and next fragment
					return this.matches(parent.parent, fragmentIndex + 2)

				case Combinator.CHILD:
					// Refuse if the node is the root, which fails this combinator
					if(node.parent === null) return false
					// Test the parent against the next fragment
					return this.matches(node.parent, fragmentIndex + 1)

				case Combinator.ADJACENT_SIBLING:
					// Refuse if the node is the root, which fails this combinator
					if(node.parent === null) return false
					// Refuse if there are no siblings
					if(node.parent.children.length === 1) return false
					const thisNodeIndex = node.parent.children.indexOf(node)
					// Refuse if there is no next sibling
					if(thisNodeIndex + 1 >= node.parent.children.length) return false
					const nextSibling = node.parent.children[thisNodeIndex + 1]
					return this.matches(nextSibling, fragmentIndex + 1)

				case Combinator.GENERAL_SIBLING:
					// Refuse if the node is the root, which fails this combinator
					if(node.parent === null) return false
					// Refuse if there are no siblings
					if(node.parent.children.length === 1) return false
					const siblings = node.parent.children.filter(child => child !== node)
					for(let i=0; i < siblings.length; i++){
						if(this.matches(siblings[i], fragmentIndex + 1)){
							return true
						}
					}
					return false

				default:
					console.error('Unknown combinator type', fragment.type)
					return false
			}
		} else {
			// Refuse if this node and SelectorElement don't match
			if(this._reversedFragments[fragmentIndex].matches(node) === false){
				return false
			}
			// Accept if there are no more fragments
			if(fragmentIndex === this._reversedFragments.length - 1) return true
			// Refuse if there are more fragments but this is the root
			if(node.parent === null) return false
			// Move on to the next ancestor and fragment
			return this.matches(node.parent, fragmentIndex + 1)
		}
	}

	/**
	Calculates the specificity of the overall list of selector fragments
	@return {number} specificity
	*/
	_calculateSpecificity(){
		// Hundreds: Score one in this column for each ID selector contained inside the overall selector.
		let hundredCount = 0
		// Tens: Score one in this column for each class selector, attribute selector, or pseudo-class contained inside the overall selector.
		let tenCount = 0
		// Ones: Score one in this column for each element selector or pseudo-element contained inside the overall selector.
		let oneCount = 0

		for(let fragment of this._reversedFragments){
			if(fragment instanceof Combinator) continue
			// IDs
			hundredCount += fragment._elements.filter(element => element.type === SelectorElement.ID_ELEMENT).length
			// Classes
			tenCount += fragment._elements.filter(element => element.type === SelectorElement.CLASS_ELEMENT).length
			// Attributes
			tenCount += fragment._attributes.length
			// Pseudo-classes
			tenCount += fragment._pseudos.filter(pseudo => pseudo.type === SelectorElement.PSEUDO_CLASS).length
			// Elements
			oneCount += fragment._elements.filter(element => element.type === SelectorElement.TAG_ELEMENT).length
			// Pseudo-elements
			oneCount += fragment._pseudos.filter(pseudo => pseudo.type === SelectorElement.PSEUDO_ELEMENT).length
		}
		return (100 * hundredCount) + (10 * tenCount) + oneCount
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
	div#id.group.dinkus-moon[foo=23][bar^="glitz grease"][blatz]::after:first

Note: combinators like '>>', '>', '+', and '~' are represented by the {Combinator} class, not this class
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
		// Refuse if any element does not match
		if(this._elements.some(element => {
			return this._elementMatches(element, node) === false
		})) return false

		// Refuse if any attribute does not match
		if(this._attributes.some(attribute => {
			return this._attributeMatches(attribute, node) === false
		})) return false

		// Refuse if any pseudo does not match
		if(this._pseudos.some(pseudo => {
			return this._pseudoMatches(pseudo, node) === false
		})) return false

		return true
	}

	/**
	@param {Object<type:SelectorElement.ELEMENT_TYPES, value:string>} element
	@param {THREE.Object3D} node
	@return {bool}
	*/
	_elementMatches(element, node){
		switch(element.type){
			case SelectorElement.CLASS_ELEMENT:
				return this._classMatches(element.value, node)
			case SelectorElement.ID_ELEMENT:
				return this._idMatches(element.value, node)
			case SelectorElement.TAG_ELEMENT:
				return this._tagMatches(element.value, node)
			case SelectorElement.WILDCARD_ELEMENT:
				return true
			default:
				console.error('Unknown element type', element)
				return false
		}
	}

	_attributeMatches(attribute, node){
		return false
	}

	_pseudoMatches(pseudo, node){
		return false
	}

	_tagMatches(tag, node){
		const checkFunction = SelectorElement.TAG_CHECK_FUNCTIONS.get(tag) || null
		if(!checkFunction) return false
		return checkFunction(node)
	}

	_idMatches(id, node){
		return node.userData.id === id
	}

	_classMatches(className, node){
		return node.hasClass(className)
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

function _intercaseTag(tag){
	return tag.toLowerCase().split('-').map((token, index) => {
		if(token.length === 0) return ''
		return token.substring(0, 1).toUpperCase() + token.substring(1)
	}).join('')
}

function _createCheckFunction(tag){
	const attribute = `is${_intercaseTag(tag)}`
	return function(node){
		return node[attribute] === true
	}
}

const SpatialTags = [
	'scene',
	'node',
	'group',

	'bone',
	'line',
	'line-loop',
	'line-segments',
	'lod',
	'mesh',
	'points',
	'skeleton',
	'skinned-mesh',
	'sprite',

	'ambient-light',
	'directional-light',
	'hemisphere-light',
	'light',
	'point-light',
	'rect-area-light',
	'spot-light'
]

/**
Maps a spatial tag name like 'scene' to a function that returns true if it's the named node (like a THREE.SCENE)
*/
SelectorElement.TAG_CHECK_FUNCTIONS = new Map()
for(let tag of SpatialTags){
	SelectorElement.TAG_CHECK_FUNCTIONS.set(
		tag, _createCheckFunction(tag)
	)
}

/**
Combinator represents a relationship between two {SelectorElement}s, like descendance or sibling.

In a raw selector, a combinator can be a space or `>>`, `>`, `+`, or `~`
*/
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

export {
	SelectorFragment,
	SelectorFragmentList,
	SelectorElement,
	Combinator,
	SpatialTags
}
