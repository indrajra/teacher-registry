//CSVTOJSON

// @ts-nocheck

var request = require("request")
var async = require("async")
var fs = require("fs");
var path = require("path");
var csvjson = require('csvjson');

var options = {
  delimiter : ',', // optional
  quote     : '"' // optional
};

var csvToJson = function () {
  var data = fs.readFileSync(path.join(__dirname, 'prod_location_data.csv'), { encoding : 'utf8'});
  const jsonObject = csvjson.toObject(data, options);
  console.log("JSON Object",jsonObject);
  return jsonObject;
}
