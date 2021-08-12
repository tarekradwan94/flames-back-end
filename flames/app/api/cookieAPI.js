const constants = require("../utils/constants");
const utilities = require("../utils/utilities");
const collectionName = "userDevices";

module.exports = {
    createAnonymousUserCookie: async function (req, db, cookieValue) {
        
        let anonymousUser = {
            isAnonymous: true
        };
        utilities.preProcessMongoDocumentCreation(anonymousUser);
        return await db.collection("users").insertOne(anonymousUser).then(user => {

            let locale = (req.header(constants.frontEnd.localeHTTPHeader) || "").trim();
            let ip = req.ip || "";
            let userAgent = req.useragent.source;
            let isMobile = req.useragent.isMobile;
            let browser = req.useragent.browser;
            let version = req.useragent.version;
            let os = req.useragent.os;
            let platform = req.useragent.platform;
            let latestRequestedHostname = req.hostname;
            let latestRequestedPort = req.client.localPort;
            let origin = req.get('origin');
            let latestRequestedUrl = req.originalUrl;

            let userDevice = {
                platform,
                os,
                isMobile,
                browser,
                version,
                userAgent,
                ip,
                locale,
                cookieValue,
                userID: user.ops[0]._id,
                latestRequestedHostname,
                origin,
                latestRequestedPort,
                latestRequestedUrl
            };
            utilities.preProcessMongoDocumentCreation(userDevice);
            db.collection(collectionName).insertOne(userDevice, (err, result) => {
                if (err) {
                    /* LOG ERROR */
                } else {
                    /* LOG SUCCESS */
                }
            });
            return {error: null, user: user.ops[0]};
        }).catch(error => {
            return {error, user: null};
        });
    },

    deleteCookie: function (db, cookieValue) {
        const cookieQuery = {cookieValue};
        db.collection(collectionName).deleteOne(cookieQuery).then(result => {
            return {error: null};
        }).catch(error => {
            return {error};
        });
    },

    updateAnonymousUserCookie: async function (req, db) {
        let cookieValue = req.signedCookies[constants.frontEnd.cookieName];
        let latestRequestedHostname = req.hostname;
        let latestRequestedPort = req.client.localPort;
        let origin = req.get('origin');
        let latestRequestedUrl = req.originalUrl;

        let userDevice = {
            latestRequestedHostname,
            latestRequestedPort,
            origin,
            latestRequestedUrl
        };
        utilities.preProcessMongoDocumentUpdate(userDevice);

        let updateDocument = { $set: userDevice };
        return await db.collection(collectionName).findOneAndUpdate({cookieValue}, updateDocument, { returnOriginal: false }).then(async result => {
            if (!result.value) {
                return {error: {message: "No cookie " + cookieValue + " found" }, user: null};
            } else {
                const userQuery = { "_id": result.value.userID };
                return await db.collection("users").findOne(userQuery).then(user => {
                    if (!user) {
                        return {error: {message: "No user " + result.value.userID.toHexString() + " found"}, user: null};
                    } else {
                        return {error: null, user};
                    }
                }).catch(error => {
                    return {error, user: null};
                });
            }
        }).catch(error => {
            return {error, user: null};
        });
    }
}