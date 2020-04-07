let app = require('./app')

var async = require('async');
const WFEngineFactory = require('./workflow/EngineFactory');
const baseFunctions = require('./workflow/Functions')
const engineConfig = require('./engineConfig.json')
const TeacherRegFunctions = require('./TeacherRegFunctions')
const KeycloakHelper = require('./sdk/KeycloakHelper');
const RegistryService = require('./sdk/RegistryService')
const CacheManager = require('./sdk/CacheManager.js');
const logger = require('./sdk/log4j');
const vars = require('./sdk/vars').getAllVars(process.env.NODE_ENV);
const appConfig = require('./sdk/appConfig');
const QRCode = require('qrcode');
const Jimp = require('jimp');

var cacheManager = new CacheManager();
var registryService = new RegistryService();
const keycloakHelper = new KeycloakHelper(vars.keycloak);
const entityType = 'Teacher';

const classesMapping = {
    'TeacherRegFunctions': TeacherRegFunctions,
    'Functions': baseFunctions
};

// Add any new APIs here.
app.theApp.post("/register/users", (req, res, next) => {
    createUser(req, function (err, data) {
        if (err) {
            res.statusCode = err.statusCode;
            return res.send(err.body)
        } else {
            return res.send(data);
        }
    });
});

app.theApp.post("/profile/qrImage", (req, res, next) => {
    console.log("qrcode req", req.body)
    var opts = {
        errorCorrectionLevel: 'M',
        type: 'image/jpeg',
        quality: 0.3,
        margin: 6,
        color: {
            dark: "#000000",
            light: "#ffffff"
        }
    }
    QRCode.toDataURL(JSON.stringify(req.body.request), opts, function (err, url) {
        if (err) throw err

        if (url.indexOf('base64') != -1) {
            var buffer = Buffer.from(url.replace(/^data:image\/png;base64,/, ""), 'base64');
            Jimp.read(buffer, (err, image) => {
                if (err) throw err;
                else {
                    Jimp.loadFont(Jimp.FONT_SANS_16_BLACK).then(function (font) {
                        image.print(font, 95, 230, req.body.request.code);
                        image.getBase64(Jimp.MIME_PNG, (err, img) => {
                            res.statusCode = 200;
                            res.setHeader('Content-Type', 'img/png');
                            return res.end(img);
                        });
                    });
                }
            });
        } else {
            // handle as Buffer, etc..
        }

    });
});

/**
 * creates user in keycloak and add record to the registry
 * first gets the bearer token needed to create user in keycloak and registry
 * @param {*} req 
 * @param {*} callback 
 */
const createUser = (req, callback) => {
    async.waterfall([
        function (callback) {
            //if auth token is not given , this function is used get access token
            getTokenDetails(req, callback);
        },
        function (token, callback) {
            req.headers['authorization'] = token;
            var keycloakUserReq = {
                body: {
                    request: req.body.request[entityType]
                },
                headers: req.headers
            }
            keycloakHelper.registerUserToKeycloak(keycloakUserReq, callback)
        },
        function (res, callback) {
            if (res.statusCode == 201) {
                addTeacherToRegistry(req, callback)
            } else {
                callback(res, null)
            }
        }
    ], function (err, result) {
        logger.info('Main Callback --> ' + result);
        if (err) {
            callback(err, null)
        } else {
            callback(null, result);
        }
    });
}

/**
 * returns user token and caches if token is not cached
 * @param {*} req 
 * @param {*} callback 
 */
const getTokenDetails = (req, callback) => {
    if (!req.headers.authorization) {
        cacheManager.get('usertoken', function (err, tokenData) {
            if (err || !tokenData) {
                keycloakHelper.getToken(function (err, token) {
                    if (token) {
                        cacheManager.set({ key: 'usertoken', value: { authToken: token } }, function (err, res) { });
                        callback(null, 'Bearer ' + token.access_token.token);
                    } else {
                        callback(err);
                    }
                });
            } else {
                callback(null, 'Bearer ' + tokenData.authToken.access_token.token);
            }
        });
    } else {
        callback(null, req.headers.authorization);
    }
}

/**
 * adds record to the registry
 * @param {objecr} req 
 * @param {*} res 
 * @param {*} callback 
 */
const addTeacherToRegistry = (req, res, callback) => {
    async.waterfall([
        function (callback1) {
            getNextTeacherCode(req.headers, callback1)
        },
        function (teacherCode, callback3) {
            updateTeacherCode(teacherCode, req.headers, callback3);
        },
        function (teacherCode, callback2) {
            addRecordToRegistry(req, teacherCode, callback2)
        }
    ], function (err, data) {
        if (err) {
            callback(err, null)
        } else {
            callback(null, data);
        }
    })
       
}
/**
 * 
 * @param {*} req 
 * @param {*} employeeCode 
 * @param {*} callback 
 */
const addRecordToRegistry = (req, teacherCode, callback) => {
    req.body.request[entityType]['isApproved'] = false;
    req.body.request[entityType]['code'] = teacherCode.prefix + teacherCode.nextCode;
    registryService.addRecord(req, function (err, res) {
        if (res.statusCode == 200 && res.body.params.status == 'SUCCESSFUL') {
            logger.info("record successfully added to registry");
            callback(null, res.body)
        } else {
            logger.debug("record could not be added to registry" + res.statusCode)
            callback(res)
        }
    })
}

/**
 * 
 * @param {*} headers 
 * @param {*} callback 
 */
const getNextTeacherCode = (headers, callback) => {
    let teacherCodeReq = {
        body: {
            id: appConfig.APP_ID.SEARCH,
            request: {
                entityType: ["TeacherCode"],
                filters: {},
            }
        },
        headers: headers
    }
    registryService.searchRecord(teacherCodeReq, function (err, res) {
        if (res != undefined && res.params.status == 'SUCCESSFUL') {
            logger.info("next teacher code is ", res.result.TeacherCode[0])
            callback(null, res.result.TeacherCode[0])
        } else {
            callback({ body: { errMsg: "can't get any empcode" }, statusCode: 500 }, null)
        }
    })
}
/**
 * update teacher code after successfully adding record to the registry
 * @param {*} teacherCode 
 * @param {*} headers 
 */
const updateTeacherCode = (teacherCode, headers, callback) => {
    logger.info("teacher code updation started", teacherCode.nextCode)
    let empCodeUpdateReq = {
        body: {
            id: appConfig.APP_ID.UPDATE,
            request: {
                TeacherCode: {
                    osid: teacherCode.osid,
                    nextCode: teacherCode.nextCode + 1
                }
            }
        },
        headers: headers
    }
    registryService.updateRecord(empCodeUpdateReq, (err, res) => {
        if (res.params.status == 'SUCCESSFUL') {
            logger.info("teacher code succesfully updated", res)
            callback(null, teacherCode)
        } else {
            logger.info("teacher code updation failed", res)
            callback({ body: { errMsg: "teacher code update failed" }, statusCode: 500 }, null)
        }
    });
}
// Init the workflow engine with your own custom functions.
const wfEngine = WFEngineFactory.getEngine(engineConfig, classesMapping['TeacherRegFunctions'])
wfEngine.init()

app.startServer(wfEngine);
