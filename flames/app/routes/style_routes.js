const utilities = require("../utils/utilities");
const collectionName = "styles";
const styleAPI = require("../api/styleAPI");
const middleware = require("../utils/middleware");
const constants = require("../utils/constants");

module.exports = function (app, db) {
    /* CREATE */
    app.post("/style", middleware.checkAuthentication, async (req, res) => {
        let style = req.body;
        /* style validation */
        let validationResult = utilities.validateStyleCreation(style);

        if (validationResult.failed) {
            res.status(500).send({ "error": validationResult.message })
        } else {
            let previewImage = await utilities.uploadImageFromUrl(style.previewImage, style.uniqueName);
            style.previewImage = previewImage;
            utilities.preProcessMongoDocumentCreation(style);
            db.collection(collectionName).insertOne(style, (err, result) => {
                if (err) {
                    res.status(500).send({ "error": err.message, "errorCode": err.code });
                } else {
                    res.send(result.ops[0]);
                }
            });
        }
    });

    /* READ */
    app.get('/style/:uniqueName', async (req, res) => {
        let styleUniqueName = req.params.uniqueName;
        let result = await styleAPI.getStyleByID(db, styleUniqueName);

        let err = result.error;
        let style = result.style;

        if (err) {
            res.status(500).send({ "error": err.message, "errorCode": err.code });
        } else {
            res.send(style);
        }
    });

    /* UPDATE */
    app.put('/style/:uniqueName', middleware.checkAuthentication, async (req, res) => {
        let styleUniqueName = req.params.uniqueName;
        let style = req.body;
        /* style validation */
        let validationResult = utilities.validateStyleUpdate(style);

        if (validationResult.failed) {
            res.status(500).send({ "error": validationResult.message })
        } else {

            let result = await styleAPI.getStyleByID(db, styleUniqueName);

            let err = result.error;
            let sourceStyle = result.style;
            
            if (err) {
                res.status(500).send({ "error": err.message, "errorCode": err.code });
            } else {
                if(style.previewImage) {
                    utilities.deleteImageFromUrl(sourceStyle.previewImage);
                    let previewImage = await utilities.uploadImageFromUrl(style.previewImage, style.uniqueName);
                    style.previewImage = previewImage;
                }

                let updateResult = await styleAPI.updateStyleByID(db, styleUniqueName, style);

                let updateErr = updateResult.error;
                let newStyle = updateResult.style;

                if (updateErr) {
                    res.status(500).send({ "error": updateErr.message, "errorCode": updateErr.code });
                } else {
                    res.send(newStyle);
                }
            }
        }
    });

    /* DELETE */
    app.delete('/style/:uniqueName', middleware.checkAuthentication, async (req, res) => {
        let styleUniqueName = req.params.uniqueName;
        let result = await styleAPI.getStyleByID(db, styleUniqueName);

        let err = result.error;
        let style = result.style;
        
        if (err) {
            res.status(500).send({ "error": err.message, "errorCode": err.code });
        } else {
            utilities.deleteImageFromUrl(style.previewImage);
            let deletionResult = await styleAPI.deleteStyleByID(db, styleUniqueName);
            let deletionErr = deletionResult.error;
            
            if (deletionErr) {
                res.status(500).send({ "error": deletionErr.message, "errorCode": deletionErr.code });
            } else {
                res.send("Style " + styleUniqueName + " deleted!");
            }
        }
    });

    /* QUERY */
    app.get('/styles', (req, res) => {
        db.collection(collectionName).find().toArray((err, styles) => {
            if (err) {
                res.status(500).send({ "error": err.message, "errorCode": err.code });
            } else {
                res.send(styles);
            }
        });
    });

    /* OUTFIT RELATION QUERY */
    app.get('/style/:uniqueName/outfits', (req, res) => {
        let userID = req.flamesUser ? req.flamesUser._id : "";
        let relationCollectionName = "outfits";
        let styleUniqueName = req.params.uniqueName;
        const styleQuery = { "styleID": styleUniqueName };
        db.collection(relationCollectionName).aggregate([ //unpack articles occasion, style and stylist relation
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
            { $match: styleQuery }
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
