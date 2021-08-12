const constants = require("../utils/constants");
const utilities = require("../utils/utilities");
const collectionName = "styles";

module.exports = {
    getStyleByID: async function (db, styleUniqueName) {
        const styleQuery = { "uniqueName": styleUniqueName };
        return await db.collection(collectionName).findOne(styleQuery).then(style => {
            if (!style) {
                return {error: {message: "No style " + styleUniqueName + " found"}, style: null};
            } else {
                return {error: null, style};
            }
        }).catch(error => {
            return {error, style: null};
        });
    },

    deleteStyleByID: async function (db, styleUniqueName) {
        const styleQuery = { "uniqueName": styleUniqueName };
        return await db.collection(collectionName).deleteOne(styleQuery).then(result => {
            return {error: null, style: null};
        }).catch(error => {
            return {error, style: null};
        });
    },

    updateStyleByID: async function (db, styleUniqueName, style) {
        const styleQuery = { "uniqueName": styleUniqueName };
        utilities.preProcessMongoDocumentUpdate(style);
        let updateDocument = { $set: style };
        return await db.collection(collectionName).findOneAndUpdate(styleQuery, updateDocument, { returnOriginal: false }).then(async result => {
            if (!result.value) {
                return {error: {message: "No style " + styleUniqueName + " found" }, style: null};
            } else {
                const styleTextQuery = { "styleUniqueName": styleUniqueName };
                let updateTextDocument = { $set: {styleName: result.value.name} };
                return await db.collection("outfitsTexts").updateMany(styleTextQuery, updateTextDocument, {}).then(output => {
                    return {error: null, style: result.value};
                });
            }
        }).catch(error => {
            return {error, style: null};
        });
    }
}