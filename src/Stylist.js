import Stylesheet from './Stylesheet.js'
import EventHandler from './EventHandler.js'

const LinkRelativeType = 'spatial-stylesheet'

/**
Stylist takes the KSS derived JSON emitted by [postcss-potassium] and applies it to a Three.js Scene 
*/
const Stylist = class extends EventHandler {
	constructor(){
		super()

		this._stylesheets = []
	}

	get stylesheets(){ return this._stylesheets }

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
				this.loadData(kssData)
			} catch (err){
				console.error(`Could not load kss link: ${links[i].getAttribute('href')}`, err)
			}
		}
		this.trigger(Stylist.LINKS_LOADED_EVENT, this)
	}

	loadData(kssData){
		const stylesheet = new Stylesheet(kssData)
		this._stylesheets.push(stylesheet)
		this.trigger(Stylist.KSS_LOADED_EVENT, this, stylesheet)
	}
}

Stylist.LINKS_LOADED_EVENT = 'stylist-links-loaded'
Stylist.KSS_LOADED_EVENT = 'stylist-kss-loaded'

export default Stylist

