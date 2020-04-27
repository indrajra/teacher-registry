const vars = require('./vars').getAllVars(process.env.NODE_ENV)
const certServiceUrl = vars['certServiceUrl']
const httpUtil = require('./httpUtils.js')

class CertService {

    constructor() {
    }

    getDefaultHeaders(reqHeaders) {
        let headers = {
            'content-type': 'application/json',
            'accept': 'application/json'
        }
        return headers;
    }

    createCertificate(value, callback) {
        const options = {
            url: certServiceUrl + "/v1/certs/generate",
            headers: this.getDefaultHeaders(value.headers),
            body: value.body
        }
        httpUtil.post(options, function (err, res) {
            if (res) {
                callback(null, res)
            } else {
                callback(err)
            }
        });

    }

    downloadCertificate(value, callback) {
        const options = {
            url: certServiceUrl + "/v1/user/certs/download",
            headers: this.getDefaultHeaders(value.headers),
            body: value.body
        }
        httpUtil.post(options, function (err, res) {
            if (res) {
                callback(null, res)
            } else {
                callback(err)
            }
        });

    }
}

module.exports = CertService;