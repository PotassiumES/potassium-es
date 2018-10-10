
/**
A class that offers a unified API for attributes on an Object3D. 
Some attributes (listed in Attributes.PassThroughAttributes) are stored as class attributes on Object3D
The other attributes are stored in Object3D.userData
*/
class Attributes {
	constructor(node){
		this._node = node
	}

	has(attribute){
		if(Attributes.PassThroughAttributes.includes(attribute)){
			return typeof this._node[attribute] !== 'undefined'
		}
		return typeof this_node.userData[attribute] !== 'undefined'
	}

	/**
	@param {string} attribute texting is case insensitive!
	*/
	get(attribute, defaultValue){
		if(Attributes.PassThroughAttributes.includes(attribute)){
			if(typeof this._node[attribute] === 'undefined') return defaultValue
			return this._node[attribute]
		}
		if(typeof this._node.userData[attribute] === 'undefined') return defaultValue
		return this._node.userData[attribute]
	}

	set(attribute, value){
		if(Attributes.PassThroughAttributes.includes(attribute)){
			this._node[attribute] = value
		} else {
			this._node.userData[attribute] = value
		}
	}
}

/**
Attributes that are stored as class attributes on the Object3D and not in Object3D.userData
*/
Attributes.PassThroughAttributes = [
	'name',
	'type',
	'visible'
]

export default Attributes