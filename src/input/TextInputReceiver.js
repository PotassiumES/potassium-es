import TextInputSource from './TextInputSource.js'

/**
TextInputReceiver is used by {@link Component} to route text input commands from components to the {@link TextInputSource}
*/
export default class TextInputReceiver {
	constructor() {
		this.textInputSource = new TextInputSource()
	}

	sendTextCommand(command) {
		this.textInputSource.receiveCommand(command)
	}
}
