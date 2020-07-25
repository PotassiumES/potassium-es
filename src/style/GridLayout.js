import { Vector3 } from 'three/src/Three.js'

import Layout from './Layout.js'
import Evaluators from './Evaluators.js'

/**
GridLayout implements a subset of the full CSS grid layout.

Container declarations:

	- display
		grid

	- grid-template
		20cm 40cm / 40cm 60cm
		auto / 25cm auto auto

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
	}

	updateFromNodeStyles() {
		const gridTemplateStyleInfo = this.node.styles.computedStyles.get('grid-template')
		if (gridTemplateStyleInfo) {
			const directions = _parseGridTemplate(gridTemplateStyleInfo.value, this.node)
			if (directions && directions.length === 2) {
				this._grid.updateTemplate(directions)
			} else {
				console.error('Could not parse grid template', gridTemplateStyleInfo)
			}
		}

		const autoFlowStyleInfo = this.node.styles.computedStyles.get('grid-auto-flow')
		if (autoFlowStyleInfo) {
			this._grid._autoFlow = autoFlowStyleInfo.value === 'column' ? Grid.Column : Grid.Row
		}

		const autoFlowStyleName = this._grid._autoFlow === Grid.Row ? 'grid-auto-rows' : 'grid-auto-columns'
		const autoFlowSizeStyleInfo = this.node.styles.computedStyles.get(autoFlowStyleName)
		if (autoFlowSizeStyleInfo) {
			if (autoFlowSizeStyleInfo.value === 'auto') {
				this._grid._autoFlowSize = 'auto'
			} else {
				const autoFlowSize = Evaluators.parse(autoFlowSizeStyleInfo.value, this.node)
				if (typeof autoFlowSize === 'undefined') {
					console.error(`Could not parse ${autoFlowStyleName}`, autoFlowSizeStyleInfo)
				} else {
					this._grid._autoFlowSize = autoFlowSize[0]
				}
			}
		}

		const gapStyleInfo = this.node.styles.computedStyles.get('gap')
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

	prettyPrint() {
		this._grid.prettyPrint()
	}
}

GridLayout.prototype.isGridLayout = true

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
		this._autoFlowSize = 'auto'
		this._rowGap = DefaultGapSize // meters
		this._columnGap = DefaultGapSize // meters
	}

	log() {
		console.log('Grid')
		console.log('\tautoflow', this._autoFlow === Grid.Row ? 'row' : 'column', this._autoFlowSize)
		console.log('\trow cells:', ...this._rowCellSizes)
		console.log('\trow gap', this._rowGap)
		console.log('\tcolumn cells:', ...this._columnCellSizes)
		console.log('\tcolumn gap', this._columnGap)
	}

	updateTemplate(directions) {
		if (directions.length === 0 || directions.some((direction) => direction.length === 0)) {
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
	Sets the positions for this._node.children using assigned cell sizes and then autoflow sizes
	*/
	apply() {
		const childrenToLayout = this._node.children.filter((child) => {
			return (
				child.shadowSOM !== true && child.visible && child.styles.computedStyles.getString('position') !== 'absolute'
			)
		})
		if (childrenToLayout.length === 0) return

		// The autoflow is the major track and the other flow is the minor track
		const majorCellSizes = this._autoFlow === Grid.Row ? this._rowCellSizes : this._columnCellSizes
		const minorCellSizes = this._autoFlow === Grid.Row ? this._columnCellSizes : this._rowCellSizes

		const majorGap = this._autoFlow === Grid.Row ? this._rowGap : this._columnGap
		const minorGap = this._autoFlow === Grid.Row ? this._columnGap : this._rowGap

		// Rows move from top to bottom, which is -y
		// Columns move from left to right, which is +x
		// Set up the correct multipliers for major and minor
		const majorMultiplier = this._autoFlow === Grid.Row ? -1 : 1
		const minorMultiplier = this._autoFlow === Grid.Row ? 1 : -1

		// Find the count past which we're into autoflow
		const assignedCellCount = majorCellSizes.length * minorCellSizes.length

		// Create a 3D array: major/minor/sizes+child
		const computedSizes = new Array()
		let majorIndex = -1
		let minorIndex = 0
		let majorSize = 0
		for (let i = 0; i < childrenToLayout.length; i++) {
			minorIndex = i % minorCellSizes.length
			if (minorIndex === 0) {
				majorIndex += 1
			}
			if (computedSizes[majorIndex] === undefined) {
				computedSizes[majorIndex] = new Array(minorCellSizes.length)
			}
			computedSizes[majorIndex][minorIndex] = new Array(2) // major size, minor size
			computedSizes[majorIndex][minorIndex].child = childrenToLayout[i]

			childrenToLayout[i].styles.marginBounds.getSize(_workingVector3_1)
			_workingVector3_1.multiply(childrenToLayout[i].scale)

			// Use either the assigned major cell size or the autoflow size
			majorSize = i < assignedCellCount ? majorCellSizes[majorIndex] : this._autoFlowSize
			// Set major size for this cell
			if (majorSize === 'auto') {
				if (this._autoFlow === Grid.Row) {
					computedSizes[majorIndex][minorIndex][0] = _workingVector3_1.y
				} else {
					computedSizes[majorIndex][minorIndex][0] = _workingVector3_1.x
				}
			} else {
				computedSizes[majorIndex][minorIndex][0] = majorSize
			}
			// Set minor size
			if (minorCellSizes[minorIndex] === 'auto') {
				if (this._autoFlow === Grid.Row) {
					computedSizes[majorIndex][minorIndex][1] = _workingVector3_1.x
				} else {
					computedSizes[majorIndex][minorIndex][1] = _workingVector3_1.y
				}
			} else {
				computedSizes[majorIndex][minorIndex][1] = minorCellSizes[minorIndex]
			}
		}

		// Ok, cell sizes are calculated. Let's move some nodes!
		const majorArray = null
		let majorPosition = 0
		let majorMaxSize = 0
		let minorPosition = 0
		let minorArray = null
		let childInfo = null
		for (majorIndex = 0; majorIndex < computedSizes.length; majorIndex++) {
			minorArray = computedSizes[majorIndex]
			minorPosition = 0
			majorMaxSize = 0
			for (minorIndex = 0; minorIndex < minorArray.length; minorIndex++) {
				if (minorArray[minorIndex] === undefined) {
					break
				}
				childInfo = minorArray[minorIndex]
				if (this._autoFlow === Grid.Row) {
					childInfo.child.position.setX(minorPosition * minorMultiplier)
					childInfo.child.position.setY(majorPosition * majorMultiplier)
				} else {
					childInfo.child.position.setX(majorPosition * majorMultiplier)
					childInfo.child.position.setY(minorPosition * minorMultiplier)
				}
				majorMaxSize = Math.max(majorMaxSize, childInfo[0])
				minorPosition += minorArray[minorIndex][1] + minorGap
			}
			majorPosition += majorMaxSize + majorGap
		}
	}
}

Grid.Row = Symbol('grid-row')
Grid.Column = Symbol('grid-column')

const _workingVector3_1 = new Vector3()

const _parseGridTemplate = function (rawValue, node) {
	const evaledTemplate = Evaluators.parse(rawValue, node)
	if (evaledTemplate === null || evaledTemplate.length !== 2) {
		console.error('Error parsing grid template', rawValue, evaledTemplate)
		return null
	}
	return evaledTemplate
}

export default GridLayout
