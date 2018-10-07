
class LocalStyles {
	constructor(){
		this._map = new Map()
	}

	// sorts each property array so that the highest weight in the cascade is first
	sort(){
		for(let [property, infos] of this._map){
			infos.sort(_infoComparator)
		}
	}

	add(declaration, selector, stylesheet, rule){
		const styleInfo = new StyleInfo(declaration, selector, stylesheet, rule)
		if(this._map.has(styleInfo.property) === false){
			this._map.set(styleInfo.property, [styleInfo])
			return
		}
		this._map.get(styleInfo.property).push(styleInfo)
	}

	getAll(property){
		return this._map.get(property) || []
	}

	getValue(property){
		const arr = this._map.get(property)
		if(!arr) return null
		return arr[0].value
	}

	delete(property){
		this._map.delete(property)
	}

	clear(){
		this._map.clear()
	}

	*[Symbol.iterator]() {
		for (let obj of this._map) {
			yield obj
		}
	}
}

class StyleInfo {
	constructor(declaration, selector, stylesheet, rule){
		this._declaration = declaration
		this.selector = selector
		this.stylesheet = stylesheet
		this.rule = rule
	}

	get property(){ return this._declaration.property }
	get value(){ return this._declaration.value }
	get important(){ return this._declaration.important }
}

/**
A sort comparator that sorts {StyleInfo}s from most important/specific/early-loaded to least
*/
const _infoComparator = function(info1, info2){
	if(info1.important !== info2.important){
		return info1.important === true ? -1 : 1
	}
	if(info1.selector.specificity !== info2.specificity){
		return info1.specificity > info2.specificity ? -1 : 1
	}
	if(info1.stylesheet.loadIndex !== info2.stylesheet.loadIndex){
		return info1.loadIndex < info2.loadIndex ? -1 : 1
	}
	if(info1.rule.index !== info2.rule.index){
		return info1.rule.index < info2.rule.index ? -1 : 1
	}
	return 0
}

export default LocalStyles