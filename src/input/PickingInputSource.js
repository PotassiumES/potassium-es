import InputSource from 'action-input/src/input/InputSource'

/**
 *  PickingInputSource is used by App to track 3D objects that are:
 *  - pointed at by hands
 *  - looked at by gaze
 *  - hovered over by a mouse
 *  - touched on a touchscreen
 *
 *  The input values are either null or an intersect object returned by Three.RayCaster:
 *  { distance, point, face, faceIndex, object }
 */
export default class PickingInputSource extends InputSource {
	constructor() {
		super()
		// The next five variables are null or intersect objects from RayCaster
		this._mouse = null
		this._touch = null
		this._gaze = null
		this._left = null
		this._right = null
	}

	/** @return {string} a human readable name */
	get name() {
		return 'PickingInputSource'
	}

	clearIntersectObjects() {
		this._mouse = this._touch = this._gaze = this._left = this._right = null
	}

	// Values are set from within the rAF callback of Engines
	set mouse(value) {
		this._mouse = value
	}
	get mouse() {
		return this._mouse
	}
	set touch(value) {
		this._touch = value
	}
	get touch() {
		return this._touch
	}
	set gaze(value) {
		this._gaze = value
	}
	get gaze() {
		return this._gaze
	}
	set left(value) {
		this._left = value
	}
	get left() {
		return this._left
	}
	set right(value) {
		this._right = value
	}
	get right() {
		return this._right
	}

	/**
	@param {string} partialPath the relative semantic path for an input
	@return the value of the the input, or null if the path does not exist
	*/
	queryInputPath(partialPath) {
		switch (partialPath) {
			case '/mouse':
				return this._mouse
			case '/touch':
				return this._touch
			case '/gaze':
				return this._gaze
			case '/left':
				return this._left
			case '/right':
				return this._right
			default:
				return null
		}
	}
}
