/**
Handy generators for Three geometries
*/

import { BufferGeometry, Float32BufferAttribute } from 'three/src/Three.js'

function generateCubeGeometry(size) {
	const h = size * 0.5
	const geometry = new BufferGeometry()
	const position = []
	position.push(
		-h,
		-h,
		-h,
		-h,
		h,
		-h,

		-h,
		h,
		-h,
		h,
		h,
		-h,

		h,
		h,
		-h,
		h,
		-h,
		-h,

		h,
		-h,
		-h,
		-h,
		-h,
		-h,

		-h,
		-h,
		h,
		-h,
		h,
		h,

		-h,
		h,
		h,
		h,
		h,
		h,

		h,
		h,
		h,
		h,
		-h,
		h,

		h,
		-h,
		h,
		-h,
		-h,
		h,

		-h,
		-h,
		-h,
		-h,
		-h,
		h,

		-h,
		h,
		-h,
		-h,
		h,
		h,

		h,
		h,
		-h,
		h,
		h,
		h,

		h,
		-h,
		-h,
		h,
		-h,
		h
	)
	geometry.setAttribute('position', new Float32BufferAttribute(position, 3))
	return geometry
}

export { generateCubeGeometry }
