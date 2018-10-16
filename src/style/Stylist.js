import Stylesheet from './Stylesheet.js'
import Applicators from './Applicators.js'
import EventHandler from '../EventHandler.js'

const LinkRelativeType = 'spatial-stylesheet'

/**
Stylist takes the KSS derived JSON emitted by [postcss-potassium](https://github.com/PotassiumES/postcss-potassium) and applies it to a Three.js Scene 
*/
const Stylist = class extends EventHandler {
	constructor() {
		super()

		this._stylesheets = []
	}

	get stylesheets() {
		return this._stylesheets
	}

	/**
	Annotate each node in the scene with applicable direct or cascaded KSS-defined styles
	*/
	calculateStyles(scene) {
		const dirtyNodes = []
		scene.traverseDepthFirst(node => {
			if (node.layoutIsDirty) {
				node.matchingRules.splice(0, node.matchingRules.length)
				node.localStyles.clear()
				dirtyNodes.push(node)
			}
		})

		for (const node of dirtyNodes) {
			// Update each node's local styles
			for (const stylesheet of this._stylesheets) {
				stylesheet.updateLocalStyles(node, false)
			}
			node.layoutIsDirty = false
		}

		this._computeCascade(scene)
	}

	/**
	Apply the styles previously calculated in `calculateStyles` to the scene
	*/
	applyStyles(scene, renderer) {
		// Apply per-element styles
		scene.traverse(node => {
			this._updateNodeStyles(node, renderer)
		})

		// Perform layout
		scene.traverseDepthFirst(node => {
			if (node.layout) {
				node.layout.apply()
			}
		})

		/** @todo Apply animations */
	}

	_calculateAndApplyStyles(scene, renderer) {
		this.calculateStyles(scene)
		this.applyStyles(scene, renderer)
	}

	/**
	Looks in the document for one or more `link` elements with a `rel` attribute of `spatial-stylesheet` and then attempts to load them as KSS data
	For example:
		<head>
			<link rel='spatial-stylesheet' href='./path/to/styles.json'>
		</head>
	*/
	async loadLinks() {
		const links = document.getElementsByTagName('link')
		for (let i = 0; i < links.length; i++) {
			if (links[i].getAttribute('rel') !== LinkRelativeType) continue
			if (!links[i].getAttribute('href')) continue
			try {
				const response = await fetch(links[i].getAttribute('href'))
				const kssData = await response.json()
				this.loadData(kssData)
			} catch (err) {
				console.error(`Could not load kss link: ${links[i].getAttribute('href')}`, err)
			}
		}
		this.trigger(Stylist.LINKS_LOADED_EVENT, this)
	}

	loadData(kssData) {
		const stylesheet = new Stylesheet(kssData)
		this._stylesheets.push(stylesheet)
		// Set the load order index to use when breaking cascade precedence ties
		stylesheet.loadIndex = this._stylesheets.length - 1
		this.trigger(Stylist.KSS_LOADED_EVENT, this, stylesheet)
	}

	_updateNodeStyles(node, renderer) {
		for (const changedProperty of node.computedStyles.changes) {
			if (changedProperty.startsWith('--')) continue
			// @todo merge properties like `border` and `border-top`
			const applicatorFunction = Applicators.get(changedProperty) || null
			if (applicatorFunction === null) continue
			applicatorFunction(node, node.computedStyles.get(changedProperty), renderer)
		}
	}

	/**
	Traverse the graph and update each Object3D.computedStyles to reflect the local and inherited properties
	*/
	_computeCascade(node) {
		node.computedStyles.computeStyles(
			node.assignedStyles,
			node.localStyles,
			node.parent ? node.parent.computedStyles : null
		)
		for (const child of node.children) this._computeCascade(child)
	}
}

Stylist.LINKS_LOADED_EVENT = 'stylist-links-loaded'
Stylist.KSS_LOADED_EVENT = 'stylist-kss-loaded'

export default Stylist
