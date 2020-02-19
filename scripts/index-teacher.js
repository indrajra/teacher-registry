

/**
 * Programmatically invoke APIs to populate database
 * 
 */
"use strict"

var request = require("request")
var async = require("async")
var fs = require("fs");
var path = require("path");
var csvjson = require('csvjson');
var _ = require('lodash');

var invoke_add = function (nIter, payload, callback) {
    var url = baseUrl + "/register/users"
    var headerVars = {
        "Content-Type": "application/json",
        "Authorization": "Bearer eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJTSDhpcHVxaUFjR1ZOWjg3R05mNkxMM1BlalR5aG9uSktlRFpVNGFwamlnIn0.eyJqdGkiOiI3MTk2YTYwOC0wZDhkLTQwYzUtOWRkMC1lM2M1N2E2ZjVjOTMiLCJleHAiOjE1ODIxNTgxNzcsIm5iZiI6MCwiaWF0IjoxNTgyMTI5Mzc3LCJpc3MiOiJodHRwOi8vdGVhY2hlci5yZWdpc3RyeS5jb206ODA4MC9hdXRoL3JlYWxtcy9UZWFjaGVyUmVnaXN0cnkiLCJzdWIiOiJmNmY1ZmY4MC1mNGM3LTRkZTktODljYS0zOGUzYzI4NTczOTAiLCJ0eXAiOiJCZWFyZXIiLCJhenAiOiJhZG1pbi1jbGkiLCJhdXRoX3RpbWUiOjAsInNlc3Npb25fc3RhdGUiOiIxNjNkMDAyMi1jN2U2LTRhOGQtYjVkMy1lYjVmYmJkMmJhNmYiLCJhY3IiOiIxIiwiYWxsb3dlZC1vcmlnaW5zIjpbIioiXSwic2NvcGUiOiJwcm9maWxlIGVtYWlsIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsIm5hbWUiOiJSYWplc2ggQWRtaW4iLCJwcmVmZXJyZWRfdXNlcm5hbWUiOiJ0ZWFjaGVyYWRtaW4iLCJnaXZlbl9uYW1lIjoiUmFqZXNoIiwiZmFtaWx5X25hbWUiOiJBZG1pbiIsImVtYWlsIjoicmFqZXNockBpbGltaS5pbiJ9.ja3HidqyTUq_ntMFZqKCh49DYH-3ehuFgmfJYD9ImbTCIOUWlLGx8zlarXLvo9J8FWZiNjXnRWShrTOscJBiM9fiSP6kydUQjve-l4gLtoUu7TAhKrL-7EbOamxRbazoBT_oY0fhK8j_NcZZZIZY2qt06NrhK_4Nk4-N1U3WMQxTHOnDLtQEVdY_jeTrJc38tBIbqLE36gsDxFGm5_kfbUJr9p_pzms8DVLlNHSs7fiAwff78kHbVYE06dq9G4TpzjsRZ-iFl0ddDxVZXq3t2aZ0f4o0tIR96-ilHI2xkhQTPZUH3bvtlcTX5HIFWmwkua66XlV_gwcCfpo9XdC-yw",
        "x-authenticated-user-token": ""
    }

    if (dryRun) {
        console.log("#" + nIter + " DryRun: Will invoke " + url + " with payload " + payload)
        callback(null, nIter)
    } else {
        //console.log("#" + nIter + " Invoking " + url + " with payload " + payload)

        request(url, {
            method: "POST",
            body: payload,
            headers: headerVars
        }, function (err, response, body) {
            //console.log("This is the api response " + JSON.stringify(body))
            var apiResponse = JSON.parse(body)
            if (err) {
                console.error(err)
                console.log(" error for " + payload)
                callback(err)
            } else {
                var responseErr = apiResponse
                if (responseErr != "") {
                    callback(responseErr, null)
                } else {
                    console.log(" success for " + payload, " " + apiResponse.result)
                    callback(null, apiResponse.result)
                }
            }
        })
    }
}

var addToArr = function (arr, val, cb) {
    arr.push(val)
    cb()
}

/**
 * 
 */
var populate_add_tasks = function (tasks, entityType, static_payload, arrDynamicData, someEntity) {
    var allPayloads = []
    for (var itr = 0; itr < arrDynamicData.length; itr++) {
        var completePayload = JSON.parse(JSON.stringify(static_payload))
        var oneCSVRow = JSON.parse(JSON.stringify(arrDynamicData[itr]))
        //console.log("PAYLOAD Complete", JSON.stringify(static_payload))
        //console.log("one row = " + JSON.stringify(oneCSVRow))

        var attrsMerged = Object.assign(completePayload["request"][entityType], oneCSVRow)
        completePayload["request"][entityType] = attrsMerged

        //console.log(itr + " - payload = " + JSON.stringify(completePayload))
        var toDeleteCols = ["teacherType", "appointmentType",
        "classesTaught", "appointedForSubjects", "mainSubjectsTaught",
        "appointmentYear", "status"]

        var dataPortion = completePayload["request"][entityType]
        for (var field in dataPortion) {
            var fieldVal = dataPortion[field]
            console.log(fieldVal)
            if (fieldVal.indexOf("[") != -1) {
                var myArr = new Array()
                var individualItems = fieldVal.replace(/\[|\]/g, "")
                console.log("Expect [] to be removed " + JSON.stringify(individualItems) + " flag = " + individualItems.indexOf(","));
                if (fieldVal.indexOf("[") != -1) {
                    var myArr = new Array()
                    var individualItems = fieldVal.replace(/\[|\]/g, "")
                    //console.log("Expect [] to be removed " + JSON.stringify(individualItems) + " flag = " + individualItems.indexOf(","));
                    if (individualItems.indexOf(",") != -1) {
                        // console.log("Array contains multiple values")
                        // More than one item
                        var arrItems = individualItems.split(",")
                        arrItems.forEach(element => {
                            myArr.push(element);
                        });
                    } else {
                        //console.log("Just one item in the array for " + field + " = " + individualItems)
    
                        if (parseInt(individualItems)) {
                            //console.log("is integer")
                            myArr.push(parseInt(individualItems))
                        } else {
                            myArr.push(individualItems)
                        }
                    }

                    console.log("Array", myArr);
                    dataPortion[field] = myArr
                }
            }
        }

        var teachingRole = {}
        teachingRole['teacherType'] = dataPortion['teacherType']
        teachingRole['appointmentType'] = dataPortion['appointmentType']
        teachingRole['classesTaught'] = dataPortion['classesTaught']
        teachingRole['appointedForSubjects'] = dataPortion['appointedForSubjects']
        teachingRole['mainSubjectsTaught'] = dataPortion['mainSubjectsTaught']
        teachingRole['appointmentYear'] = dataPortion['appointmentYear']
        teachingRole['status'] = dataPortion['status']
    

        dataPortion['teachingRole'] = teachingRole


        // console.log(completePayload)
        // Any extra column to delete from the csv goes here
        //delete dataPortion.ParentCode
        

        toDeleteCols.forEach(field => {
            delete dataPortion[field]
        })

        var dataPortion = completePayload["request"][entityType]

        dataPortion['trainedForChildrenSpecialNeeds'] = (dataPortion['trainedForChildrenSpecialNeeds1'] === '1')
        dataPortion['trainedInUseOfComputer'] = (dataPortion['trainedInUseOfComputer1'] === '1')

        delete dataPortion.trainedInUseOfComputer1
        delete dataPortion.trainedForChildrenSpecialNeeds1

        allPayloads.push(completePayload)
    }

    console.log("Lengths of tasks = " + arrDynamicData.length + " and " + allPayloads.length)
    //console.log(JSON.stringify(allPayloads))

    async.forEachOf(allPayloads, function (onePayload, nIter, callback) {
        tasks.push(
            (cb) => invoke_add(nIter, JSON.stringify(onePayload), function (err, data) {
                var returnData = JSON.stringify(err)
                if (err != null) {
                    console.log("Return data = " + returnData + " for payload " + JSON.stringify(onePayload));
                }
                // Do not cascade the error - fail for certain rows, but don't stop processing.
                cb(null, data)
            })
        )
        callback()
    })
}

/**
 * Executes all the populated tasks in parallel.
 */
var execute_tasks = function (tasks, fileName, cb) {
    //async.parallelLimit(tasks, PARALLEL_LIMIT, function (err, callback) {
    async.series(tasks, function (err, callback) {
        if (!err) {
            console.log("Executed tasks")
            cb(null)
        } else {
            console.error(err)
            console.log("One or more errors occurred.")
            cb(err)
        }
    })
}

var options = {
    delimiter: ',', // optional
    quote: '"' // optional
};

var csvToJson = function (csvFileName) {
    var data = fs.readFileSync(path.join(__dirname, csvFileName), { encoding: 'utf8' });
    const jsonObject = csvjson.toObject(data, options);
    //console.log("JSON Object", jsonObject);
    return jsonObject;
}

var g_locationObj = {}
var createLocationMap = function () {
    var locationArr = csvToJson("prod_location_data_full.csv")
    locationArr.forEach(item => {
        g_locationObj[item["id"]] = {
            "type": item["type"],
            "name": item["name"],
            "code": item["code"]
        }
    })
}

// This is the default payload
var addApiPayload = {
    "id": "open-saber.registry.create",
    "request": {
    }
}

// The subject that we have schematized
var entityType = "Teacher"
addApiPayload.request[entityType] = {}

// The URL where the registry is running
var baseUrl = "http://localhost:9081"

// Whether you want to run in dryRun mode
// true - API will not be invoked.
// false - API will be invoked.
var dryRun = false

var PARALLEL_LIMIT = 1;
var dataEntities = {}

function populate(cb) {
    var student_tasks = [];
    var studentCSV = csvToJson('odisha_teachers.csv')
    populate_add_tasks(student_tasks, entityType, addApiPayload, studentCSV)
    console.log("Total number of students = " + student_tasks.length)
    execute_tasks(student_tasks, "data.json", cb)
}

populate(function (err, result) {
    if (err) {
        return (err);
        console.log("Errorrrrr==>", err);
    }
    console.log("Finished successfully");
    return result;
})


