import som from '../SOM.js'
import InputSource from 'action-input/src/input/InputSource'

/**
 *  TextInputSource receives events from {@link TextInputReceiver} and makes them available as an InputSource
 *
 *  /*|0/commands - an array of strings like ["A", "B"]
 */
export default class TextInputSource extends InputSource {
	constructor() {
		super()

		this._commands = null
	}

	/** @return {string} a human readable name */
	get name() {
		return 'TextInputSource'
	}

	receiveCommand(command) {
		if (this._commands === null) {
			this._commands = []
		}
		this._commands.push(command)
	}

	/**
	@param {string} partialPath the relative semantic path for an input
	@return [active, value]
	*/
	queryInputPath(partialPath, result = null) {
		if (result === null) result = new Array(2)
		const tokens = partialPath.substring(1).split('/')
		if (tokens.length !== 1) {
			result[0] = false
			result[1] = null
			return result
		}
		switch (tokens[0]) {
			case 'commands':
				if (this._commands === null) {
					result[0] = false
					result[1] = null
					return result
				}
				result[0] = true
				result[1] = this._commands
				this._commands = null
				return result
			default:
				result[0] = false
				result[1] = null
				return null
		}
	}
}
