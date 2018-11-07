import EventHandler from './EventHandler.js'

let Singleton = null
let MonthNames = null // [locale, [names]]
let DateFieldOrder = null


const TestDateMilliseconds = 1517385600000

/**
Localizer provides the functionality necessary to:

- pick a string translation based on language
- format dates based on locale and time zone

@todo detect language, locale, and timezone
@todo load translations
*/
const Localizer = class extends EventHandler {
	constructor() {
		super()
		/** @type {Map<{string},{Translation}>} */
		this._translations = new Map()
		this._defaultLocales = navigator.languages ? navigator.languages : [navigator.language]
		this._defaultTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

		this._dateTimeFormatter = new Intl.DateTimeFormat(this._defaultLocales)
	}

	get defaultLocales() {
		return this._defaultLocales
	}

	get defaultTimeZone() {
		return this._defaultTimeZone
	}

	translate(key, defaultValue = null) {
		const translation = this._translations.get(key)
		if (!translation) return defaultValue !== null ? defaultValue : key
		const value = translation.get(key)
		if (!value) return defaultValue !== null ? defaultValue : key
		return value
	}

	get monthNames() {
		if (MonthNames === null || MonthNames[0] !== this._defaultLocales[0]) {
			MonthNames = []
			MonthNames[0] = this._defaultLocales
			MonthNames[1] = []
			const options = {
				month: 'long'
			}
			const date = new Date()
			date.setDate(1)
			for (let i = 0; i < 12; i++) {
				date.setMonth(i)
				MonthNames[1].push(date.toLocaleString(this._defaultLocales, options))
			}
		}
		return MonthNames[1]
	}

	/**
	Different locales order their dates in various ways: mm/dd/yyyy or yyyy.mm.dd or 2012년 12월 20일 목요일
	@return {string[]} - a length 3 array of 'day', 'month', and 'year' in the order that this locale renders date fields
	*/
	get dateFieldOrder(){
		if(DateFieldOrder !== null) return DateFieldOrder

		if(typeof this._dateTimeFormatter.formatToParts === 'function'){
			DateFieldOrder = this._dateTimeFormatter.formatToParts(new Date(), {
				year: 'numeric',
				month: 'numeric',
				day: 'numeric'
			}).filter(part => part.type !== 'literal').map(part => part.type)
			console.log('dfo', DateFieldOrder)
			return DateFieldOrder
		}

		// Ok the correct but less supported function is not there, try this hack
		const tokens = new Date(TestDateMilliseconds).toLocaleDateString(this._defaultLocales, {
			day: 'numeric',
			month: 'numeric',
			year: 'numeric'
		}).split(/[\/ \.]/).filter(token => token.trim().length > 0)
		let monthIndex = 0
		let yearIndex = 0
		for(let i=1; i < 3; i++){
			if(tokens[i].length < tokens[monthIndex].length) monthIndex = i
			if(tokens[i].length > tokens[yearIndex].length) yearIndex = i
		}
		DateFieldOrder = []
		DateFieldOrder[monthIndex] = 'month'
		DateFieldOrder[yearIndex] =  'year'
		for(let i=0; i < 3; i++){
			if(!DateFieldOrder[i]){
				DateFieldOrder[i] = 'day'
				break
			}
		}
		return DateFieldOrder
	}

	formatDateObject(date, options) {
		return date.toLocaleDateString(this._defaultLocales, options)
	}

	formatDate(date, long = false, options = null) {
		return this.formatDateObject(
			date,
			options || {
				year: 'numeric',
				month: long ? 'long' : 'numeric',
				day: 'numeric'
			}
		)
	}

	formatDateTime(date, long = false, options = null) {
		return this.formatDateObject(
			date,
			options || {
				hour: 'numeric',
				minute: 'numeric',
				second: 'numeric',
				hour12: false,
				timeZone: this._defaultTimeZone,
				year: 'numeric',
				month: long ? 'long' : 'numeric',
				day: 'numeric'
			}
		)
	}

	static get Singleton() {
		if (Singleton === null) {
			Singleton = new Localizer()
		}
		return Singleton
	}
}

/**
Translation holds a map of source phrases to translated phrases in a given language
*/
const Translation = class {
	constructor(language) {
		this._language = language
		/** @type {Map<{string} key, {string} value>} */
		this._map = new Map()
	}
	get language() {
		return this._language
	}

	get(key) {
		return this._map.get(key)
	}
}

/**
A shorthand function for getting a translation

@param {string} key the source phrase, like 'Hello!'
@param {string} [defaultValue=null] the value to return if there is no translation
@return {string} a translation, like '¡Hola!'
*/
function lt(key, defaultValue) {
	return Localizer.Singleton.translate(key, defaultValue)
}

/**
A shorthand function for getting a localized date

@param {Date} date
@param {bool} [long=true]
@param {options} [options=null]
@return {string} a localized string representing the date
*/
function ld(date, long = true, options = null) {
	return Localizer.Singleton.formatDate(date, long, options)
}

/**
A shorthand function for getting a localized date and time

@param {Date} date
@param {bool} [long=true]
@param {options} [options=null]
@return {string} a localized string representing the date and time
*/
function ldt(date, long = true, options = null) {
	return Localizer.Singleton.formatDateTime(date, long, options)
}

/**
A shorthand function for getting a localized date or time string using your own options
@see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/toLocaleString

@param {Date} date
@param {options} [options=null]
@return {string} a localized string representing the date
*/
function ldo(date, options = null) {
	return Localizer.Singleton.formatDateObject(date, options)
}

export default Localizer
export { Localizer, Translation, lt, ld, ldt, ldo }
