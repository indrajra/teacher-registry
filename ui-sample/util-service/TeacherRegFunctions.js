let Functions = require("./workflow/Functions");
const _ = require('lodash')
const async = require('async');
const entityType = 'Teacher';
const appConfig = require('./sdk/appConfig');
const RegistryService = require('./sdk/RegistryService')
const KeycloakHelper = require('./sdk/KeycloakHelper');
const httpUtils = require('./sdk/httpUtils.js');
const logger = require('./sdk/log4j');
const vars = require('./sdk/vars').getAllVars(process.env.NODE_ENV);
const nerKeycloakHelper = new KeycloakHelper(vars.keycloak_ner);
var registryService = new RegistryService();


class TeacherRegFunctions extends Functions {
    TeacherRegFunctions() {
        setRequest(undefined)
    }

    getAdminUsers(callback) {
        this.getUsersByRole('principal', (err, data) => {
            this.addEmailToPlaceHolder(data, callback);
        });
    }

    /**
       * gets user mail ids from keycloak where user role = partner-admin
       * @param {*} callback 
       */
    getPartnerAdminUsers(callback) {
        this.getUsersByRole('partner-admin', (err, data) => {
            this.addEmailToPlaceHolder(data, callback);
        })
    }

    /**
     * gets user mail ids from keycloak where user role = fin-admin
     * @param {*} callback 
     */
    getFinAdminUsers(callback) {
        this.getUsersByRole('fin-admin', (err, data) => {
            this.addEmailToPlaceHolder(data, callback);
        });
    }

    /**
     * gets user mail ids from keycloak where user role = reporter
     * @param {*} callback 
     */
    getReporterUsers(callback) {
        this.getUsersByRole('reporter', (err, data) => {
            this.addEmailToPlaceHolder(data, callback);
        });
    }

    /**
     * geets user mail ids from keycloak where user role = owner
     * @param {*} callback 
     */
    getOwnerUsers(callback) {
        this.getUsersByRole('owner', (err, data) => {
            this.addEmailToPlaceHolder(data, callback);
        });
    }

    /**
     * to get the registry user mail id
     * @param {} callback 
     */
    getRegistryUsersMailId(callback) {
        let tempParams = {}
        this.getUserByid((err, data) => {
            if (data) {
                tempParams = data.result[entityType];
                tempParams['employeeName'] = data.result[entityType].name
                tempParams['eprURL'] = vars.appUrl
                this.addToPlaceholders('templateParams', tempParams)
                this.addEmailToPlaceHolder([data.result[entityType]], callback);
            }
        })
    }

    /**
     * gets email from the object and adds to the placeholder
     * @param {object} data 
     * @param {*} callback 
     */
    addEmailToPlaceHolder(data, callback) {
        this.addToPlaceholders('emailIds', _.map(data, 'email'));
        callback();
    }

    /**
     * sends notification to Admin (requesting to onboard new employee)
     * @param {*} callback 
     */
    sendNotificationForRequestToOnBoard(callback) {
        console.log("hey", this.response.body)
        this.addToPlaceholders('subject', "Request to Onboard " + this.request.body.request[entityType].name)
        this.addToPlaceholders('templateId', "requestOnboardTemplate");
        let tempParams = this.request.body.request[entityType];
        tempParams['employeeName'] = this.request.body.request[entityType].name
        tempParams['empRecord'] = vars.appUrl + "/profile/" + JSON.parse(this.response).result[entityType].osid

        this.addToPlaceholders('templateParams', tempParams);
        let actions = ['getAdminUsers', 'sendNotifications'];
        this.invoke(actions, (err, data) => {
            callback(null, data)
        });
    }



    /**
     * sends notification to Admin (requesting to onboard new employee)
     * @param {*} callback 
     */
    sendNotificationForRequestToApprove(callback) {
        console.log("hey", this.request.body)
        this.addToPlaceholders('subject', "Request to Approve ")
        this.addToPlaceholders('templateId', "requestOnboardTemplate");
        let tempParams = this.request.body.request[entityType];
        tempParams['employeeName'] = this.request.body.request[entityType].name
        tempParams['empRecord'] = vars.appUrl + "/profile/" + JSON.parse(this.response).result[entityType].osid
        this.addToPlaceholders('templateParams', tempParams);
        let actions = ['getAdminUsers', 'sendNotifications'];
        this.invoke(actions, (err, data) => {
            callback(null, data)
        });
    }


    /**
     * to get Employee deatils(from registry)
     * @param {*} callback 
     */
    getRegistryUsersInfo(callback) {
        let tempParams = {}
        this.getUserByid((err, data) => {
            if (data) {
               this._placeholders['templateParams']['name'] = data.result[entityType].name;
                callback()
            }
        })
    }

    /**
     * This method is inovoked to send notiifcations whenever Employee record is updated(for eg attributes like macAddress ,
     * githubId and isOnBoarded are updated)
     * @param {*} callback 
     */
    notifyUsersBasedOnAttributes(callback) {
        let attributesUpdated = _.keys(this.request.body.request[entityType]);//get the list of updated attributes from the req
        let count = 0
        async.forEachSeries(this.notifyAttributes, (param, callback2) => {
            if (_.includes(attributesUpdated, param)) {
                let params = {
                    paramName: param,
                    paramValue: this.request.body.request[entityType][param]
                }
                this.addToPlaceholders('templateParams', params)
                this.getActions(param, (err, data) => {
                    if (data) {
                        callback2();
                    }
                });
            } else {
                callback2();
            }
            if (count === this.notifyAttributes.length) {
                callback(null, "success")
            }
        });
    }

    /**
     * this function is invoked by notifyUsersBasedOnAttributes function to get the actions to be done(to send notification) on the attribute updated
     * each case contains name of the functions( in the array ), to be invoked for sending notification.
     * @param {*} attribute  param that is updated 
     * @param {*} callback 
     */
    getActions(attribute, callback) {
        let actions = []
        switch (attribute) {
            case 'githubId':
                actions = ['getFinAdminUsers', 'sendNotifications'];
                // FIXME - add subject
                this.addToPlaceholders('templateId', "updateParamTemplate");
                this.invoke(actions, (err, data) => {
                    callback(null, data)
                });
                break;
            case 'name':
                actions = ['getRegistryUsersInfo', 'getAdminUsers', 'sendNotifications'];
                this.addToPlaceholders('subject', "Request to Approve");
                this.addToPlaceholders('templateId', "updateDevcon");
                this.invoke(actions, (err, data) => {
                    callback(null, data)
                });
                break;
            case 'email':
                actions = ['getRegistryUsersInfo', 'getAdminUsers', 'sendNotifications'];
                this.addToPlaceholders('subject', "Request to Approve");
                this.addToPlaceholders('templateId', "updateDevcon");
                this.invoke(actions, (err, data) => {
                    callback(null, data)
                });
                break;
            case 'teacherType':
                actions = ['getRegistryUsersInfo', 'getAdminUsers', 'sendNotifications'];
                this.addToPlaceholders('subject', "Request to Approve");
                this.addToPlaceholders('templateId', "updateDevcon");
                this.invoke(actions, (err, data) => {
                    callback(null, data)
                });
                break;
            case 'isApproved':
                //if isOnBoarded attribute is set to true, email is sent to Employee (as you are OnBoarded successfully to the Ekstep) and Admin (as new Employee onBoarded)
                if (this.request.body.request[entityType][attribute]) {
                    actions = ['getRegistryUsersMailId', 'sendNotifications']
                    this.addToPlaceholders('templateId', "approveTemplate");
                    this.addToPlaceholders('subject', "Successfully Onboarded");
                    this.invoke(actions, (err, data) => {
                        callback(null, data)
                    });
                } else {
                    callback(null, "employee deboarded")
                }
                break;
        }
    }


    /**
     * 
     * @param {*} actions array of functions to be called
     * @param {*} callback 
     */
    invoke(actions, callback) {
        if (actions.length > 0) {
            let count = 0;
            async.forEachSeries(actions, (value, callback2) => {
                count++;
                this[value]((err, data) => {
                    callback2()
                });
                if (count == actions.length) {
                    callback(null, actions);
                }
            });
        }
    }

    searchCheck(callback) {
        console.log("search is hit")
        callback(null)
    }

}


module.exports = TeacherRegFunctions