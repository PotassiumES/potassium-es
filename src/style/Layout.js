/**
Layout is the abstract base class for classes that track and apply layout information.
For example, the GridLayout is created when a node's `display` style is set to `grid`.
*/
class Layout {
	/**
	@param {Object3D} node the container node for this layout
	*/
	constructor(node) {
		this._node = node
	}

	/** @type {Object3D} the container node for this layout */
	get node() {
		return this._node
	}

	/**
	Runs the layout algorithm
	@abstract
	*/
	apply() {
		throw new Error('Not implemented')
	}
}

export default Layout
