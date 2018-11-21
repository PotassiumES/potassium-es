import { StyleInfo, styleInfoComparator } from './StyleInfo.js'

class LocalStyles {
	constructor() {
		/** @type {Map<string, StyleInfo[]>} property => StyleInfo[] */
		this._map = new Map()
	}

	// sorts each property array so that the highest weight in the cascade is first
	sort() {
		for (const infos of this._map.values()) {
			infos.sort(styleInfoComparator)
		}
	}

	add(declaration, selector, stylesheet, rule) {
		const styleInfo = new StyleInfo(declaration, selector, stylesheet, rule)
		if (this._map.has(styleInfo.property) === false) {
			this._map.set(styleInfo.property, [styleInfo])
			return
		}
		this._map.get(styleInfo.property).push(styleInfo)
	}

	getAll(property) {
		return this._map.get(property) || []
	}

	getValue(property) {
		const arr = this._map.get(property)
		if (!arr) return null
		return arr[0].value
	}

	delete(property) {
		this._map.delete(property)
	}

	clear() {
		this._map.clear()
	}

	*[Symbol.iterator]() {
		for (const styleInfos of this._map.values()) {
			yield styleInfos[0]
		}
	}

	log(showVars = false) {
		for (const styleInfo of this) {
			if (showVars === false && styleInfo.property.startsWith('--')) continue
			console.log(styleInfo.toString())
		}
	}
}

export default LocalStyles
