import graph from '../Graph.js'
import InputSource from 'action-input/src/input/InputSource'

/**
 *  VirtualKeyboardInputSource watches events on a Three.js based keyboard
 *
 *  /*|0/command
 */
export default class VirtualKeyboardInputSource extends InputSource {
	constructor() {
		super()

		this._leftIntersect = null
		this._rightIntersect = null

		this._command = null

		// TODO make this a portable asset, perhaps by embedding it in an ES module
		this.keyboardGroup = graph.obj('/static/potassium-es/models/Keyboard.obj', null, (...params) => {
			console.error('Could not load virtual keyboard OBJ', ...params)
		})
		this.keyboardGroup.name = 'virtual-keyboard'
	}

	/** @return {string} a human readable name */
	get name() {
		return 'VirtualKeyboardInputSource'
	}

	handleLeftActivate() {
		if (
			this._leftIntersect &&
			this._leftIntersect.object &&
			this._leftIntersect.object.parent &&
			this._leftIntersect.object.parent.parent === this.keyboardGroup
		) {
			this._command = this._leftIntersect.object.name
		}
	}

	handleRightActivate() {
		if (
			this._rightIntersect &&
			this._rightIntersect.object &&
			this._rightIntersect.object.parent &&
			this._rightIntersect.object.parent.parent === this.keyboardGroup
		) {
			this._command = this._rightIntersect.object.name
		}
	}

	handlePick(leftIntersect, rightIntersect) {
		this._leftIntersect = leftIntersect
		this._rightIntersect = rightIntersect
	}

	/**
	@param {string} partialPath the relative semantic path for an input
	@return the value of the the input, or null if the path does not exist
	*/
	queryInputPath(partialPath) {
		const tokens = partialPath.substring(1).split('/')
		if (tokens.length !== 1) return null
		switch (tokens[0]) {
			case 'command':
				const command = this._command
				this._command = null
				return command
			default:
				return null
		}
	}
}
