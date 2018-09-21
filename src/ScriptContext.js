/**
These are helper functions that plumb the stack track of a Javascript Error to provide information about the calling script's URL.

The original MIT licensed code for this came from Stewart Smith:
https://github.com/stewdio/getScriptContext.js
*/

/**
A helper function that returns just the URL of the calling script
See getScriptContext for info on how this works. 

@example
import {getScriptURL} from './ScriptContext.js'
const url = getScriptURL(new Error) // `https://some-domain/path/to/script.js` 

@param {Error} err a JS Error created *in the script for which you want context*
@return {string} url of the script in which the err Error was created
*/
function getScriptURL(err){
	return getScriptContext(err).location.href
}

/**
A helper function that returns the path and name of the calling script
See getScriptContext for info on how this works. 

@example
import {getScriptPathname} from './ScriptContext.js'
const path = getScriptPathname(new Error) // '/path/to/script.js'

@param {Error} err a JS Error created *in the script for which you want context*
@return {string} path/name like `/path/to/script.js` of the script in which the err Error was created
*/
function getScriptPathname(err){
	return getScriptContext(err).location.pathname
}

/**
A helper function that returns just path
See getScriptContext for info on how this works. 

@example
import {getScriptPath} from './ScriptContext.js'
const path = getScriptPath(new Error) // '/path/to/' (does not include the script name)

@param {Error} err a JS Error created *in the script for which you want context*
@return {string} path like `/path/to/` of the script in which the err Error was created, but not the script name itself
*/
function getScriptPath(err){
	return getScriptContext(err).location.path
}


/**
When the browser encounters an error it creates an “Error Stack”
which contains within it the location where the error ocurred
right down to the file’s URL, line number, and character. 
This means a script can know its source code’s URL
and we can even pass arguments through the URL itself!
Hold on to your hats because this is JSONP without the server!!
We must call “new Error()” in the file we want to inspect the
context of, and then pass that as an argument into here:

@example
import {getScriptContext} from './ScriptContext.js'
const context = getScriptContext(new Error)
console.log('url', context.url)  // {string} URL of this script

@param {Error} err a JS Error created *in the script for which you want context*
@return {Object}
*/
function getScriptContext(err){
	const context = {}	// Package everything into a “context” object.

	// The error object is regular old human-readable text.
	// We’re going to have to pull it apart to get what we’re after.

	const errorMessage = err.stack
	const stop   = errorMessage.lastIndexOf(':')
	const start  = errorMessage.substring(0, stop).lastIndexOf(':')
	const column = errorMessage.substring(stop + 1, errorMessage.length - 1)
	const line   = errorMessage.substring(start + 1, stop)

	let url = errorMessage.substring(errorMessage.indexOf('//'), errorMessage.lastIndexOf(':'))
	url = url.substring(0, url.lastIndexOf(':'))

	// We need to extract the search params from 
	// the URL used to load this particular JS file.
	// But might also be nice to just hold on to
	// all of that location info too, eh?
	const parser = document.createElement('a')
	parser.href = url
	context.location = {
		href:     parser.href,      // 'http://example.com:8080/pathname/with/slashes/index.html?search=kittens#hash'
		origin:   parser.origin,    // 'http://'
		protocol: parser.protocol,  // 'http:'
		host:     parser.host,      // 'example.com:8080'
		hostname: parser.hostname,  // 'example.com'
		port:     parser.port,      // '8080'
		pathname: parser.pathname,  // '/path/with/slashes/name.js'
		path:     parser.pathname.substring(0, parser.pathname.lastIndexOf('/') + 1), // '/path/with/slashes/'
		search:   parser.search,    // '?search=kittens'
		hash:     parser.hash,      // '#hash'
		line:     line,             // '14'
		column:   column            // '37'
	}

	// We’ve possibly placed arguments in the search string
	// which we need to extract and attach to our return object.
	// Right now we’re only worried about parser.search
	// and not parser.hash because Chrome seems to strip out
	// hashes from JavaScript includes. Why? Meh.
	context.data = {}
	if(parser.search){
		search = parser.search
		if(search.substr(0, 1) === '?') search = search.substr(1)
		search.replace(/\?/g, '&')
		pairs = search.split('&')
		pairs.forEach(function(pair){
			pair = pair.split('=')
			if(pair[1].indexOf(',') > -1)
				context.data[pair[0]] = pair[1].split(',')
			else context.data[pair[0]] = pair[1]
		})
	}

	return context
}

export {getScriptContext, getScriptURL, getScriptPathname, getScriptPath}





