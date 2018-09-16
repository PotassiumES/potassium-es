/**
AudioManager manages audio for all {@link Component}s.
*/
const AudioManager = class {
	constructor(){
		this._audioContext = new (window.AudioContext || window.webkitAudioContext)
		this._sounds = new Map() // name {string} => 
	}

	setSound(name, url){
		if(this._sounds.has(name)){
			this._sounds.get(name).cleanup()
		}
		this._sounds.set(name, new SoundInfo(name, url, this._audioContext))
	}

	playSound(name){
		if(this._sounds.has(name) === false){
			console.error('No such sound', name)
			return
		}
		// TODO spatially mix sounds based on Component pose
		this._sounds.get(name).play()
	}
}

export default AudioManager

/**
SoundInfo holds the information about a sound as well as its Audio element and WebAudio AudioNode
*/
const SoundInfo = class {
	constructor(name, url, audioContext){
		this.name = name
		this.url = url
		this.audio = new Audio(url)
		this.source = audioContext.createMediaElementSource(this.audio)
		this.source.connect(audioContext.destination)
	}
	play(){
		this.audio.play()
	}
	cleanup(){
		this.source.disconnect()
	}
}