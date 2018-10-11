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
	Annotate each node in the scene with applicable direct or cascaded KSS-defined styles
	*/
	calculateStyles(scene){
		scene.traverse(nd => {
			/** @todo cache unchanged data instead of repeating work */
			nd.matchingRules.splice(0, nd.matchingRules.length)
			nd.localStyles.clear()
		})

		// Refresh each node's styles
		for(let stylesheet of this._stylesheets){
			stylesheet.updateLocalStyles(scene)
		}

		// Compute the cascade with initial and inherited values
		this._computeCascade(scene)
	}

	/**
	Apply the styles previously calculated in `calculateStyles` to the scene
	*/
	applyStyles(scene){
		// Apply per-element styles
		scene.traverse(nd => {
			this._updateNodeStyles(nd)
		})

		// Perform layout

		// Apply animations
	}

	_calculateAndApplyStyles(scene){
		this.calculateStyles(scene)
		this.applyStyles(scene)
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
		node.computedStyles.computeStyles(node.assignedStyles, node.localStyles, node.parent ? node.parent.computedStyles : null)
		for(let child of node.children) this._computeCascade(child)
	}

	/**
	logs to the console the computed styles for a node and its descendents
	@param {bool} showVars if true, log the CSS variables of the form `--name`
	*/
	logStyles(node, tabDepth=0, showVars=false, localsOnly=false){
		const tabs = _generateTabs(tabDepth)
		console.log(tabs + '>', (node.name || 'unnamed') + ':',  node.getClasses().map(clazz => `.${clazz}`).join(''))
		if(localsOnly){
			for(let styleInfo of node.localStyles){
				if(showVars === false && styleInfo.property.startsWith('--')) continue
				console.log(tabs + '\t' + styleInfo.property + ':', styleInfo.value, styleInfo.important ? '!important' : '')
			}
		} else {
			for(let styleInfo of node.computedStyles){
				if(showVars === false && styleInfo.property.startsWith('--')) continue
				console.log(tabs + '\t' + styleInfo.property + ':', styleInfo.value, styleInfo.important ? '!important' : '')
			}
		}
		for(let child of node.children) this.logStyles(child, tabDepth + 1, showVars)
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

