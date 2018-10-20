import Layout from './Layout.js'
import Evaluators from './Evaluators.js'

/**
GridLayout implements a subset of the full CSS grid layout.

Container declarations:

	- display
		grid

	- grid-template
		20cm 40cm / 40cm 60cm

	- gap
		4cm
		4cm 6cm

	- grid-auto-flow:
		row
		column

	- grid-auto-columns or grid-auto-rows
		20cm

Item declarations:

	- grid-column or grid-row
		1
		1 / 3
		1 / span 2
*/
class GridLayout extends Layout {
	/**
	@param {Object3D} node the container node for this layout
	*/
	constructor(node) {
		super(node)
		this._grid = new Grid(node)
		this.updateFromNodeStyles()
	}

	updateFromNodeStyles() {
		const gridTemplateStyleInfo = this.node.computedStyles.get('grid-template')
		if (gridTemplateStyleInfo) {
			const directions = _parseGridTemplate(gridTemplateStyleInfo.value, this.node)
			if (directions && (directions.length === 1 || directions.length === 2)) {
				this._grid.updateTemplate(directions)
			} else {
				console.error('Could not parse grid template', gridTemplateStyleInfo)
			}
		}

		const autoFlowStyleInfo = this.node.computedStyles.get('grid-auto-flow')
		if (autoFlowStyleInfo) {
			this._grid._autoFlow = autoFlowStyleInfo.value === 'column' ? Grid.Column : Grid.Row
		}

		const autoFlowStyleName = this._grid._autoFlow === Grid.Row ? 'grid-auto-rows' : 'grid-auto-columns'
		const autoFlowSizeStyleInfo = this.node.computedStyles.get(autoFlowStyleName)
		if (autoFlowSizeStyleInfo) {
			const autoFlowSize = Evaluators.parse(autoFlowSizeStyleInfo.value, this.node)
			if (typeof autoFlowSize === 'undefined') {
				console.error(`Could not parse ${autoFlowStyleName}`, autoFlowSizeStyleInfo)
			} else {
				this._grid._autoFlowSize = autoFlowSize[0]
			}
		}

		const gapStyleInfo = this.node.computedStyles.get('gap')
		if (gapStyleInfo) {
			const gapSizes = Evaluators.parse(gapStyleInfo.value, this.node)
			if (typeof gapSizes === 'undefined' || gapSizes.length < 1) {
				console.error('Could not parse gap', gapStyleInfo)
			} else {
				this._grid._rowGap = gapSizes[0]
				this._grid._columnGap = gapSizes.length === 1 ? gapSizes[0] : gapSizes[1]
			}
		}
	}

	apply() {
		this._grid.apply()
	}

	/** @type {bool} */
	get isGrid() {
		return true
	}

	prettyPrint() {
		this._grid.prettyPrint()
	}
}

const DefaultCellSize = 0.02 // meters
const DefaultGapSize = 0.01 // meters

class Grid {
	/**
	@param {Object3D} node - the grid container
	*/
	constructor(node) {
		this._node = node
		this._rowCellSizes = [DefaultCellSize]
		this._columnCellSizes = [DefaultCellSize]
		this._autoFlow = Grid.Row
		this._autoFlowSize = DefaultCellSize
		this._rowGap = DefaultGapSize // meters
		this._columnGap = DefaultGapSize // meters
	}

	prettyPrint() {
		console.log('Grid')
		console.log('\tautoflow', this._autoFlow === Grid.Row ? 'row' : 'column', this._autoFlowSize)
		console.log('\trow cells:', ...this._rowCellSizes)
		console.log('\trow gap', this._rowGap)
		console.log('\tcolumn cells:', ...this._columnCellSizes)
		console.log('\tcolumn gap', this._columnGap)
	}

	updateTemplate(directions) {
		if (directions.length === 0 || directions.some(direction => direction.length === 0)) {
			console.error('Could not use grid-template', directions)
			return
		}
		// The first direction is the row cell sizes, so copy it
		this._rowCellSizes = directions[0].slice(0)
		if (directions.length === 1) {
			// If only one direction is specified, then copy rows to columns
			this._columnCellSizes = this._rowCellSizes.slice(0)
		} else {
			this._columnCellSizes = directions[1].slice(0)
		}
	}

	/**
	@param {number[]} cellSizes - an array of sizes in meters of either cell rows or cell columns
	@param {number} gap - the distance between the cells 
	@return {number} the distance from the center of the first cell to the center of the last cell
	*/
	_calculateCenterToCenterSize(cellSizes, gap) {
		if (cellSizes.length < 2) return 0
		let result = 0
		for (let i = 0; i < cellSizes.length; i++) {
			if (i === 0 || i === cellSizes.length - 1) {
				result += cellSizes[i] / 2
			} else {
				result += cellSizes[i]
			}
			if (i !== 0) {
				result += gap
			}
		}
		return result
	}

	/**
	Generates the positions for an arbitrary number of grid children using specified cell positions and then auto positions

	@param {number} count - the number of child nodes for which positions are needed
	@return {Array<number[]>} returns an array of x,y tuples, one for each position
	*/
	_positions(count) {
		/*
		The autoflow is the major track and the other flow is the minor track
		*/
		const majorCellSizes = this._autoFlow === Grid.Row ? this._rowCellSizes : this._columnCellSizes
		const minorCellSizes = this._autoFlow === Grid.Row ? this._columnCellSizes : this._rowCellSizes

		const majorGap = this._autoFlow === Grid.Row ? this._rowGap : this._columnGap
		const minorGap = this._autoFlow === Grid.Row ? this._columnGap : this._rowGap

		// Get starting center position for major and minor tracks
		const gridCenterToCenterWidth = this._calculateCenterToCenterSize(this._columnCellSizes, this._columnGap)
		const gridCenterToCenterHeight = this._calculateCenterToCenterSize(this._rowCellSizes, this._rowGap)
		const majorStart = (this._autoFlow === Grid.Row ? gridCenterToCenterHeight : gridCenterToCenterWidth) / -2
		const minorStart = (this._autoFlow === Grid.Row ? gridCenterToCenterWidth : gridCenterToCenterHeight) / -2

		// Rows move from top to bottom, which is -y
		// Columns move from left to right, which is +x
		// Set up the correct multipliers for major and minor
		const majorMultiplier = this._autoFlow === Grid.Row ? -1 : 1
		const minorMultiplier = this._autoFlow === Grid.Row ? 1 : -1

		const results = []

		// First get positions for explicit cells
		let majorPosition = majorStart
		let minorPosition = minorStart
		for (let majorIndex = 0; majorIndex < majorCellSizes.length; majorIndex++) {
			minorPosition = minorStart
			if (majorIndex !== 0) {
				// Move from major edge to major center
				majorPosition += (majorGap / 2 + majorCellSizes[majorIndex] / 2) * majorMultiplier
			}

			for (let minorIndex = 0; minorIndex < minorCellSizes.length; minorIndex++) {
				if (minorIndex !== 0) {
					// Move from minor edge to minor center
					minorPosition += (minorGap / 2 + minorCellSizes[minorIndex] / 2) * minorMultiplier
				}

				results.push(this._autoFlow === Grid.Row ? [minorPosition, majorPosition] : [majorPosition, minorPosition])

				// If count is less than the number of specific cells then return results
				if (results.length === count) {
					return results
				}
				// Move from minor center to minor edge
				minorPosition += (minorCellSizes[minorIndex] / 2 + minorGap / 2) * minorMultiplier
			}

			// Move from major center to major edge
			majorPosition += (majorCellSizes[majorIndex] / 2 + majorGap / 2) * majorMultiplier
		}
		// major and minor positions are now at the edges of the far corner cell of the explicit grid

		// Now get positions for auto-flow cells
		let remainingPositions = count - results.length
		let minorIndex = 0
		majorPosition += (this._autoFlowSize / 2 + majorGap / 2) * majorMultiplier
		while (remainingPositions > 0) {
			if (minorIndex === 0) {
				minorPosition = minorStart
			} else {
				minorPosition += (minorCellSizes[minorIndex] / 2 + minorGap / 2) * minorMultiplier
			}

			results.push(this._autoFlow === Grid.Row ? [minorPosition, majorPosition] : [majorPosition, minorPosition])

			minorPosition += (minorCellSizes[minorIndex] / 2 + minorGap / 2) * minorMultiplier
			minorIndex = (minorIndex + 1) % minorCellSizes.length
			remainingPositions -= 1
			if (minorIndex === 0) {
				majorPosition += (this._autoFlowSize + majorGap) * majorMultiplier
			}
		}
		return results
	}

	apply() {
		if(this._node.children.length === 0) return
		let childIndex = 0
		this._positions(this._node.children.length).forEach(position => {
			this._node.children[childIndex].position.set(...position, 0)
			childIndex += 1
		})
	}
}

Grid.Row = Symbol('grid-row')
Grid.Column = Symbol('grid-column')

const _parseGridTemplate = function(rawValue, node) {
	const directions = rawValue
		.split('/')
		.filter(half => half.trim().length > 0)
		.map(half => Evaluators.parse(half, node))
	if (directions.some(direction => typeof direction === 'undefined')) return undefined
	return directions
}

export default GridLayout
