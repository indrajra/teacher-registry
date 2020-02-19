

/**
 * Programmatically invoke APIs to populate database
 * 
 */

var request = require("request")
var async = require("async")
var fs = require("fs");
var path = require("path");
var csvjson = require('csvjson');
var _ = require('lodash');

var invoke_add = function (nIter, payload, callback) {
    var url = baseUrl + "/add"
    var headerVars = {
        "Content-Type": "application/json",
        "Authorization": "Bearer ",
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

        /*
id,channel,createdby,createddate,
datetime,description,email,externalid,
hashtagid,homeurl,imgurl,isapproved,
isdefault,isrootorg,isssoenabled,keys,
locationid,locationids,noofmembers,orgcode,
orgname,orgtype,orgtypeid,parentorgid,
preferredlanguage,provider,rootorgid,slug,
status
*/

        // Have externalid, location, orgname
        var dataPortion = completePayload["request"][entityType]
        var toDeleteCols = ["id", "channel", "createdby", "createddate", "datetime", "description",
            "email", "hashtagid", "homeurl", "imgurl",
            "isapproved", "isdefault", "isrootorg", "isssoenabled",
            "keys", "locationid", "noofmembers", "orgcode",
            "orgtype", "orgtypeid", "parentorgid", "preferredlanguage",
            "provider", "rootorgid", "slug", "status"]
        toDeleteCols.forEach(field => {
            delete dataPortion[field]
        })

        for (var field in dataPortion) {
            var fieldVal = dataPortion[field]
            if (fieldVal.indexOf("[") != -1) {
                var myArr = new Array()
                var individualItems = fieldVal.replace(/\[|\]/g, "")
                //console.log("Expect [] to be removed " + JSON.stringify(individualItems) + " flag = " + individualItems.indexOf(","));
                if (individualItems.indexOf(",") != -1) {
                    console.log("Array contains multiple values")
                    // More than one item
                    // For every locationIds, construct and lookup locationId
                    var locationObj = {
                        "block": "",
                        "blockId": "",
                        "district": "",
                        "districtId": "",
                        "state": "",
                        "stateId": ""
                    }
                    var arrItems = individualItems.split(",")
                    arrItems.forEach(element => {
                        var elementWoQuote = element.replace(/\'/g, "")
                        elementWoQuote = elementWoQuote.trim()
                        myArr.push(element);
                        var thisLoc = g_locationObj[elementWoQuote]

                        if (thisLoc === undefined) {
                            console.log("element not found " + elementWoQuote)
                        } else {
                            var name = thisLoc["name"]
                            var type = thisLoc["type"]
                            console.log("type is " + type)
                            if (type === 'district') {
                                locationObj["district"] = name
                                locationObj["districtId"] = elementWoQuote
                            } else if (type === 'block') {
                                locationObj["block"] = name
                                locationObj["blockId"] = elementWoQuote
                            } else if (type === 'state') {
                                locationObj["state"] = name
                                locationObj["stateId"] = elementWoQuote
                            }

                        }

                    });
                    dataPortion["location"] = locationObj
                    delete dataPortion["locationids"]
                    //console.log("Adding location object" + JSON.stringify(completePayload))
                }
            }

            // If there are field specific code, set here.
        }

        // console.log(completePayload)
        // Any extra column to delete from the csv goes here
        //delete dataPortion.ParentCode

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
var entityType = "School"
addApiPayload.request[entityType] = {}

// The URL where the registry is running
var baseUrl = "http://localhost:9080"

// Whether you want to run in dryRun mode
// true - API will not be invoked.
// false - API will be invoked.
var dryRun = false

var PARALLEL_LIMIT = 1;
var dataEntities = {}

function populate(cb) {
    var student_tasks = [];
    var studentCSV = csvToJson('prod_school_data_full.csv')
    populate_add_tasks(student_tasks, entityType, addApiPayload, studentCSV)
    console.log("Total number of students = " + student_tasks.length)
    execute_tasks(student_tasks, "data.json", cb)
}

createLocationMap()
setTimeout(function() {
    console.log('Waited and continuing now')
}, 3000);

populate(function (err, result) {
    if (err) {
        return (err);
        console.log("Errorrrrr==>", err);
    }
    console.log("Finished successfully");
    return result;
})
