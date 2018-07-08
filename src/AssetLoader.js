import EventHandler from './EventHandler.js'

/**
Handy class for holding Asset info like URL and loading state
*/
const AssetInfo = class {
	constructor(url){
		this._url = url
		this._state = AssetLoader.LOADING
		this._blob = null
		this._waitingResolveFunctions = []
	}
	get url(){ return this._url }
	get state(){ return this._state }
	get blob(){ return this._blob }
	set state(value){ this._state = value }

	async fetch(){
		try {
			const response = await fetch(this._url)
			this._state = response.status === 200 ? AssetLoader.LOADED : AssetLoader.FAILED
			if(this._state === AssetLoader.LOADED){
				this._blob = response.blob()
			}
			this._resolveWaitingFunctions()
			return this
		} catch(err) {
			this._state = AssetLoader.FAILED
			this._resolveWaitingFunctions()
			return this
		}
	}

	/** @return {Promise<AssetInfo>} */
	waitForFetch(){
		if(this.state !== AssetLoader.LOADING){
			return Promise.resolve(this)
		}
		return new Promise((resolve, reject) => {
			this._waitingResolveFunctions.push(resolve)
		})
	}

	_resolveWaitingFunctions(){
		while(this._waitingResolveFunctions.length > 0){
			this._waitingResolveFunctions.pop()(this)
		}
	}
}

/**
AssetLoader receives the URLs of assets to load, fetches them, and then fires an event when they're loaded or failed.
*/
const AssetLoader = class extends EventHandler {
	constructor(){
		super()
		this._handleAssetFetched = this._handleAssetFetched.bind(this)

		// currentFetchingAsset
		this._currentFetchingAsset = null

		// Assets move from loadingQueue to fetchedAssets after they are fetched
		this._loadingQueue = []				// AssetInfos to load
		this._fetchedAssets = new Map() 	// url -> AssetInfos that have been fetched, regardless of success or failure
	}

	/**
	@param {string} url
	@return {boolean} true if the URL is queued for fetching
	*/
	isQueued(url){
		for(let i=0; i < this._loadingQueue.length; i++){
			if(this._loadingQueue[i].url === url) return true
		}
		return false
	}

	/**
	@param {string} url
	@return {boolean} true if the asset fetch has completed, even if it was a failure
	*/
	isFetched(url){ return this._fetchedAssets.has(url) }

	/**
	@url {string url}
	@return {boolean} url true if a fetch has completed successfully
	*/
	isLoaded(url){
		return this.isFetched(url) && this._fetchedAssets.get(url).state === AssetLoader.LOADED
	}

	/**
	@url {string url}
	@return {boolean} url true if a fetch has completed successfully
	*/
	isFailed(url){
		return this.isFetched(url) && this._fetchedAssets.get(url).state === AssetLoader.FAILED
	}

	/**
	@url {string} url
	@return {boolean} true if the URL has been queued *or* fetched
	*/
	has(url){
		return this.isQueued(url) || this.isFetched(url)
	}

	/**
	@param {string} url
	@return {Promise<Blob?>}
	*/
	async get(url){
		if(this.isFetched(url)){
			return this._fetchedAssets.get(url).blob
		}
		let assetInfo = this._getFromLoadingQueue(url)
		if(!assetInfo){
			assetInfo = this._addToLoadingQueue(url)
		}
		await assetInfo.waitForFetch()
		return assetInfo.blob
	}

	_checkLoadingQueue(){
		if(this._currentFetchingAsset !== null) return
		if(this._loadingQueue.length === 0) return
		this._currentFetchingAsset = this._loadingQueue[0]
		this._currentFetchingAsset.fetch().then(this._handleAssetFetched).catch(err => {
			console.error('Error checking loading queue', err)
		})
	}

	_handleAssetFetched(assetInfo){
		this._currentFetchingAsset = null
		this._loadingQueue.splice(0, 1)
		this._checkLoadingQueue()
	}

	_addToLoadingQueue(url){
		if(this.has(url)) return
		const assetInfo = new AssetInfo(url)
		this._loadingQueue.push(assetInfo)
		this._checkLoadingQueue()
		return assetInfo
	}

	_getFromLoadingQueue(url){
		for(let i=0; i < this._loadingQueue.length; i++){
			if(this._loadingQueue[i].url === url) return this._loadingQueue[i]
		}
		return null
	}
}

// States for AssetInfo.state
AssetLoader.LOADING = Symbol('loading')
AssetLoader.LOADED = Symbol('loaded')
AssetLoader.FAILED = Symbol('failed')

export default AssetLoader
