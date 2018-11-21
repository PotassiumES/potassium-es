/**
StyleInfo holds the context for a declaration:
- the matched selector
- the stylesheet
- the rule
*/
class StyleInfo {
	constructor(declaration, selector = null, stylesheet = null, rule = null) {
		this._declaration = declaration
		this.selector = selector
		this.stylesheet = stylesheet
		this.rule = rule
	}

	get property() {
		return this._declaration.property
	}
	get value() {
		return this._declaration.value
	}
	get important() {
		return this._declaration.important
	}

	reset(property, value, important = false) {
		this._declaration.property = property
		this._declaration.value = value
		this._declaration.important = important
	}

	toString() {
		return this.property + ': ' + this.value + (this.important ? ' !important' : '')
	}
}

/**
A sort comparator that sorts {StyleInfo}s from most to least important/specific/load-order
*/
const styleInfoComparator = function(info1, info2) {
	// Important truth is lesser for the sort
	if (info1.important !== info2.important) {
		return info1.important === true ? -1 : 1
	}

	// Not having a selector means that it's an assigned style and thus highly specific
	if (info1.selector === null && info2.selector !== null) {
		return -1
	}
	if (info1.selector !== null && info2.selector === null) {
		return 1
	}

	// Greater specificity is lesser for the sort
	if (info1.selector !== null && info2.selector !== null) {
		if (info1.selector.specificity !== info2.selector.specificity) {
			return info1.selector.specificity > info2.selector.specificity ? -1 : 1
		}
	}

	// Greater stylesheet load index is lesser for the sort
	if (
		info1.stylesheet !== null &&
		info2.stylesheet !== null &&
		info1.stylesheet.loadIndex !== info2.stylesheet.loadIndex
	) {
		return info1.loadIndex > info2.loadIndex ? -1 : 1
	}
	// Greater rule load index is lesser for the sort
	if (info1.rule !== null && info2.rule !== null && info1.rule.index !== info2.rule.index) {
		return info1.rule.index > info2.rule.index ? -1 : 1
	}
	return 0
}

export default StyleInfo

export { StyleInfo, styleInfoComparator }
