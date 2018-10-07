import Stylesheet from './Stylesheet.js'
import Applicators from './Applicators.js'
import EventHandler from '../EventHandler.js'

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
		node.traverse(nd => {
			/** @todo cache unchanged data instead of repeating work */
			nd.matchingRules.splice(0, nd.matchingRules.length)
			nd.localStyles.clear()
		})

		// Refresh each node's styles
		for(let stylesheet of this._stylesheets){
			stylesheet.updateLocalStyles(node)
		}

		// Compute the cascade with initial and inherited values
		this._computeCascade(node)

		// Apply per-element styles
		node.traverse(nd => {
			this._updateNodeStyles(nd)
		})

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
		// Set the load order index to use when breaking cascade precedence ties
		stylesheet.loadIndex = this._stylesheets.length - 1
		this.trigger(Stylist.KSS_LOADED_EVENT, this, stylesheet)
	}

	_updateNodeStyles(node){
		for(let changedProperty of node.computedStyles.changes){
			// @todo calculate variables
			if(changedProperty.startsWith('--')) continue
			// @todo merge properties like `border` and `border-top`
			const applicatorFunction = Applicators.get(changedProperty) || null
			if(applicatorFunction === null) continue
			applicatorFunction(node, node.computedStyles.get(changedProperty))
		}
	}

	/**
	Traverse the graph and update each Object3D.computedStyles to reflect the local and inherited properties
	*/
	_computeCascade(node){
		node.computedStyles.computeStyles(node.localStyles, node.parent ? node.parent.computedStyles : null)
		for(let child of node.children) this._computeCascade(child)
	}

	_logStyles(node, tabDepth=0, showVars=false){
		const tabs = _generateTabs(tabDepth)
		console.log(tabs + '>', (node.name || 'unnamed') + ':',  node.getClasses().map(clazz => `.${clazz}`).join(''))
		for(let styleInfo of node.computedStyles){
			if(showVars === false && styleInfo.property.startsWith('--')) continue
			console.log(tabs + '\t' + styleInfo.property + ':', styleInfo.value, styleInfo.important ? '!important' : '')
		}
		for(let child of node.children) this._logStyles(child, tabDepth + 1, showVars)
	}
}

function _generateTabs(depth){
	if(depth === 0) return ''
	const result = []
	result[depth - 1] = null
	return result.fill('\t').join('')
}

Stylist.LINKS_LOADED_EVENT = 'stylist-links-loaded'
Stylist.KSS_LOADED_EVENT = 'stylist-kss-loaded'

export default Stylist

