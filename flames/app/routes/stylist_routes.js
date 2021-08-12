const utilities = require("../utils/utilities");
const collectionName = "stylists";
const stylistAPI = require("../api/stylistAPI");
const middleware = require("../utils/middleware");

module.exports = function (app, db) {
    /* CREATE */
    app.post("/stylist", middleware.checkAuthentication, async (req, res) => {
        let stylist = req.body;
        /* stylist validation */
        let validationResult = utilities.validateStylistCreation(stylist);

        if (validationResult.failed) {
            res.status(500).send({ "error": validationResult.message })
        } else {
            let previewImage = await utilities.uploadImageFromUrl(stylist.previewImage, stylist.uniqueName);
            stylist.previewImage = previewImage;
            utilities.preProcessMongoDocumentCreation(stylist);
            db.collection(collectionName).insertOne(stylist, (err, result) => {
                if (err) {
                    res.status(500).send({ "error": err.message, "errorCode": err.code });
                } else {
                    res.send(result.ops[0]);
                }
            });
        }
    });

    /* READ */
    app.get('/stylist/:uniqueName', async (req, res) => {
        let stylistUniqueName = req.params.uniqueName;
        let result = await stylistAPI.getStylistByID(db, stylistUniqueName);

        let err = result.error;
        let stylist = result.stylist;

        if (err) {
            res.status(500).send({ "error": err.message, "errorCode": err.code });
        } else {
            res.send(stylist);
        }
    });

    /* UPDATE */
    app.put('/stylist/:uniqueName', middleware.checkAuthentication, async (req, res) => {
        let stylistUniqueName = req.params.uniqueName;
        let stylist = req.body;
        /* stylist validation */
        let validationResult = utilities.validateStylistUpdate(stylist);

        if (validationResult.failed) {
            res.status(500).send({ "error": validationResult.message })
        } else {

            let result = await stylistAPI.getStylistByID(db, stylistUniqueName);

            let err = result.error;
            let sourceStylist = result.stylist;
            
            if (err) {
                res.status(500).send({ "error": err.message, "errorCode": err.code });
            } else {
                if(stylist.previewImage) {
                    utilities.deleteImageFromUrl(sourceStylist.previewImage);
                    let previewImage = await utilities.uploadImageFromUrl(stylist.previewImage, stylist.uniqueName);
                    stylist.previewImage = previewImage;
                }

                let updateResult = await stylistAPI.updateStylistByID(db, stylistUniqueName, stylist);

                let updateErr = updateResult.error;
                let newStylist = updateResult.stylist;

                if (updateErr) {
                    res.status(500).send({ "error": updateErr.message, "errorCode": updateErr.code });
                } else {
                    res.send(newStylist);
                }
            }
        }
    });

    /* DELETE */
    app.delete('/stylist/:uniqueName', middleware.checkAuthentication, async (req, res) => {
        let stylistUniqueName = req.params.uniqueName;
        let result = await stylistAPI.getStylistByID(db, stylistUniqueName);

        let err = result.error;
        let stylist = result.stylist;
        
        if (err) {
            res.status(500).send({ "error": err.message, "errorCode": err.code });
        } else {
            utilities.deleteImageFromUrl(stylist.previewImage);

            let deletionResult = await stylistAPI.deleteStylistByID(db, stylistUniqueName);
            let deletionErr = deletionResult.error;
            
            if (deletionErr) {
                res.status(500).send({ "error": deletionErr.message, "errorCode": deletionErr.code });
            } else {
                res.send("Stylist " + stylistUniqueName + " deleted!");
            }
        }
    });

    /* QUERY */
    app.get('/stylists', (req, res) => {
        db.collection(collectionName).find().toArray((err, stylists) => {
            if (err) {
                res.status(500).send({ "error": err.message, "errorCode": err.code });
            } else {
                res.send(stylists);
            }
        });
    });
};
