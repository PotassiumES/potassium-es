import EventHandler from './EventHandler.js'

const LinkRelativeType = 'spatial-stylesheet'

/**
Stylist takes the KSS derived JSON emitted by [postcss-potassium] and applies it to a Three.js Scene 
*/
const Stylist = class extends EventHandler {
	constructor(){
		super()

		this._kssData = []
	}

	/**
	Called before rendering a THREE.Scene, applyStyles updates the scene to match the styles defined by KSS
	*/
	applyStyles(node){
		/** @todo actually apply the styles */

		// Traverse the tree and update each node's computed styles data structure

		// Apply visual styles

		// Perform layout

		// Apply animations

	}

	/**
	Looks in the document for one or more `link` elements with a `rel` attribute of `spatial-stylesheet` and then attempts to load them as KSS data
	For example:
		<head>
			<link rel='spatial-stylesheet' href='./path/to/styles.json'>
		</head>
	*/
	async loadLinks(){
		let links = document.getElementsByTagName('link')
		for(let i=0; i < links.length; i++){
			if(links[i].getAttribute('rel') !== LinkRelativeType) continue
			if(!links[i].getAttribute('href')) continue
			try {
				const response = await fetch(links[i].getAttribute('href'))
				const kssData = await response.json()
				this.load(kssData)
			} catch (err){
				console.error(`Could not load kss link: ${links[i].getAttribute('href')}`, err)
			}
		}
		this.trigger(Stylist.LINKS_LOADED_EVENT, this)
	}

	load(kssData){
		this._populateKSS(kssData)
		this._kssData.push(kssData)
		this.trigger(Stylist.KSS_LOADED_EVENT, this)
	}

	_populateKSS(kssData){
		for(let rule of kssData.rules){
			rule.selectors = this._parseSelectors(rule.selectors)
			rule.declarations = this._parseDeclarations(rule.declarations)
		}
	}

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

Stylist.LINKS_LOADED_EVENT = 'stylist-links-loaded'
Stylist.KSS_LOADED_EVENT = 'stylist-kss-loaded'

export default Stylist

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
		this._elements = this._splitElements(rawElements)

		/** @type {Array[Object{ key, operator, value }]} */
		this._attributes = this._splitAttributes(rawAttributes)

		/** @type {Array[Object{ type { SelectorElement.PSEUDO_CLASS | SelectorElement.PSEUDO_ELEMENT }, value, parameters[]:[] }]} */
		this._pseudos = this._splitPseudos(rawPseudos)
	}

	/** @type {string} */
	get raw() { return this._raw }

	/**
	@return {bool}
	*/
	matches(node){

	}

	_splitElements(rawElements){
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

	_splitAttributes(rawAttributes){
		if(!rawAttributes) return []
		return rawAttributes.match(/\[[^\]]+\]/g).map(ra => {
			ra = ra.slice(1, ra.length - 1) // remove brackets
			const key = ra.match(/[^~=+|*$]*/)[0] || ''
			const operator = ra.match(/[~=+|*$]+/)[0] || ''
			const value = ra.slice(key.length + operator.length)
			return {
				key: key,
				operator: operator,
				value: value
			}
		})
	}

	/**
	:active
	::before
	@todo handle pseudos that are fuctions like :matches() and :not()
	*/
	_splitPseudos(rawPseudos){
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

SelectorElement.PSEUDO_CLASS = Symbol('pseudo-class')
SelectorElement.PSEUDO_ELEMENT = Symbol('pseudo-element')

class Combinator extends SelectorFragment {
	constructor(rawFragment){
		super()
		this._raw = rawFragment
		this._type = Combinator.TYPES.find(t => this._raw === t) || null
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
		this._raw = rawDeclaration
	}
}
