require('custom-env').env(true);
const express = require('express');
const MongoClient = require('mongodb').MongoClient;
const dbConfig = require('./config/db');
const bcrypt = require('bcrypt');
const constants = require('./app/utils/constants');
const utilities = require('./app/utils/utilities');
const mailAPI = require('./app/api/mailAPI');

const app = express();
const port = 8800;

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

        app.listen(port, () => {
            //create unique index uniqueName for outfits
            databaseInstance.collection("outfits").createIndex({ "uniqueName": 1 }, { unique: true }, (err, result) => {
                if (err) {
                    console.log("Couldn't create outfits-uniqueName index: " + err);
                } else {
                    console.log("outfits-uniqueName index created");
                }
            });

            //create text index for outfits
            databaseInstance.collection("outfits").createIndex({ "name": "text" }, {default_language: "it"}, (err, result) => {
                if (err) {
                    console.log("Couldn't create outfits text index: " + err);
                } else {
                    console.log("outfits text index created");
                }
            });

            //create unique index uniqueName for occasions
            databaseInstance.collection("occasions").createIndex({ "uniqueName": 1 }, { unique: true }, (err, result) => {
                if (err) {
                    console.log("Couldn't create occasions-uniqueName index: " + err);
                } else {
                    console.log("occasions-uniqueName index created");
                }
            });

            //create text index for occasions
            databaseInstance.collection("occasions").createIndex({ "name": "text" }, {default_language: "it"}, (err, result) => {
                if (err) {
                    console.log("Couldn't create occasions text index: " + err);
                } else {
                    console.log("occasions text index created");
                }
            });

            //create unique index uniqueName for styles
            databaseInstance.collection("styles").createIndex({ "uniqueName": 1 }, { unique: true }, (err, result) => {
                if (err) {
                    console.log("Couldn't create styles-uniqueName index: " + err);
                } else {
                    console.log("styles-uniqueName index created");
                }
            });

            //create text index for styles
            databaseInstance.collection("styles").createIndex({ "name": "text" }, {default_language: "it"}, (err, result) => {
                if (err) {
                    console.log("Couldn't create styles text index: " + err);
                } else {
                    console.log("styles text index created");
                }
            });

            //create unique index uniqueName for stylists
            databaseInstance.collection("stylists").createIndex({ "uniqueName": 1 }, { unique: true }, (err, result) => {
                if (err) {
                    console.log("Couldn't create stylists-uniqueName index: " + err);
                } else {
                    console.log("stylists-uniqueName index created");
                }
            });

            //create text index for stylists
            databaseInstance.collection("stylists").createIndex({ "name": "text" }, {default_language: "it"}, (err, result) => {
                if (err) {
                    console.log("Couldn't create stylists text index: " + err);
                } else {
                    console.log("stylists text index created");
                }
            });

            //create unique index uniqueName for article colors
            databaseInstance.collection("articles").createIndex({ "uniqueName": 1 }, { unique: true }, (err, result) => {
                if (err) {
                    console.log("Couldn't create articles-uniqueName index: " + err);
                } else {
                    console.log("articles-uniqueName index created");
                }
            });

            //create text index for articles
            databaseInstance.collection("articles").createIndex({ "name": "text", "details": "text", "brand": "text", "color": "text", "wearability": "text" }, {default_language: "it"}, (err, result) => {
                if (err) {
                    console.log("Couldn't create articles text index: " + err);
                } else {
                    console.log("articles text index created");
                }
            });

            //create unique index uniqueName for article colors
            databaseInstance.collection("outfitsTexts").createIndex({ "outfitUniqueName": 1 }, { unique: true }, (err, result) => {
                if (err) {
                    console.log("Couldn't create outfitsTexts-outfitUniqueName index: " + err);
                } else {
                    console.log("outfitsTexts-outfitUniqueName index created");
                }
            });

            //create overall text index for outfits
            databaseInstance.collection("outfitsTexts").createIndex(
                { "outfitName": "text", "occasionName": "text", "styleName": "text", "stylistName": "text", "articlesNames": "text", "articlesDetails": "text", "articlesBrands": "text", "articlesColors": "text", "articlesWearabilities": "text" },
                {default_language: "it"},
                { weights: {
                    outfitName: 10,
                    occasionName: 1,
                    styleName: 1,
                    stylistName: 1,
                    articlesNames: 10,
                    articlesDetails: 5,
                    articlesBrands: 2,
                    articlesColors: 2,
                    articlesWearabilities: 2
                    }
                },
                (err, result) => {
                    if (err) {
                        console.log("Couldn't create overall outfits text index: " + err);
                    } else {
                        console.log("overall outfits text index created");
                    }
                }
            );

            //create unique index uniqueName for users
            databaseInstance.collection("users").createIndex({ "email": 1 }, { unique: true, sparse: true }, (err, result) => {
                if (err) {
                    console.log("Couldn't create users-email index: " + err);
                } else {
                    console.log("users-email index created");
                }
            });

            
            const adminPassword = utilities.getRandomString(20);
            bcrypt.genSalt(constants.common.passwordSaltRounds, (err, salt) => {
                bcrypt.hash(adminPassword, salt, (err, hash) => {
                    let adminUser = {
                        email: constants.common.adminUser,
                        password: hash,
                        salt: salt
                    };
                    utilities.preProcessMongoDocumentCreation(adminUser);
                    databaseInstance.collection("users").insertOne(adminUser, (err, result) => {
                        if (err) {
                            console.log({ "error": err.message, "errorCode": err.code });
                        } else {
                            mailAPI.sendEmail(constants.common.adminUser, "Flames admin password", adminPassword, databaseInstance);
                            console.log("admin user created and password sent to email");
                        }
                    });
                });
            });
        });
    });
