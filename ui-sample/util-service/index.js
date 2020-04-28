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
const CertService = require('./sdk/CertService');
var dateFormat = require('dateformat');

var cacheManager = new CacheManager();
var registryService = new RegistryService();
const keycloakHelper = new KeycloakHelper(vars.keycloak);
var certService = new CertService();
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
// self registeration api
app.theApp.post("/register/users/self", (req, res, next) => {
    selfRegisterUser(req, function (err, data) {
        if (err) {
            res.statusCode = err.statusCode;
            return res.send(err.body)
        } else {
            return res.send(data);
        }
    });
});

/**
 * 
 * @param {*} req 
 * @param {*} callback 
 */
const selfRegisterUser = (req, callback) => {
    logger.info("Self-registering " + JSON.stringify(req.body))
    async.waterfall([
        function (callback) {
            getTokenDetails(req, callback);
        },
        function (token, callback2) {
            req.headers['authorization'] = token;
            addTeacherToRegistry(req, callback2);
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
        function (res, callback2) {
            logger.info("Got this response from KC registration " + JSON.stringify(res))
            if (res.statusCode == 200) {
                req.body.request[entityType]['kcid'] = res.body.id
                addTeacherToRegistry(req, callback2)
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

app.theApp.post("/registry/course/certification", (req, res, next) => {
    async.waterfall([ 
            function (callback) {
            //if auth token is not given , this function is used get access token
                getTokenDetails(req, callback);
            },function (token, callback1) {
                req.headers['authorization'] = token;
                getTeacherRegistry(req,callback1)
            }, function(reqObj,callback2){
                getCourseCompletedByTeacher(reqObj,callback2)
            
            },function (reqObj, callback3) {
                updateCourseCompletedByTeacher(reqObj,callback3)
            }      
          ],function (err, result) {
                logger.info('Main Callback --> ' + result);
                if (err) {
                   res.send(err)
                } else {
                    res.send(result.body)
                }
    });
  
});

const getCourseCompletedByTeacher = (req, callback) => {
    let teacherCodeReq = {
        body: {
            id: appConfig.APP_ID.READ,
            request: {
                Teacher :{
                    osid:req.body.request.teacherId

                }    
               
            }
        },
        headers:req.headers
    }
    registryService.readRecord(teacherCodeReq, function (err, res) {
        if (res != undefined && res.params.status == 'SUCCESSFUL') {
            if(res.result.Teacher.courses){
                req.body.request["courses"] =res.result.Teacher.courses
            }else{
                req.body.request["courses"]=[]
            }
            callback(null, req)
        } else {
            callback({ body: { errMsg: "can't get any courses" }, statusCode: 500 }, null)
        }
    })
}

const getTeacherRegistry = (req, callback) => {
    let teacherCodeReq = {
        body: {
            id: appConfig.APP_ID.SEARCH,
            request: {
                entityType: ["Teacher"],
                
                filters: {
                    code:{
                        eq: req.body.request.teacherCode
                    }
                },
            }
        },
        headers:req.headers
    }
    registryService.searchRecord(teacherCodeReq, function (err, res) {
        if (res != undefined && res.params.status == 'SUCCESSFUL') {
            req.body.request["teacherId"] = res.result.Teacher[0].osid
            delete req.body.request["teacherCode"] ;
            callback(null, req)
        } else {
            callback({ body: { errMsg: "can't get any teacher osid" }, statusCode: 500 }, null)
        }
    })
}

const updateCourseCompletedByTeacher = (req, callback) => {
    logger.info("teacher course certification update")

    var course = {
        courseName:req.body.request.courseName,
        courseCode: req.body.request.courseCode,
        isOnline: req.body.request.isOnline,
        isTADAEligible:false,
        score: req.body.request.score

    }

    req.body.request.courses.push(course);
    let updateCourseReq = {
        body: {
            id: appConfig.APP_ID.UPDATE,
            request: {
                Teacher:{
                    osid:req.body.request.teacherId,
                    courses:req.body.request.courses
                }
            }
       },
       headers:req.headers

    }
    registryService.updateRecord(updateCourseReq, (err, res) => {
        if (res != undefined && res.params.status == 'SUCCESSFUL') {
            logger.info("teacher code succesfully updated", res)
            delete req.body.request["courses"]
            callback(null, req)
        } else {
            logger.info("teacher code updation failed", res)
            callback({ body: { errMsg: "teacher code update failed" }, statusCode: 500 }, null)
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
const addTeacherToRegistry = (req, callback) => {
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
        if (res != undefined && res.params.status == 'SUCCESSFUL' && res.result.TeacherCode[0] != undefined) {
            logger.info("next teacher code is ", res.result.TeacherCode[0])
            callback(null, res.result.TeacherCode[0])
        } else {
            callback({ body: { errMsg: "can't get any teachercode" }, statusCode: 500 }, null)
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

// Download Certification
app.theApp.post("/download/certificate", (req, res, next) => {
    downladCertificate(req, function (err, data) {
        if (err) {
            res.statusCode = err.statusCode;
            return res.send(err.body)
        } else {
            return res.send(data);
        }
    });
});

const downladCertificate = (req, callback) => {
    let downladCertificateReq = {
        body: {
            params: {},
            request: req.body   
        },
        headers:req.headers
    }
    certService.downloadCertificate(downladCertificateReq,function (err, res) {
        if (res != undefined && res.body.responseCode == 'OK') {
            if(res.body.result && res.body.result.response=='success'){
                callback(null, res.body)
            }else{
                callback({ body: { errMsg: "Error in downloading certificate" }, statusCode: 500 }, null)
            }
        } else {
            callback({ body: { errMsg: "Error in downloading certificate" }, statusCode: 500 }, null)
        }
    })
}

// Create Certification
app.theApp.post("/create/certificate", (req, res, next) => {
    createCertificate(req, function (err, data) {
        if (err) {
            res.statusCode = err.statusCode;
            return res.send(err.body)
        } else {
            return res.send(data);
        }
    });
});
const getCurrentTime = () => {
    return dateFormat(new Date(), "yyyy-mm-dd")
}
const createCertificate = (req, callback) => {
    let createCertificateReq = {
        body: {
            params: {},
            request: {
                certificate : {
                    htmlTemplate : "https://drive.google.com/a/ilimi.in/uc?authuser=1&id=16WgZrm-1Dh44uFryMTo_0uVjZv65mp4u&export=download",
                    issuedDate : getCurrentTime(),
                    data : [{
                        recipientName : req.body.userName
                    }],
                    courseName : req.body.courseName,
                    name: "Certificate of Completion",
                    tag: "0125450863553740809",
                    issuer: {
                        name: "Gujarat Council of Educational Research and Training",
                        url: "https://gcert.gujarat.gov.in/gcert/",
                        publicKey: [
                            "1",
                            "2"
                        ]
                    },
                    signatoryList: [
                        {
                            name: "CEO Gujarat",
                            id: "CEO",
                            designation: "CEO",
                            image: "https://cdn.pixabay.com/photo/2014/11/09/08/06/signature-523237__340.jpg"
                        }
                    ],
                    criteria: {
                        narrative: "Course Completion Certificate"
                    }
                }
            }   
        },
        headers:req.headers
    }
    certService.createCertificate(createCertificateReq,function (err, res) {
        if (res != undefined && res.body.responseCode == 'OK') {
            if(res.body.result){
                callback(null, res.body)
            }else{
                callback({ body: { errMsg: "Error in downloading certificate" }, statusCode: 500 }, null)
            }
        } else {
            callback({ body: { errMsg: "Error in downloading certificate" }, statusCode: 500 }, null)
        }
    })
}

// Init the workflow engine with your own custom functions.
const wfEngine = WFEngineFactory.getEngine(engineConfig, classesMapping['TeacherRegFunctions'])
wfEngine.init()

app.startServer(wfEngine);
