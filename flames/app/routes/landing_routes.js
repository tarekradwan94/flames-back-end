const utilities = require("../utils/utilities");
const collectionName = "landingPages";

module.exports = function (app, db) {

    /* READ */
    app.get('/landing/:uniqueName', async (req, res) => {
        let landingUniqueName = req.params.uniqueName;

        const landingQuery = { "uniqueName": landingUniqueName };
        db.collection(collectionName).findOne(landingQuery).then(landing => {
            if (!landing) {
                res.status(500).send({ "error": "No style " + styleUniqueName + " found"});
            } else {
                res.send(landing);
            }
        }).catch(error => {
            res.status(500).send({ "error": error.message, "errorCode": error.code });
        });
    });

};