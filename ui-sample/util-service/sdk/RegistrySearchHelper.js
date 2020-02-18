const vars = require('./vars').getAllVars(process.env.NODE_ENV)
const registryUrl = vars['registryUrl']
const httpUtil = require('./httpUtils.js')
const logger = require('./log4j')

class RegistrySearchHelper {

    /**
     * 
     * @param {httpRequest} req 
     */
    constructor(req) {
        this.headers = req.headers
        this.body = req.body

        var request = req.body.request
        logger.debug(JSON.stringify(request))

        // FIXME : For multiple entity types search support
        var entityType = request["entityType"][0]
        logger.debug("Searching entityType = " + JSON.stringify(entityType))
    
        this.entityType = entityType
        this.limit = request["entityType"].limit || 100
        this.offset = request["entityType"].offset || 0
        logger.debug("Inited search helper " + this.entityType + "," + this.limit + "," + this.offset)
        
        // For multi-page search results
        this.results = {}
        this.callback = undefined
    }

    _getNextOffset() {
        return this.offset + this.limit
    }

    _getSearchOptions() {
        var options = {
            url: registryUrl + "/search",
            headers: this.getDefaultHeaders(this.headers),
            body: this.body
        }
        return options
    }

    _getNextSearchOptions() {
        this.offset = this._getNextOffset()
        this.body.request.offset = this.offset
        return this._getSearchOptions()
    }

    _performSingleSearch(options) {
        logger.debug(JSON.stringify(options))

        httpUtil.post(options, function (err, res) {
            if (res) {
                logger.debug("Successfully searched record in registry")
                this.callback(null, res.body)
            } else {
                logger.debug("Failed to search record in registry")
                this.callback(err)
            }
        })
    }

    setCallback(callback) {
        this.callback = callback
    }

    searchRecord(callback) {
        this.setCallback(callback)
        this._performSingleSearch(this._getSearchOptions())
    }

    searchMultipleRecords(callback) {

    }

    getAllRecords(callback) {

    }

    _resultAggregatorFn(err, res) {
        var endFlag = false
        if (res) {
            logger.info(JSON.stringify(res))
            if (Array.isArray(res.result[entityType]) &&
                res.result[entityType].size >= this.limit) {
                // Maybe there are more results, fetch them.

                // Store the current result
                if (result === undefined) {
                    logger.debug("Bulk search - Adding results first time")
                    this.results = res.body
                } else {
                    logger.debug("Bulk search - Appending results")
                    this.results[this.entityType].push(res.body.result[this.entityType])
                }

                this._performSingleSearch(this._getSearchOptions(body))
                logger.debug("Performing bulk search again with new offset " + newOffset)
            } else {
                logger.debug("Ending bulk search record")
                endFlag = true
                
            }
        } else {
            logger.debug("Bulk search failure")
            finalCallback(err)
        }
    }

    getAsCSV(value, callback) {
        var headers = value.headers
        var body = value.body
        const options = this._getSearchOptions(headers, body)
        
        this._searchRecord(options, function(err, data) {
            this._resultAggregatorFn
        })
    }

    getDefaultHeaders(reqHeaders) {
        var token = reqHeaders.authorization.replace('Bearer ', '');
        let headers = {
            'content-type': 'application/json',
            'accept': 'application/json',
            'x-authenticated-user-token': token
        }
        return headers;
    }
}


module.exports = RegistrySearchHelper;
