const config = {
    "dev": {
        "env": "dev",
        "utilServicePort":process.env.util_service_port || 9081,
        "keycloak_ner": {
            "url": process.env.keycloak_url || "http://localhost:8080",
            "realmName": process.env.keycloak_realmName || "NIITRegistry",
            "clientId": "utils",
            "clientSecret": process.env.keycloak_clientSecret || "df383c40-0443-42c9-b23b-f3bf6c9d545a"
        },
        "keycloak": {
            "url": process.env.keycloak_epr_url || "http://localhost:8080",
            "realmName": process.env.keycloak_epr_realmName || "PartnerRegistry",
            "clientId": "utils",
            "clientSecret": process.env.keycloak_epr_clientSecret || "7d86103c-73b0-485b-bf9d-125da2741f6f"
        },
        "notificationUrl": process.env.notificationUrl || "http://localhost:9012",
        "registryUrl": process.env.registry_url || "http://localhost:9080",
        "nerUtilServiceUrl": process.env.ner_utilservice_url || "http://localhost:9181"
    },
    "prod": {
        "env": "dev",
        "keycloak": {
            "url": process.env.keycloak_url,
            "realmName": process.env.keycloak_realmName,
            "clientId": "utils",
            "clientSecret": process.env.keycloak_clientSecret
        },
        "keycloak_ner": {
            "url": process.env.keycloak_ner_url,
            "realmName": process.env.keycloak_ner_realmName,
            "clientId": "utils",
            "clientSecret": process.env.keycloak_ner_clientSecret
        },
        "notificationUrl": process.env.notificationUrl,
        "registryUrl": process.env.registry_url,
        "nerUtilServiceUrl": process.env.ner_utilservice_url
    }
}

const logger = require('./log4j')

module.exports.getAllVars = function (envName) {
    var environment = envName
    if (envName === undefined) {
        environment = 'dev'
    }
    return config[environment]
}