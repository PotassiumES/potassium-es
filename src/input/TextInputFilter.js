import Filter from 'action-input/src/filter/Filter'

/**
 * TextInputFilter
 */
export default class TextInputFilter extends Filter {
	constructor() {
		super()
	}

	/** @return {string} a human readable name */
	get name() {
		return 'TextInputFilter'
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
		if (inputActive === false) {
			results[0] = false
			results[1] = null
			return results
		}
		results[0] = true
		results[1] = inputValue
		return results
	}
}
