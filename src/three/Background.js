import { Mesh, MeshStandardMaterial, BufferGeometry, BufferAttribute, DoubleSide } from 'three/src/Three.js'

import RoundRectCurve from './RoundRectCurve.js'

/**
Background extends THREE.Mesh (an Object3D) and is used to render a background panel for a Three node.
Unlike the DOM's background, this Background is designed to float a few centimeters behind the node's BorderLine.
*/
function Background(width = 0, height = 0, radius = [0, 0, 0, 0]) {
	Mesh.call(
		this,
		new BackgroundGeometry(width, height, radius),
		new MeshStandardMaterial({
			side: DoubleSide
		}),
		undefined
	)
	this.name = 'Background'
	// Shadow SOM nodes are ignored during some layout calculations
	this.shadowSOM = true
}
Background.prototype = Object.create(Mesh.prototype)
Background.prototype.constructor = Background

function BackgroundGeometry(width = 0, height = 0, radius = [0, 0, 0, 0]) {
	BufferGeometry.call(this)
	this.setParams(width, height, radius)
}
BackgroundGeometry.prototype = Object.create(BufferGeometry.prototype)
BackgroundGeometry.prototype.constructor = BackgroundGeometry

BackgroundGeometry.CurveDivisions = 15

Object.defineProperty(BackgroundGeometry.prototype, 'width', {
	get: function() {
		return this._width
	},
	set: function(val) {
		if (val < 0) return
		this.setParams(val, this._height, this._radius)
	}
})

Object.defineProperty(BackgroundGeometry.prototype, 'height', {
	get: function() {
		return this._height
	},
	set: function(val) {
		if (val < 0) return
		this.setParams(this._width, val, this._radius)
	}
})

Object.defineProperty(BackgroundGeometry.prototype, 'radius', {
	get: function() {
		return this._radius
	},
	set: function(val) {
		if (val < 0) return
		this.setParams(this._width, this._height, val)
	}
})

BackgroundGeometry.prototype.setContentSize = function(width, height) {
	this.setParams(width, height, this._radius)
}

BackgroundGeometry.prototype.setParams = function(width, height, radius) {
	if (this._width === width && this._height === height && this._radius === radius) return
	this._width = Math.max(0, width)
	this._height = Math.max(0, height)
	this._radius = Math.max(0, radius[0]) // TODO handle per-corner radius values
	this._updatePoints()
}

BackgroundGeometry.prototype._updatePoints = function() {
	this.clearGroups()
	this.removeAttribute('position')

	if (this._width <= 0 || this._height <= 0) return

	const points = RoundRectCurve.generateCurve(this._width, this._height, this._radius).getPoints(
		BackgroundGeometry.CurveDivisions
	)
	const pointsCount = points.length

	const positions = new Float32Array(pointsCount * 9) // 9 floats per triangle
	const push = (pointsIndex, start) => {
		positions.set([points[pointsIndex].x, points[pointsIndex].y, 0], start)
	}

	// Make one triangle per point
	for (let i = 0; i < pointsCount; i++) {
		const positionsIndex = i * 9 // 9 floats per triangle
		push((i + 1) % pointsCount, positionsIndex)
		positions.set([0, 0, 0], positionsIndex + 3)
		push(i, positionsIndex + 6)
	}
	this.addAttribute('position', new BufferAttribute(positions, 3))
}

export default Background
export { Background, BackgroundGeometry }
