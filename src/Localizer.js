import EventHandler from "./EventHandler.js"

let Singleton = null
let MonthNames = null // [locale, [names]]
/**
Localizer provides the functionality necessary to:
- pick a string translation based on language
- format dates based on locale and time zone
*/
const Localizer = class extends EventHandler {
	constructor(defaultLanguage='en', defaultLocale='en-US', defaultTimeZone='America/Los_Angeles'){
		super()
		/** @type {Map<{string},{Translation}>} */
		this._translations = new Map()
		this._defaultLanguage = defaultLanguage
		this._defaultLocale = defaultLocale
		this._defaultTimeZone = defaultTimeZone
	}

	get defaultLanguage(){ return this._defaultLanguage }
	get defaultLocale(){ return this._defaultLocale }
	get defaultTimeZone(){ return this._defaultTimeZone }

	translate(key, defaultValue=null){
		const translation = this._translations.get(key)
		if(!translation) return defaultValue !== null ? defaultValue : key
		const value = translation.get(key)
		if(!value) return defaultValue !== null ? defaultValue : key
		return value
	}

	get monthNames() {
		if(MonthNames === null || MonthNames[0] !== this._defaultLocale){
			MonthNames = []
			MonthNames[0] = this._defaultLocale
			MonthNames[1] = []
			const options = {
				month: 'long'
			}
			const date = new Date()
			date.setDate(1)
			for(let i=0; i < 12; i++){
				date.setMonth(i)
				MonthNames[1].push(date.toLocaleString(this._defaultLocale, options))
			}
		}
		return MonthNames[1]
	}

	formatDateObject(date, options){
		return date.toLocaleString(this._defaultLocale, options)
	}

	formatDate(date, long=false, options=null){
		return this.formatDateObject(date, options || {
			year: 'numeric',
			month: long ? 'long' : 'numeric',
			day: 'numeric'
		})
	}

	formatDateTime(date, long=false, options=null){
		return this.formatDateObject(date, options || {
			hour: 'numeric',
			minute: 'numeric',
			second: 'numeric',
			hour12: false,
			timeZone: this._defaultTimeZone,
			year: 'numeric',
			month: long ? 'long' : 'numeric',
			day: 'numeric'
		})
	}

	static get Singleton(){
		if(Singleton === null){
			/** @todo detect language, locale, and timezone */
			/** @todo load translations */
			Singleton = new Localizer()

		}
		return Singleton
	}
}

const Translation = class {
	constructor(language){
		this._language = language
		/** @type {Map<{string} key, {string} value>} */
		this._map = new Map()
	}
	get language(){ return this._language }

	get(key){
		return this._map.get(key)
	}
}

function lt(key, defaultValue){ return Localizer.Singleton.translate(key, defaultValue) }

function ld(date, long=true, options=null){ return Localizer.Singleton.formatDate(date, long, options) }

function ldt(date, long=true, options=null){ return Localizer.Singleton.formatDateTime(date, long, options) }

function ldo(date, options=null){ return Localizer.Singleton.formatDateObject(date, options) }

export {Localizer, Translation, lt, ld, ldt, ldo}