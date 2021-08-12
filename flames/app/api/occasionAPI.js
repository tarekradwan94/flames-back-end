const constants = require("../utils/constants");
const utilities = require("../utils/utilities");
const collectionName = "occasions";

module.exports = {
    getOccasionByID: async function (db, occasionUniqueName) {
        const occasionQuery = { "uniqueName": occasionUniqueName };
        return await db.collection(collectionName).findOne(occasionQuery).then(occasion => {
            if (!occasion) {
                return {error: {message: "No occasion " + occasionUniqueName + " found"}, occasion: null};
            } else {
                return {error: null, occasion};
            }
        }).catch(error => {
            return {error, occasion: null};
        });
    },

    deleteOccasionByID: async function (db, occasionUniqueName) {
        const occasionQuery = { "uniqueName": occasionUniqueName };
        return await db.collection(collectionName).deleteOne(occasionQuery).then(result => {
            return {error: null, occasion: null};
        }).catch(error => {
            return {error, occasion: null};
        });
    },

    updateOccasionByID: async function (db, occasionUniqueName, occasion) {
        const occasionQuery = { "uniqueName": occasionUniqueName };
        utilities.preProcessMongoDocumentUpdate(occasion);
        let updateDocument = { $set: occasion };
        return await db.collection(collectionName).findOneAndUpdate(occasionQuery, updateDocument, { returnOriginal: false }).then(async result => {
            if (!result.value) {
                return {error: {message: "No occasion " + occasionUniqueName + " found" }, occasion: null};
            } else {
                const occasionTextQuery = { "occasionUniqueName": occasionUniqueName };
                let updateTextDocument = { $set: {occasionName: result.value.name} };
                return await db.collection("outfitsTexts").updateMany(occasionTextQuery, updateTextDocument, {}).then(output => {
                    return {error: null, occasion: result.value};
                });
            }
        }).catch(error => {
            return {error, occasion: null};
        });
    }
}