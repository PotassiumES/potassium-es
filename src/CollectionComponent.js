import el from './El.js'
import graph from './Graph.js'
import Component from './Component.js'
import DataObject from './DataObject.js'
import DataCollection from './DataCollection.js'

/**
DefaultItemComponent is used by CollectionComponent if no itemComponent option is passed
*/
const DefaultItemComponent = class extends Component {
	constructor(dataObject = null, options = {}) {
		super(dataObject, Object.assign({ flatEl: el.li() }, options))
		if (dataObject instanceof DataObject === false) throw 'DefaultItemComponent requires a dataObject'
		this.addClass('default-item-component')
		this.flatEl.appendChild(el.span('Item: ' + dataObject))
		this.portalEl.appendChild(el.span('Item: ' + dataObject))
		this.portalGraph.add(graph.text('Item: ' + dataObject))
		this.immersiveGraph.add(graph.text('Item: ' + dataObject))
	}
}

/**
CollectionComponent provides a generic list UI for DataCollections.

@param {DataObject} [dataObject=null]
@param {Object} [options={}]
@param {Component} [options.itemComponent=DefaultItemComponent] a Component class used to render each item in this list
@param {Object} [options.itemOptions] a set of options to pass to each item Component
@param {function} [options.onClick] a function to call with the dataObject whose item Component is clicked
*/
const CollectionComponent = class extends Component {
	constructor(dataObject = null, options = {}) {
		super(
			dataObject,
			Object.assign(
				{
					flatEl: el.ul(),
					portalEl: el.ul(),
					itemGraphHeight: 0.3
				},
				options
			)
		)
		this.addClass('collection-component')
		if (dataObject instanceof DataCollection === false) throw 'CollectionComponent requires a DataCollection dataObject'
		this._inGroupChange = false // True while resetting or other group change
		this._dataObjectComponents = new Map() // dataObject.id -> Component

		this.dataObject.addListener((...params) => {
			this._handleCollectionReset(...params)
		}, 'reset')
		this.dataObject.addListener((...params) => {
			this._handleCollectionAdded(...params)
		}, 'added')
		if (this.dataObject.isNew === false) {
			this._handleCollectionReset()
		}
	}
	at(index) {
		// Returns the Component at index, or null if index is out of bounds
		if (index < 0) return null
		if (index >= this.flatEl.children.length) return null
		return this.flatEl.children.item(index).component
	}
	componentForDataObject(dataObject) {
		return this._dataObjectComponents.get(dataObject.get('id'))
	}
	filter(filterFn = null) {
		// filterFn must accept a DataModel and return a boolean indicating whether its Component.flatEl.style.display should be set to '' or 'none'
		for (let [i, itemComponent] of this._dataObjectComponents) {
			if (typeof filterFn === 'function') {
				var display = filterFn(itemComponent.dataObject)
			} else {
				var display = true
			}
			itemComponent.flatEl.style.display = display ? '' : 'none'
			itemComponent.portalEl.style.display = display ? '' : 'none'
			itemComponent.portalGraph.visible = display
			itemComponent.immersiveGraph.visible = display
		}
		this._layoutGraph()
	}
	_layoutGraph() {
		let y = 0
		for (let [id, component] of this._dataObjectComponents) {
			if (component.visible === false) continue
			component.portalGraph.position.set(component.portalGraph.position.x, y, component.portalGraph.position.z)
			component.immersiveGraph.position.set(component.immersiveGraph.position.x, y, component.immersiveGraph.position.z)
			y -= this.options.itemGraphHeight
		}
	}
	_handleCollectionAdded(eventName, collection, dataObject) {
		this._add(this._createItemComponent(dataObject))
	}
	_handleCollectionRemoved(eventName, collection, dataObject) {
		let component = this.componentForDataObject(dataObject)
		if (component) {
			this._remove(component)
		}
	}
	_handleCollectionReset(eventName, target) {
		if (target !== this.dataObject) return // It was a reset for an item in the collection, not the collection itself
		this._inGroupChange = true
		this.trigger(CollectionComponent.Resetting, this)
		for (let [_, itemComponent] of this._dataObjectComponents) {
			this._remove(itemComponent)
		}
		this._dataObjectComponents.clear()
		for (let dataObject of this.dataObject) {
			this._add(this._createItemComponent(dataObject))
		}
		this._inGroupChange = false
		this._layoutGraph()
		this.trigger(CollectionComponent.Reset, this)
	}
	_handleItemClick(ev, itemComponent) {
		if (this.options.onClick) {
			ev.preventDefault()
			this.options.onClick(itemComponent.dataObject)
		}
	}
	_add(itemComponent) {
		if (this._dataObjectComponents.get(itemComponent.dataObject.get('id'))) {
			// Already have it, ignore the add
			return
		}
		this._dataObjectComponents.set(itemComponent.dataObject.get('id'), itemComponent)

		this.appendComponent(itemComponent)
		// TODO switch to action-input
		if (this.options.onClick) {
			itemComponent.flatEl.addEventListener('click', ev => {
				this._handleItemClick(ev, itemComponent)
			})
		}

		if (this._inGroupChange === false) this._layoutGraph()

		itemComponent.dataObject.addListener(this._handleDeleted.bind(this), 'deleted', true)
	}
	_remove(itemComponent) {
		this._dataObjectComponents.delete(itemComponent.dataObject.get('id'))
		this.removeComponent(itemComponent)
		itemComponent.flatEl.removeEventListener('click', null)
		itemComponent.portalEl.removeEventListener('click', null)
		itemComponent.cleanup()

		if (this._inGroupChange === false) this._layoutGraph()
	}
	_handleDeleted(eventName, dataObject, error) {
		if (error) return
		let component = this._dataObjectComponents.get(dataObject.get('id'))
		if (component) {
			this._remove(component)
		}
	}
	_createItemComponent(itemDataObject) {
		if (this.options.itemOptions) {
			var options = Object.assign({}, this.options.itemOptions)
		} else {
			var options = {}
		}
		if (this.options.itemComponent) {
			var itemComponent = new this.options.itemComponent(itemDataObject, options)
		} else {
			var itemComponent = new DefaultItemComponent(itemDataObject, options)
		}
		itemComponent.addClass('collection-item')
		itemComponent.addClass('collection-item')
		return itemComponent
	}
}
CollectionComponent.Resetting = 'collection-component-resetting'
CollectionComponent.Reset = 'collection-component-reset'

export default CollectionComponent
