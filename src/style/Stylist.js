import Stylesheet from './Stylesheet.js'
import Applicators from './Applicators.js'
import EventHandler from '../EventHandler.js'

import BoxLayout from './BoxLayout.js'
import { LayoutEffectingProperties } from './ComputedStyles.js'

/**
The 'rel' value of a KSS stylesheet link:
	<link rel="spatial-stylesheet" href="app.json">
*/
const LinkRelativeType = 'spatial-stylesheet'

/**
Stylist takes the KSS derived JSON emitted by [postcss-potassium](https://github.com/PotassiumES/postcss-potassium) and applies it to a Three.js Scene

For purposes of layout, a Spatial Object Model (SOM) node has:
- a optional THREE.Geometry
- edges: margin, border, and padding
- a {@link Layout}: right now, only GridLayout
- children

The layout algorithm is similar but not identical to CSS:

The KSS cascade is calculated so each SOM node's {@link ComputedStyles} is up to date.

In a depth-first traversal of all SOM nodes:
	If node.styles.geometryIsDirty:
		recalculate node.styles.geometryBounds

	If any of the dirty flags (geometry, hierarchy, layout) are true:
		perform layout using node.styles.geometryBounds and childrens' styles.marginBounds attributes
		recalculate edge bounds: content, padding, border, margin
	set dirty flags to false

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

	style(scene, renderer) {
		this._updateCount = 0

		this._updateLocalStyles(scene)

		this._updateComputedStyles(scene)

		this._applyStyles(scene, renderer)

		this._layout(scene)

		//if(this._updateCount > 0) console.log('updateCount', this._updateCount)
	}

	/**
	Traverse the graph and update each Object3D.styles.localStyles using the KSS stylesheets
	*/
	_updateLocalStyles(scene) {
		scene.traverse(node => {
			if (node.styles.needsStyleRefresh === false) return
			this._updateCount += 1

			node.styles.matchingRules.splice(0, node.styles.matchingRules.length)
			node.styles.localStyles.clear()

			for (const stylesheet of this._stylesheets) {
				stylesheet.updateLocalStyles(node)
			}
		})
	}

	/**
	Traverse the graph and update each Object3D.styles.computedStyles.
	Uses assigned, local, and cascade-inherited declarations set during _updateLocalStyles
	*/
	_updateComputedStyles(scene) {
		scene.traverse(node => {
			if (node.styles.needsStyleRefresh === false) return
			this._updateCount += 1

			node.styles.computedStyles.computeStyles(
				node.styles.assignedStyles,
				node.styles.localStyles,
				node.parent ? node.parent.styles.computedStyles : null
			)
		})
	}

	/**
	Traverse the graph and apply each node's computed styles
	*/
	_applyStyles(scene, renderer) {
		scene.traverse(node => {
			if (node.styles.needsStyleRefresh === false) return
			this._updateCount += 1

			for (const changedProperty of node.styles.computedStyles.changes) {
				// Variables are used but not applied
				if (changedProperty.startsWith('--')) continue

				const applicatorFunction = Applicators.get(changedProperty) || null
				if (applicatorFunction === null) continue

				// Recognized property, so apply it
				applicatorFunction(node, node.styles.computedStyles.get(changedProperty), renderer)

				// Set layout dirty up the graph if the property could effect the layout
				if (LayoutEffectingProperties.includes(changedProperty)) {
					node.styles.setAncestorsLayoutDirty()
				}
			}
		})
	}

	/**
	Lay out the graph
	*/
	_layout(scene) {
		scene.traverseDepthFirst(node => {
			if (node.visible === false) return
			if (node.styles.isInAnyWayDirty === false) return
			this._updateCount += 1

			if (node.styles.geometryIsDirty) {
				node.styles.calculateGeometryBounds()
			}

			// Layout just this node's geometry and children
			if (node.styles.layout) {
				node.styles.layout.updateFromNodeStyles()
				node.styles.layout.apply()
			}

			// Update the edge bounds of this node using the new layout size
			node.styles.calculateEdgeBounds()

			// Update the border and background
			node.styles.updateShadowSOM()

			node.styles.clearDirtyFlags()
		})
	}
}

const _boxLayout = new BoxLayout()

Stylist.LINKS_LOADED_EVENT = 'stylist-links-loaded'
Stylist.KSS_LOADED_EVENT = 'stylist-kss-loaded'

export default Stylist
