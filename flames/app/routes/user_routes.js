const utilities = require("../utils/utilities");
const collectionName = "users";
const userAPI = require("../api/userAPI");
const middleware = require("../utils/middleware");

module.exports = function (app, db) {
    /* CREATE */
    app.post("/lead", async (req, res) => {
        let lead = req.body;
        /* lead validation */
        let validationResult = utilities.validateLeadCreation(lead);

        if (validationResult.failed) {
            res.status(500).send({ "error": validationResult.message })
        } else {

            let result = await userAPI.createLead(req, db, lead);

            let err = result.error;

            if (err) {
                res.status(500).send({ "error": err.message, "errorCode": err.code });
            } else {
                res.send(result.lead);
            }
        }
    });
};