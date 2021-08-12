const utilities = require("../utils/utilities");
const collectionName = "occasions";
const occasionAPI = require("../api/occasionAPI");
const middleware = require("../utils/middleware");
const constants = require("../utils/constants");

module.exports = function (app, db) {
    /* CREATE */
    app.post("/occasion", middleware.checkAuthentication, async (req, res) => {
        let occasion = req.body;
        /* occasion validation */
        let validationResult = utilities.validateOccasionCreation(occasion);

        if (validationResult.failed) {
            res.status(500).send({ "error": validationResult.message })
        } else {
            let previewImage = await utilities.uploadImageFromUrl(occasion.previewImage, occasion.uniqueName);
            occasion.previewImage = previewImage;
            utilities.preProcessMongoDocumentCreation(occasion);
            db.collection(collectionName).insertOne(occasion, (err, result) => {
                if (err) {
                    res.status(500).send({ "error": err.message, "errorCode": err.code });
                } else {
                    res.send(result.ops[0]);
                }
            });
        }
    });

    /* READ */
    app.get('/occasion/:uniqueName', async (req, res) => {
        let occasionUniqueName = req.params.uniqueName;
        let result = await occasionAPI.getOccasionByID(db, occasionUniqueName);

        let err = result.error;
        let occasion = result.occasion;

        if (err) {
            res.status(500).send({ "error": err.message, "errorCode": err.code });
        } else {
            res.send(occasion);
        }
    });

    /* UPDATE */
    app.put('/occasion/:uniqueName', middleware.checkAuthentication, async (req, res) => {
        let occasionUniqueName = req.params.uniqueName;
        let occasion = req.body;
        /* occasion validation */
        let validationResult = utilities.validateOccasionUpdate(occasion);

        if (validationResult.failed) {
            res.status(500).send({ "error": validationResult.message })
        } else {

            let result = await occasionAPI.getOccasionByID(db, occasionUniqueName);

            let err = result.error;
            let sourceOccasion = result.occasion;
            
            if (err) {
                res.status(500).send({ "error": err.message, "errorCode": err.code });
            } else {
                if(occasion.previewImage) {
                    utilities.deleteImageFromUrl(sourceOccasion.previewImage);
                    let previewImage = await utilities.uploadImageFromUrl(occasion.previewImage, occasion.uniqueName);
                    occasion.previewImage = previewImage;
                }

                let updateResult = await occasionAPI.updateOccasionByID(db, occasionUniqueName, occasion);

                let updateErr = updateResult.error;
                let newOccasion = updateResult.occasion;

                if (updateErr) {
                    res.status(500).send({ "error": updateErr.message, "errorCode": updateErr.code });
                } else {
                    res.send(newOccasion);
                }
            }
        }
    });

    /* DELETE */
    app.delete('/occasion/:uniqueName', middleware.checkAuthentication, async (req, res) => {
        let occasionUniqueName = req.params.uniqueName;
        let result = await occasionAPI.getOccasionByID(db, occasionUniqueName);

        let err = result.error;
        let occasion = result.occasion;
        
        if (err) {
            res.status(500).send({ "error": err.message, "errorCode": err.code });
        } else {
            utilities.deleteImageFromUrl(occasion.previewImage);
            let deletionResult = await occasionAPI.deleteOccasionByID(db, occasionUniqueName);
            let deletionErr = deletionResult.error;
            
            if (deletionErr) {
                res.status(500).send({ "error": deletionErr.message, "errorCode": deletionErr.code });
            } else {
                res.send("Occasion " + occasionUniqueName + " deleted!");
            }
        }
    });

    /* QUERY */
    app.get('/occasions', (req, res) => {
        db.collection(collectionName).find().toArray((err, occasions) => {
            if (err) {
                res.status(500).send({ "error": err.message, "errorCode": err.code });
            } else {
                res.send(occasions);
            }
        });
    });

    /* OUTFIT RELATION QUERY */
    app.get('/occasion/:uniqueName/outfits', (req, res) => {
        let userID = req.flamesUser ? req.flamesUser._id : "";
        let relationCollectionName = "outfits";
        let occasionUniqueName = req.params.uniqueName;
        const occasionQuery = { "occasionID": occasionUniqueName };
        db.collection(relationCollectionName).aggregate([ //unpack articles, occasion, style and stylist relation
            {
                $lookup:
                {
                    from: "occasions",
                    localField: "occasionID",
                    foreignField: "uniqueName",
                    as: "occasion"
                }
            },
            {
                $lookup:
                {
                    from: "styles",
                    localField: "styleID",
                    foreignField: "uniqueName",
                    as: "style"
                }
            },
            {
                $lookup:
                {
                    from: "stylists",
                    localField: "stylistID",
                    foreignField: "uniqueName",
                    as: "stylist"
                }
            },
            {
                $lookup:
                {
                    from: "articles",
                    localField: "articleIDs",
                    foreignField: "uniqueName",
                    as: "articles"
                }
            },
            {
                $lookup:
                {
                    from: "interactions",
                    as: "isUpvoted",
                    let: { outfitUniqueName: '$uniqueName' },
                    pipeline: [
                        {
                          $match: {
                            $expr: {
                                $and: [
                                  { $eq: ['$outfitID', '$$outfitUniqueName'] },
                                  { $eq: ['$userID', userID ] },
                                  { $eq: ['$action', constants.interactions.outfitUpvoteAction ] }
                                ]
                              }
                          }
                        }
                    ]
                }
            },
            { $match: occasionQuery }
        ]).toArray( async (err, outfits) => {
            if (err) {
                res.status(500).send({ "error": err.message, "errorCode": err.code });
            } else {
                for(let i = 0; i < outfits.length; i++) {
                    outfits[i].isUpvoted = outfits[i].isUpvoted.length > 0;
                }
                res.send(outfits);
            }
        });
    });
};
