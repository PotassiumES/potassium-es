import Filter from 'action-input/src/filter/Filter'

import { throttledConsoleLog } from '../throttle.js'

/**
 * ActivePickFilter activates the action if the input is truthy.
 * More usefully, it sets a targetComponent parameter to null or a Potassium.Component that is picked.
 *
 * The filter parameter `pickPath` resolve to a THREE.RayCaster result
 * like { distance, point, face, faceIndex, object }
 */
export default class ActivePickFilter extends Filter {
	constructor(queryInputPath) {
		super()
		this._queryInputPath = queryInputPath
	}

	/** @return {string} a human readable name */
	get name(){ return 'ActivePickFilter' }

	/**
	 * @param {string} inputPath
	 * @param inputValue
	 * @param {string} filterPath
	 * @param {Object} filterParameters parameters for use while filtering
	 *
	 * @return {Array} [value, actionParameters]
	 */
	filter(inputPath, inputValue, filterPath, filterParameters) {
		return [!!inputValue, { targetComponent: this._getTarget(filterParameters.pickPath) }]
	}

	/** @return picked Potassium.Component or null */
	_getTarget(pickPath) {
		const pick = this._queryInputPath(pickPath)[0]
		if (pick === null) return null
		let obj = pick.object
		while (true) {
			if (obj.component) return obj.component
			if (!obj.parent) return null
			obj = obj.parent
		}
	}
}
