require('custom-env').env(true);
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const MongoClient = require('mongodb').MongoClient;
const dbConfig = require('./config/db');
const apiConfig = require('./config/api');
const shopifyConfig = require('./config/shopify');
const constants = require('./app/utils/constants');
const utilities = require('./app/utils/utilities');
const cookieParser = require('cookie-parser');
const useragent = require('express-useragent');
const cookieAPI = require("./app/api/cookieAPI");

const app = express();
const port = process.env.RUNTIME_PORT;
app.set('trust proxy', true);

app.use(helmet()); //use helmet for security
app.use(express.json({ limit: apiConfig.sizeLimit })); //use express as framework

var allowedOrigins = constants.frontEnd.allowedOrigins;
app.use(cors({ //use cors to enable cors for allowed origins
    credentials: true,
    origin: function (origin, callback) {
        // allow requests with no origin 
        // (like mobile apps or curl requests)
        if (!origin) {
            return callback(null, true);
        } else if (allowedOrigins.indexOf(origin) === -1) {
            var msg = 'The CORS policy for this site does not ' +
                'allow access from the specified Origin.';
            return callback(new Error(msg), false);
        } else {
            return callback(null, true);
        }
    }
}));

app.use(cookieParser(constants.frontEnd.cookieSecret));
app.use(useragent.express());

let registeredIPs = {};
app.use(function(req, res, next) {
    //security check: max n call by each IP
    let ip = req.ip;
    let currentTime = Math.floor(Date.now() / 1000); //current timestamp in seconds
    let errorFound = false;
    if (registeredIPs[ip]) {
        let time = registeredIPs[ip].time;
        if (currentTime === time) {
            let callsCounter = registeredIPs[ip].counter;
            if (callsCounter > constants.common.maxCallsPerSecondByIP) {
                res.status(500).send({ "error": "Max calls reached" });
                errorFound = true;
            } else {
                registeredIPs[ip].counter++;
            }
        } else {
            registeredIPs[ip] = {
                time: currentTime,
                counter: 1
            };
        }
    } else {
        registeredIPs[ip] = {
            time: currentTime,
            counter: 1
        };
    }

    //security check: user agent must be defined
    if(!errorFound) {
        let basicAuthHeader = req.headers["authorization"];
        if((req.useragent === undefined ||req.useragent.isBot) && !basicAuthHeader) { //"bots" are allowed only with authenticated requests
            res.status(400).send({ "error": "Bad request" });
            errorFound = true;
        }
    }

    //security check: if Flames-language HTTP header is not set, it's a call from outside the official website / app
    if(!errorFound) {
        let basicAuthHeader = req.headers["authorization"];
        let locale = req.header(constants.frontEnd.localeHTTPHeader);
        if((!locale || locale.trim() == "") && !basicAuthHeader) {
            res.status(400).send({ "error": "Bad request" });
            errorFound = true;
        }
    }

    if(!errorFound) {
        next();
    }
});

MongoClient.connect(dbConfig.url,
    {
        useNewUrlParser: true,
        useUnifiedTopology: true
    },
    (err, database) => {
        if (err) {
            return console.log(err);
        }

        const databaseInstance = database.db(dbConfig.name);

        //attach the database instance to the request so that it can be used by middlewares
        app.use(async function(req, res, next) {
            req.flamesDB = databaseInstance;
            next();
        });
        
        //during a session, clients might send parallel requests with a wrong cookie
            // -> the first call will result in a new cookie;
            //    use this object to store the update between old cookie and fresh cookie
            //    to prevent creating more and more cookies for the same user
        let translatedCookies = {};

        // cookie management
        app.use(async function (req, res, next) {
            if(req.url.includes("userProfileMonitor")) {
                next();
            } else {
                // check if client sent cookie
                let cookie = req.signedCookies[constants.frontEnd.cookieName];
                if (cookie === undefined) { //if no cookie is sent, create it
                    let cookieValue = utilities.getRandomString(30);
                    let result = await cookieAPI.createAnonymousUserCookie(req, databaseInstance, cookieValue);
                    if (result.error) {
                        /* LOG ERROR */
                    }
                    req.flamesUser = result.user;
                    res.cookie(constants.frontEnd.cookieName, cookieValue,
                        {httpOnly: true, domain: constants.frontEnd.cookieDomain, path: constants.frontEnd.cookiePath, maxAge: constants.frontEnd.cookieExpiration, signed: true, secure: constants.frontEnd.cookieSecure, sameSite: constants.frontEnd.cookieSameSite});
                } else {
                    let result = await cookieAPI.updateAnonymousUserCookie(req, databaseInstance);
                    if (result.error || !result.user) { //if we failed fetching the user using the cookie
                        cookieAPI.deleteCookie(databaseInstance, cookie);
                        let newCookieValue;
                        if(!translatedCookies[cookie]) { //before creating a new cookie, check if some previous parallel call already did
                            newCookieValue = utilities.getRandomString(30);
                            translatedCookies[cookie] = newCookieValue; //store in server session the cookie update
                            result = await cookieAPI.createAnonymousUserCookie(req, databaseInstance, newCookieValue);
                            if (result.error) {
                                /* LOG ERROR */
                            }
                        } else {
                            newCookieValue = translatedCookies[cookie];
                        }
                        res.cookie(constants.frontEnd.cookieName, newCookieValue,
                            {httpOnly: true, domain: constants.frontEnd.cookieDomain, path: constants.frontEnd.cookiePath, maxAge: constants.frontEnd.cookieExpiration, signed: true, secure: constants.frontEnd.cookieSecure, sameSite: constants.frontEnd.cookieSameSite});
                    }
                    req.flamesUser = result.user;
                }
                next();
            }
        });


        require('./app/routes')(app, databaseInstance, shopifyConfig);

        app.listen(port, () => {
            console.log('We are live on ' + port);
        });
    });
