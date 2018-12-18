import RoundRectCurve from './RoundRectCurve.js'

/**
BorderLine extends THREE.Mesh (an Object3D) and is used to render the box border set by KSS
*/
function BorderLine(lineWidth = 0.01, width = 0, height = 0, radius = 0) {
	THREE.Mesh.call(
		this,
		new BorderGeometry(lineWidth, width, height, radius),
		new THREE.MeshStandardMaterial({
			side: THREE.DoubleSide
		}),
		undefined
	)
	this.name = 'BorderLine'
	// Shadow SOM nodes are ignored during some layout calculations
	this.shadowSOM = true
}
BorderLine.prototype = Object.create(THREE.Mesh.prototype)
BorderLine.prototype.constructor = BorderLine

function BorderGeometry(lineWidth = 0.01, width = 0, height = 0, radius = 0) {
	THREE.BufferGeometry.call(this)
	this.setParams(lineWidth, width, height, radius)
}
BorderGeometry.prototype = Object.create(THREE.BufferGeometry.prototype)
BorderGeometry.prototype.constructor = BorderGeometry

BorderGeometry.CurveDivisions = 15

Object.defineProperty(BorderGeometry.prototype, 'lineWidth', {
	get: function() {
		return this._lineWidth
	},
	set: function(val) {
		if (val < 0) return
		this.setParams(val, this._width, this._height, this._radius)
	}
})

Object.defineProperty(BorderGeometry.prototype, 'width', {
	get: function() {
		return this._width
	},
	set: function(val) {
		if (val < 0) return
		this.setParams(this._lineWidth, val, this._height, this._radius)
	}
})

Object.defineProperty(BorderGeometry.prototype, 'height', {
	get: function() {
		return this._height
	},
	set: function(val) {
		if (val < 0) return
		this.setParams(this._lineWidth, this._width, val, this._radius)
	}
})

Object.defineProperty(BorderGeometry.prototype, 'radius', {
	get: function() {
		return this._radius
	},
	set: function(val) {
		if (val < 0) return
		this.setParams(this._lineWidth, this._width, this._height, val)
	}
})

BorderGeometry.prototype.setContentSize = function(width, height) {
	this.setParams(this._lineWidth, width, height, this._radius)
}

BorderGeometry.prototype.setParams = function(lineWidth, width, height, radius) {
	if (this._lineWidth === lineWidth && this._width === width && this._height === height && this._radius === radius)
		return
	this._lineWidth = Math.max(0, lineWidth)
	this._width = Math.max(0, width)
	this._height = Math.max(0, height)
	this._radius = Math.max(0, radius)
	this._updatePoints()
}

BorderGeometry.prototype._updatePoints = function() {
	this.clearGroups()
	this.removeAttribute('position')

	if (this._lineWidth === 0) return

	const width = Math.max(this._width, 0.0001)
	const height = Math.max(this._height, 0.0001)

	const innerCurvePoints = RoundRectCurve.generateCurve(width, height, this._radius).getPoints(
		BorderGeometry.CurveDivisions
	)
	const outerCurvePoints = RoundRectCurve.generateCurve(
		width + this._lineWidth,
		height + this._lineWidth,
		this._radius
	).getPoints(BorderGeometry.CurveDivisions)
	const points = innerCurvePoints.concat(outerCurvePoints)

	const pointsCount = points.length
	const curvePointCount = innerCurvePoints.length
	const triangleCount = curvePointCount * 2 // two triangles per quad

	const push = (pointsIndex, start) => {
		positions.set([points[pointsIndex].x, points[pointsIndex].y, 0], start)
	}

	// Make two triangles per quad
	const positions = new Float32Array(triangleCount * 9) // three points per triangle
	for (let i = 0; i < curvePointCount; i++) {
		const positionsIndex = i * 18 // 9 floats per triangle
		push((i + 1) % curvePointCount, positionsIndex)
		push(i + curvePointCount, positionsIndex + 3)
		push(i, positionsIndex + 6)

		push(curvePointCount + ((i + 1) % curvePointCount), positionsIndex + 9)
		push(i + curvePointCount, positionsIndex + 12)
		push((i + 1) % curvePointCount, positionsIndex + 15)
	}
	this.addAttribute('position', new THREE.BufferAttribute(positions, 3))
}

export default BorderLine
export { BorderLine, BorderGeometry }
