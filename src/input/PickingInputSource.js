import InputSource from 'action-input/src/input/InputSource'

/**
 *  PickingInputSource is used by {@link App} to track 3D objects that are:
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
	@param {Array} [result=null]
	@return [active, value]
	*/
	queryInputPath(partialPath, result = null) {
		if (result === null) result = new Array(2)
		switch (partialPath) {
			case '/mouse':
				result[0] = !!this._mouse
				result[1] = this._mouse
				return result
			case '/touch':
				result[0] = !!this._touch
				result[1] = this._touch
				return result
			case '/gaze':
				result[0] = !!this._gaze
				result[1] = this._gaze
				return result
			case '/left':
				result[0] = !!this._left
				result[1] = this._left
				return result
			case '/right':
				result[0] = !!this._right
				result[1] = this._right
				return result
			default:
				result[0] = false
				result[1] = null
				return result
		}
	}
}
