/**
A list of {Declaration}s
*/
class DeclarationList {
	constructor(declarations) {
		this._declarations = declarations
	}
}

DeclarationList.prototype[Symbol.iterator] = function*() {
	for (const declaration of this._declarations) yield declaration
}

/**
A KSS declaration with a property, value, and importance.

Example serialized declarations:

- font-size: 12em !important;
- background-color: var(--super-green)

*/
class Declaration {
	constructor(rawDeclaration) {
		this._property = rawDeclaration.property
		this._value = rawDeclaration.value
		this._important = rawDeclaration.important === true
	}

	/** @return {string} */
	get raw() {
		return `${this.property}: ${this.value};`
	}

	get property() {
		return this._property
	}
	set property(val) {
		this._property = val
	}

	get value() {
		return this._value
	}
	set value(val) {
		this._value = val
	}

	get important() {
		return this._important
	}
	set important(val) {
		this._important = !!val
	}

	reset(property, value, important = false) {
		this._property = property
		this._value = value
		this._important = important
	}
}

export default Declaration

export { Declaration, DeclarationList }
