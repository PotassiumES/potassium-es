import Filter from 'action-input/src/filter/Filter'

/**
 * TextInputFilter
 */
export default class TextInputFilter extends Filter {
	constructor() {
		super()
	}

	/** @return {string} a human readable name */
	get name(){ return 'TextInputFilter' }

	/**
	 * @param {string} inputPath
	 * @param inputValue
	 * @param {string} filterPath
	 * @param {Object} filterParameters parameters for use while filtering
	 *
	 * @return {Array} [value, actionParameters]
	 */
	filter(inputPath, inputValue, filterPath, filterParameters) {
		if (!inputValue) return [null, null]
		return [true, { value: inputValue }]
	}
}
