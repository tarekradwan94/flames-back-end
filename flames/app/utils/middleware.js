const utilities = require("./utilities");

module.exports = {
    checkAuthentication: async function(req, res, next) {
        let errorFound = false;
        let databaseInstance = req.flamesDB;
        if(databaseInstance === undefined || databaseInstance === null) {
            errorFound = true;
            res.status(500).send({ "error": "Unable to check authorization" });
        } else {
            let basicAuthHeader = req.headers["authorization"] || "";
            let token = basicAuthHeader.split(/\s+/).pop() || "";
            let auth = new Buffer.from(token, "base64").toString();
            let parts = auth.split(/:/);
            let username = parts[0];
            let password = parts[1];

            let checkResult = await utilities.checkBasicAuthentication(username, password, databaseInstance);
            if (checkResult.error) {
                errorFound = true;
                if(checkResult.error.errorCode !== 401) {
                    res.status(500).send({ "error": checkResult.error });
                } else {
                    res.status(401).send({ "error": checkResult.error });
                }
            }
        }

        if(!errorFound) {
            next();
        }
    }
};