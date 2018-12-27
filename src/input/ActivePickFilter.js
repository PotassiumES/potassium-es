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
	get name() {
		return 'ActivePickFilter'
	}

	/**
	 * @param {string} inputPath
	 * @param {boolean} inputActive
	 * @param inputValue
	 * @param {string} filterPath
	 * @param {Object} filterParameters parameters for use while filtering
	 *
	 * @return {Array} [active, value]
	 */
	filter(inputPath, inputActive, inputValue, filterPath, filterParameters, results = null) {
		if (results === null) results = new Array(2)
		results[0] = inputActive
		results[1] = this._getTarget(filterParameters.pickPath)
		return results
	}

	/** @return picked Potassium.Component or null */
	_getTarget(pickPath) {
		this._queryInputPath(pickPath, _workingQueryResult)
		if (_workingQueryResult[0] === false) return null
		if (!_workingQueryResult[1] || !_workingQueryResult[1].object) return null
		return _workingQueryResult[1].object.getComponent()
	}
}

const _workingQueryResult = new Array(2)
