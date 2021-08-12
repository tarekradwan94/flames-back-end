const utilities = require("../utils/utilities");
const constants = require("../utils/constants");
const collectionName = "outfits";
const outfitAPI = require("../api/outfitAPI");
const articleAPI = require("../api/articleAPI");
const interactionAPI = require("../api/interactionAPI");
const middleware = require("../utils/middleware");

module.exports = function (app, db) {
    /* CREATE */
    app.post("/outfit", middleware.checkAuthentication, async function (req, res) {
        let outfit = req.body;
        /* outfit validation */
        let validationResult = await utilities.validateOutfitCreation(outfit, db);

        if (validationResult.failed) {
            res.status(500).send({ "error": validationResult.message })
        } else {
            let previewImage = await utilities.uploadImageFromUrl(outfit.previewImage, outfit.uniqueName);
            outfit.previewImage = previewImage;
            let image = await utilities.uploadImageFromUrl(outfit.image, outfit.uniqueName);
            outfit.image = image;
            utilities.preProcessMongoDocumentCreation(outfit);
            db.collection(collectionName).insertOne(outfit, async (err, result) => {
                if (err) {
                    res.status(500).send({ "error": err.message, "errorCode": err.code });
                } else {
                    let result = await outfitAPI.getOutfitByID(db, outfit.uniqueName, req.flamesUser);

                    let err = result.error;
                    let extenedOutfit = result.outfit;

                    if (err) {
                        res.status(500).send({ "error": err.message, "errorCode": err.code });
                    } else {

                        let articlesUniqueNames = [];
                        let articlesNames = [];
                        let articlesColors = [];
                        let articlesBrands = [];
                        let articlesWearabilities = [];
                        let articlesDetails = [];
                        for (let i = 0; i < extenedOutfit.articles.length; i++) {
                            articlesUniqueNames = articlesUniqueNames.concat(extenedOutfit.articles[i].uniqueName);
                            articlesNames = articlesNames.concat(extenedOutfit.articles[i].name);
                            articlesColors = articlesColors.concat(extenedOutfit.articles[i].color);
                            articlesBrands = articlesBrands.concat(extenedOutfit.articles[i].brand);
                            articlesWearabilities = articlesWearabilities.concat(extenedOutfit.articles[i].wearability);
                            articlesDetails = articlesDetails.concat(extenedOutfit.articles[i].details);
                        }

                        let outfitTexts = {
                            outfitUniqueName: extenedOutfit.uniqueName,
                            outfitName: extenedOutfit.name,
                            occasionUniqueName: extenedOutfit.occasion[0].uniqueName,
                            occasionName: extenedOutfit.occasion[0].name,
                            styleUniqueName: extenedOutfit.style[0].uniqueName,
                            styleName: extenedOutfit.style[0].name,
                            stylistUniqueName: extenedOutfit.stylist[0].uniqueName,
                            stylistName: extenedOutfit.stylist[0].name,
                            articlesUniqueNames,
                            articlesNames,
                            articlesColors,
                            articlesBrands,
                            articlesWearabilities,
                            articlesDetails
                        };
                        
                        db.collection("outfitsTexts").updateOne({outfitUniqueName: outfitTexts.outfitUniqueName}, {$set: outfitTexts}, { upsert: true }, (err, result) => {
                            if (err) {
                                res.status(500).send({ "error": err.message, "errorCode": err.code });
                            } else {
                                res.send(extenedOutfit);
                            }
                        });
                    }
                }
            });
        }
    });

    /* READ */
    app.get('/outfit/:uniqueName', async (req, res) => {
        let outfitUniqueName = req.params.uniqueName;
        let result = await outfitAPI.getOutfitByID(db, outfitUniqueName, req.flamesUser);

        interactionAPI.saveOutfitOpen(req, db);

        let err = result.error;
        let outfit = result.outfit;

        if (err) {
            res.status(500).send({ "error": err.message, "errorCode": err.code });
        } else {
            res.send(outfit);
        }
    });

    /* UPDATE */
    app.put('/outfit/:uniqueName', middleware.checkAuthentication, async function (req, res) {
        let outfitUniqueName = req.params.uniqueName;
        const outfitQuery = { "uniqueName": outfitUniqueName };
        let outfit = req.body;
        /* outfit validation */
        let validationResult = await utilities.validateOutfitUpdate(outfit, db);

        if (validationResult.failed) {
            res.status(500).send({ "error": validationResult.message })
        } else {
            if(outfit.previewImage) {
                let previewImage = await utilities.uploadImageFromUrl(outfit.previewImage, outfit.uniqueName);
                outfit.previewImage = previewImage;
            }
            if(outfit.image) {
                let image = await utilities.uploadImageFromUrl(outfit.image, outfit.uniqueName);
                outfit.image = image;
            }
            utilities.preProcessMongoDocumentUpdate(outfit);
            let updateDocument = { $set: outfit };
            db.collection(collectionName).findOneAndUpdate(outfitQuery, updateDocument, { returnOriginal: false }, async (err, output) => {
                if (err) {
                    res.status(500).send({ "error": err.message, "errorCode": err.code });
                } else if (!output.value) {
                    res.status(404).send({ "error": "No outfit " + outfitUniqueName + " found" });
                } else {
                    let result = await outfitAPI.getOutfitByID(db, output.value.uniqueName, req.flamesUser);

                    let err = result.error;
                    let extenedOutfit = result.outfit;

                    if (err) {
                        res.status(500).send({ "error": err.message, "errorCode": err.code });
                    } else {

                        let articlesUniqueNames = [];
                        let articlesNames = [];
                        let articlesColors = [];
                        let articlesBrands = [];
                        let articlesWearabilities = [];
                        let articlesDetails = [];
                        for (let i = 0; i < extenedOutfit.articles.length; i++) {
                            articlesUniqueNames = articlesUniqueNames.concat(extenedOutfit.articles[i].uniqueName);
                            articlesNames = articlesNames.concat(extenedOutfit.articles[i].name);
                            articlesColors = articlesColors.concat(extenedOutfit.articles[i].color);
                            articlesBrands = articlesBrands.concat(extenedOutfit.articles[i].brand);
                            articlesWearabilities = articlesWearabilities.concat(extenedOutfit.articles[i].wearability);
                            articlesDetails = articlesDetails.concat(extenedOutfit.articles[i].details);
                        }

                        let outfitTexts = {
                            outfitUniqueName: extenedOutfit.uniqueName,
                            outfitName: extenedOutfit.name,
                            occasionUniqueName: extenedOutfit.occasion[0].uniqueName,
                            occasionName: extenedOutfit.occasion[0].name,
                            styleUniqueName: extenedOutfit.style[0].uniqueName,
                            styleName: extenedOutfit.style[0].name,
                            stylistUniqueName: extenedOutfit.stylist[0].uniqueName,
                            stylistName: extenedOutfit.stylist[0].name,
                            articlesUniqueNames,
                            articlesNames,
                            articlesColors,
                            articlesBrands,
                            articlesWearabilities,
                            articlesDetails
                        };
                        
                        db.collection("outfitsTexts").updateOne({outfitUniqueName: outfitTexts.outfitUniqueName}, {$set: outfitTexts}, { upsert: true }, (err, result) => {
                            if (err) {
                                res.status(500).send({ "error": err.message, "errorCode": err.code });
                            } else {
                                res.send(extenedOutfit);
                            }
                        });
                    }
                }
            });
        }
    });

    /* DELETE */
    app.delete('/outfit/:uniqueName', middleware.checkAuthentication, (req, res) => {
        let outfitUniqueName = req.params.uniqueName;
        const outfitQuery = { "uniqueName": outfitUniqueName };
        db.collection(collectionName).findOneAndDelete(outfitQuery, (err, result) => {
            if (err) {
                res.status(500).send({ "error": err.message, "errorCode": err.code });
            } else if (!result.value) {
                res.status(404).send({ "error": "No outfit " + outfitUniqueName + " found" });
            } else {
                res.send("Outfit " + outfitUniqueName + " deleted!");
                const query = { outfitUniqueName };
                db.collection("outfitsTexts").findOneAndDelete(query, (err, result) => {

                });
            }
        });
    });

    /* QUERY */
    app.get('/outfits', async (req, res) => {

        let result = await outfitAPI.getAllOutfits(db, req.flamesUser);
        let err = result.error;
        let outfits = result.outfits;

        if (err) {
            res.status(500).send({ "error": err.message, "errorCode": err.code });
        } else {
            res.send(outfits);
        }
    });

    /* INSPIRE */
    app.get('/outfits/inspire', async (req, res) => {
        let urlQuery = req.query;
        let orderByField = urlQuery[constants.frontEnd.orderByParam];

        let userProfile = await interactionAPI.getUserProfile(req, db);
        let error = userProfile.error;
        let profile = userProfile.profile;
        let result;
        if(error || (profile && profile.length === 0)) {
            result = await outfitAPI.getAllOutfits(db, orderByField, constants.inspiration.maxOutfits, req.flamesUser);
        } else {
            result = await outfitAPI.getInspiration(db, orderByField, req.flamesUser, profile);
        }

        interactionAPI.saveInspirationSort(req, db);

        let err = result.error;
        let outfits = result.outfits;

        if (err) {
            res.status(500).send({ "error": err.message, "errorCode": err.code });
        } else {
            res.send(outfits);
        }
    });

    /* SEARCH */
    app.get('/outfits/search', async (req, res) => {
        let urlQuery = req.query;
        let filterByFields = urlQuery[constants.frontEnd.filterByParam];
        let searchByKeywords = urlQuery[constants.frontEnd.searchByParam];
        let orderByField = urlQuery[constants.frontEnd.orderByParam];

        let result = await outfitAPI.getSearchResults(db, filterByFields,searchByKeywords, orderByField, req.flamesUser);

        interactionAPI.saveOutfitSearch(req, db);
        interactionAPI.saveSearchSort(req, db);

        let err = result.error;
        let outfits = result.outfits;

        if (err) {
            res.status(500).send({ "error": err.message, "errorCode": err.code });
        } else {
            res.send(outfits);
        }
    });

    /* UPVOTE OUTFIT */
    app.put('/outfit/:uniqueName/upvote', async (req, res) => {
        let upvoteResult = await interactionAPI.saveOutfitUpvote(req, db);

        let upvoteErr = upvoteResult.error;
        let outfit = upvoteResult.outfit;

        if (upvoteErr) {
            res.status(500).send({ "error": upvoteErr.message, "errorCode": upvoteErr.code });
        } else {
            res.send(outfit);
        }
    });

    /* UNVOTE OUTFIT */
    app.put('/outfit/:uniqueName/unvote', async (req, res) => {
        let upvoteResult = await interactionAPI.deleteOutfitUpvote(req, db);

        let upvoteErr = upvoteResult.error;
        let outfit = upvoteResult.outfit;

        if (upvoteErr) {
            res.status(500).send({ "error": upvoteErr.message, "errorCode": upvoteErr.code });
        } else {
            res.send(outfit);
        }
    });
};
