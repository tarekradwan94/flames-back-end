const constants = require("../utils/constants");
const utilities = require("../utils/utilities");
const collectionName = "users";

module.exports = {
    createLead: async function(req, db, lead) {

        if(req.flamesUser) {
            req.flamesUser.email = lead.email;

            utilities.preProcessMongoDocumentUpdate(req.flamesUser);

            return await db.collection(collectionName).updateOne({_id: req.flamesUser._id}, {$set: req.flamesUser}).then((result) => {
                return {error: null, lead: req.flamesUser};
            }).catch(error => {
                return {error, lead: null};
            });
        } else {
            return {error: {message: "Lead cannot be saved"}, lead: null};
        }
    }
};