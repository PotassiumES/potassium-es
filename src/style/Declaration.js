
class DeclarationList {
	constructor(declarations){
		this._declarations = declarations
	}

}

DeclarationList.prototype[Symbol.iterator] = function*(){
	for(let declaration of this._declarations) yield declaration
}

class Declaration {
	constructor(rawDeclaration){
		this._property = rawDeclaration.property
		this._value = rawDeclaration.value
		this._important = rawDeclaration.important === true
	}

	get property(){ return this._property }
	get value(){ return this._value }
	get important(){ return this._important }
}

// Don't forget that --variables are also inherited!
Declaration.InheritedProperties = [
	'border-collapse',
	'border-spacing',
	'caption-side',
	'color',
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

export {
	Declaration,
	DeclarationList
}