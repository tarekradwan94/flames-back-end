const constants = require("../utils/constants");
const utilities = require("../utils/utilities");
const collectionName = "stylists";

module.exports = {
    getStylistByID: async function (db, stylistUniqueName) {
        const stylistQuery = { "uniqueName": stylistUniqueName };
        return await db.collection(collectionName).findOne(stylistQuery).then(stylist => {
            if (!stylist) {
                return {error: {message: "No stylist " + stylistUniqueName + " found"}, stylist: null};
            } else {
                return {error: null, stylist};
            }
        }).catch(error => {
            return {error, stylist: null};
        });
    },

    deleteStylistByID: async function (db, stylistUniqueName) {
        const stylistQuery = { "uniqueName": stylistUniqueName };
        return await db.collection(collectionName).deleteOne(stylistQuery).then(result => {
            return {error: null, stylist: null};
        }).catch(error => {
            return {error, stylist: null};
        });
    },

    updateStylistByID: async function (db, stylistUniqueName, stylist) {
        const stylistQuery = { "uniqueName": stylistUniqueName };
        utilities.preProcessMongoDocumentUpdate(stylist);
        let updateDocument = { $set: stylist };
        return await db.collection(collectionName).findOneAndUpdate(stylistQuery, updateDocument, { returnOriginal: false }).then(async result => {
            if (!result.value) {
                return {error: {message: "No stylist " + stylistUniqueName + " found" }, stylist: null};
            } else {
                const stylistTextQuery = { "stylistUniqueName": stylistUniqueName };
                let updateTextDocument = { $set: {stylistName: result.value.name} };
                return await db.collection("outfitsTexts").updateMany(stylistTextQuery, updateTextDocument, {}).then(output => {
                    return {error: null, stylist: result.value};
                });
            }
        }).catch(error => {
            return {error, stylist: null};
        });
    }
}