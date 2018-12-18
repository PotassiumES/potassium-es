class RoundRectCurve {
	static generateCurve(width, height, radius) {
		const halfWidth = width / 2
		const halfHeight = height / 2
		radius = Math.min(radius, halfWidth / 2, halfHeight / 2)
		const diameter = 2 * radius

		const curvePath = new THREE.CurvePath()
		//  Top side
		curvePath.add(
			new THREE.LineCurve(
				new THREE.Vector2(-halfWidth + diameter, halfHeight),
				new THREE.Vector2(halfWidth - diameter, halfHeight)
			)
		)
		if (radius > 0) {
			// Top right corner
			curvePath.add(
				new THREE.QuadraticBezierCurve(
					new THREE.Vector2(halfWidth - diameter, halfHeight),
					new THREE.Vector2(halfWidth, halfHeight),
					new THREE.Vector2(halfWidth, halfHeight - diameter)
				)
			)
		}
		//  Right side
		curvePath.add(
			new THREE.LineCurve(
				new THREE.Vector2(halfWidth, halfHeight - diameter),
				new THREE.Vector2(halfWidth, -halfHeight + diameter)
			)
		)
		if (radius > 0) {
			// Bottom right corner
			curvePath.add(
				new THREE.QuadraticBezierCurve(
					new THREE.Vector2(halfWidth, -halfHeight + diameter),
					new THREE.Vector2(halfWidth, -halfHeight),
					new THREE.Vector2(halfWidth - diameter, -halfHeight)
				)
			)
		}
		//  Bottom side
		curvePath.add(
			new THREE.LineCurve(
				new THREE.Vector2(halfWidth - diameter, -halfHeight),
				new THREE.Vector2(-halfWidth + diameter, -halfHeight)
			)
		)
		if (radius > 0) {
			// Bottom left corner
			curvePath.add(
				new THREE.QuadraticBezierCurve(
					new THREE.Vector2(-halfWidth + diameter, -halfHeight),
					new THREE.Vector2(-halfWidth, -halfHeight),
					new THREE.Vector2(-halfWidth, -halfHeight + diameter)
				)
			)
		}
		//  Left side
		curvePath.add(
			new THREE.LineCurve(
				new THREE.Vector2(-halfWidth, -halfHeight + diameter),
				new THREE.Vector2(-halfWidth, halfHeight - diameter)
			)
		)
		if (radius > 0) {
			// Bottom left corner
			curvePath.add(
				new THREE.QuadraticBezierCurve(
					new THREE.Vector2(-halfWidth, halfHeight - diameter),
					new THREE.Vector2(-halfWidth, halfHeight),
					new THREE.Vector2(-halfWidth + diameter, halfHeight)
				)
			)
		}
		return curvePath
	}
}

export default RoundRectCurve
