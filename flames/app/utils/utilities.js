const constants = require("./constants");
const shopify = require("../../config/shopify");
const bcrypt = require('bcrypt');
const { BlobServiceClient, StorageSharedKeyCredential } = require("@azure/storage-blob");
const cdn = require("../../config/cdn");
const fetch = require('node-fetch');

module.exports = {
    getRandomString: function (length) {
        let result           = '';
        let characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let charactersLength = characters.length;
        for ( let i = 0; i < length; i++ ) {
           result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    },
    checkBasicAuthentication: async function (username, password, databaseInstance) {

        const userQuery = { "email": username };
        let result = await databaseInstance.collection("users").findOne(userQuery).then((user) => {
            if (!user) {
                return { error: { "error": "User unauthorized", "errorCode": 401 }, user: null };
            } else {
                return { error: null, user};
            }
        }).catch(err => {
            return { error: { "error": err.message, "errorCode": err.code }, user: null };
        });

        if (result.error) {
            return result;
        } else {
            let salt = result.user.salt;
            let checkResult = await bcrypt.hash(password, salt).then((hash) => {
                if (hash !== result.user.password) {
                    return { error: { "error": "User unauthorized", "errorCode": 401 }, user: null };
                } else {
                    return { error: null, user: result.user};
                }
            }).catch(err => {
                return { error: { "error": err.message, "errorCode": err.code }, user: null };
            });
            return checkResult;
        }
    },

    cleanObject: function (obj) {
        //remove all empty fields
        Object.keys(obj).forEach(key => {
            if (obj[key] && obj[key] instanceof Array && obj[key].length === 0) {
                delete obj[key]; // delete
            }
            else if (obj[key] && typeof obj[key] === "object") {
                this.cleanObject(obj[key]); // recurse
            }
            else if (obj[key] === null || obj[key] === undefined) {
                delete obj[key]; // delete
            }
        });
    },
    preProcessMongoDocumentCreation: function (document) {
        document.createdAt = new Date(); //automatically add timestamp
        document.updatedAt = new Date(); //automatically add timestamp
        if (document.uniqueName) { //safety check
            document._id = document.uniqueName; //in order to statically (seed) reference other documents with known ObjectID
        }
    },
    preProcessMongoDocumentUpdate: function (document) {
        document.updatedAt = new Date(); //automatically update timestamp
    },
    checkEmailString: function (emailString) {
        let validationResult = {
            failed: false,
            message: null
        };
        if(!(/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/.test(emailString))) {
            validationResult.failed = true;
            validationResult.message = "Email format is wrong";
        }

        return validationResult;
    },

    /* VALIDATIONS */
    validateMandatoryFields: function (object, mandatoryFields) {
        let validationResult = {
            failed: false,
            message: null
        };

        for (let i = 0; i < mandatoryFields.length; i++) {
            let fieldValue = object[mandatoryFields[i]];
            if (fieldValue === undefined || fieldValue === null || fieldValue === "") {
                validationResult.failed = true;
                validationResult.message = "Mandatory field '" + mandatoryFields[i] + "' is missing or empty";
                return validationResult;
            };
        }

        return validationResult;
    },
    validateFieldTypes: function (object, fieldTypes) {
        let validationResult = {
            failed: false,
            message: null
        };

        for (let i = 0; i < fieldTypes.length; i++) {
            let field = object[fieldTypes[i].field];
            if (field === undefined) {
                continue; //skip fields validation when if they were not provided
            } else {
                if (!(field instanceof fieldTypes[i].class) && !fieldTypes[i].type.includes(typeof (field))) {
                    validationResult.failed = true;
                    validationResult.message = "Field '" + fieldTypes[i].field + "' must be of type " + fieldTypes[i].type.join(" or ");
                    return validationResult;
                }
            }
        }

        return validationResult;
    },
    validateOccasionCreation: function (occasion) {
        this.cleanObject(occasion);

        /* first validation: occasion mandatory fields */
        const occasionMandatoryFields = ["uniqueName", "name", "previewImage"];
        let validationResult = this.validateMandatoryFields(occasion, occasionMandatoryFields);
        if (validationResult.failed) {
            return validationResult;
        }

        /* second validation: occasion fields types */
        const occasionFieldsTypes = [
            { field: "uniqueName", type: ["string"], class: String },
            { field: "name", type: ["string"], class: String },
            { field: "previewImage", type: ["string"], class: String }];
        validationResult = this.validateFieldTypes(occasion, occasionFieldsTypes);
        if (validationResult.failed) {
            return validationResult;
        }

        return validationResult;
    },
    validateOccasionUpdate: function (occasion) {
        this.cleanObject(occasion);

        /* first validation: occasion fields types */
        const occasionFieldsTypes = [
            { field: "uniqueName", type: ["string"], class: String },
            { field: "name", type: ["string"], class: String },
            { field: "previewImage", type: ["string"], class: String }];
        let validationResult = this.validateFieldTypes(occasion, occasionFieldsTypes);
        if (validationResult.failed) {
            return validationResult;
        }

        return validationResult;
    },
    validateStyleCreation: function (style) {
        this.cleanObject(style);

        /* first validation: style mandatory fields */
        const styleMandatoryFields = ["uniqueName", "name", "previewImage"];
        let validationResult = this.validateMandatoryFields(style, styleMandatoryFields);
        if (validationResult.failed) {
            return validationResult;
        }

        /* second validation: style fields types */
        const styleFieldsTypes = [
            { field: "uniqueName", type: ["string"], class: String },
            { field: "name", type: ["string"], class: String },
            { field: "previewImage", type: ["string"], class: String }];
        validationResult = this.validateFieldTypes(style, styleFieldsTypes);
        if (validationResult.failed) {
            return validationResult;
        }

        return validationResult;
    },
    validateStyleUpdate: function (style) {
        this.cleanObject(style);

        /* first validation: style fields types */
        const styleFieldsTypes = [
            { field: "uniqueName", type: ["string"], class: String },
            { field: "name", type: ["string"], class: String },
            { field: "previewImage", type: ["string"], class: String }];
        let validationResult = this.validateFieldTypes(style, styleFieldsTypes);
        if (validationResult.failed) {
            return validationResult;
        }

        return validationResult;
    },
    validateStylistCreation: function (stylist) {
        this.cleanObject(stylist);

        /* first validation: stylist mandatory fields */
        const stylistMandatoryFields = ["uniqueName", "name", "previewImage"];
        let validationResult = this.validateMandatoryFields(stylist, stylistMandatoryFields);
        if (validationResult.failed) {
            return validationResult;
        }

        /* second validation: stylist fields types */
        const stylistFieldsTypes = [
            { field: "uniqueName", type: ["string"], class: String },
            { field: "name", type: ["string"], class: String },
            { field: "previewImage", type: ["string"], class: String }];
        validationResult = this.validateFieldTypes(stylist, stylistFieldsTypes);
        if (validationResult.failed) {
            return validationResult;
        }

        return validationResult;
    },
    validateStylistUpdate: function (stylist) {
        this.cleanObject(stylist);

        /* first validation: stylist fields types */
        const stylistFieldsTypes = [
            { field: "uniqueName", type: ["string"], class: String },
            { field: "name", type: ["string"], class: String },
            { field: "previewImage", type: ["string"], class: String }];
        let validationResult = this.validateFieldTypes(stylist, stylistFieldsTypes);
        if (validationResult.failed) {
            return validationResult;
        }

        return validationResult;
    },
    validateExternalMongoDBReference: async function (db, collectionName, uniqueName) {
        let validationResult = {
            failed: false,
            message: null
        };

        const query = { "uniqueName": uniqueName };
        let document = await db.collection(collectionName).findOne(query);
        if (!document) {
            validationResult.failed = true;
            validationResult.message = "No " + collectionName + " '" + uniqueName + "' found";
        }
        return validationResult;
    },
    validateOutfitCreation: async function (outfit, db) {
        this.cleanObject(outfit);

        /* first validation: outfit mandatory fields */
        const outfitMandatoryFields = ["uniqueName", "name", "previewImage", "image", "votesCounter", "totalPrice", "currency", "occasionID", "styleID", "stylistID", "articleIDs"];
        let validationResult = this.validateMandatoryFields(outfit, outfitMandatoryFields);
        if (validationResult.failed) {
            return validationResult;
        }

        /* second validation: outfit fields types */
        const outfitFieldsTypes = [
            { field: "uniqueName", type: ["string"], class: String },
            { field: "name", type: ["string"], class: String },
            { field: "previewImage", type: ["string"], class: String },
            { field: "image", type: ["string"], class: String },
            { field: "votesCounter", type: ["number"], class: Number },
            { field: "totalPrice", type: ["number"], class: Number },
            { field: "currency", type: ["string"], class: String },
            { field: "occasionID", type: ["string"], class: String },
            { field: "styleID", type: ["string"], class: String },
            { field: "stylistID", type: ["string"], class: String },
            { field: "articleIDs", type: ["array"], class: Array }];
        validationResult = this.validateFieldTypes(outfit, outfitFieldsTypes);
        if (validationResult.failed) {
            return validationResult;
        }

        validationResult = await this.validateExternalMongoDBReference(db, "occasions", outfit.occasionID);
        if (validationResult.failed) {
            return validationResult;
        }

        validationResult = await this.validateExternalMongoDBReference(db, "styles", outfit.styleID);
        if (validationResult.failed) {
            return validationResult;
        }

        validationResult = await this.validateExternalMongoDBReference(db, "stylists", outfit.stylistID);
        if (validationResult.failed) {
            return validationResult;
        }

        return validationResult;
    },
    validateOutfitUpdate: async function (outfit, db) {
        this.cleanObject(outfit);

        /* first validation: outfit fields types */
        const outfitFieldsTypes = [
            { field: "uniqueName", type: ["string"], class: String },
            { field: "name", type: ["string"], class: String },
            { field: "previewImage", type: ["string"], class: String },
            { field: "image", type: ["string"], class: String },
            { field: "votesCounter", type: ["number"], class: Number },
            { field: "totalPrice", type: ["number"], class: Number },
            { field: "currency", type: ["string"], class: String },
            { field: "occasionID", type: ["string"], class: String },
            { field: "styleID", type: ["string"], class: String },
            { field: "stylistID", type: ["string"], class: String },
            { field: "articleIDs", type: ["array"], class: Array }];
        let validationResult = this.validateFieldTypes(outfit, outfitFieldsTypes);
        if (validationResult.failed) {
            return validationResult;
        }

        if (outfit.occasionID) {
            validationResult = await this.validateExternalMongoDBReference(db, "occasions", outfit.occasionID);
            if (validationResult.failed) {
                return validationResult;
            }
        }

        if (outfit.styleID) {
            validationResult = await this.validateExternalMongoDBReference(db, "styles", outfit.styleID);
            if (validationResult.failed) {
                return validationResult;
            }
        }

        if (outfit.stylistID) {
            validationResult = await this.validateExternalMongoDBReference(db, "stylists", outfit.stylistID);
            if (validationResult.failed) {
                return validationResult;
            }
        }

        return validationResult;
    },
    validateFlamesArticleCreation: function (flamesArticle) {
        let validationResult = {
            failed: false,
            message: null
        };

        this.cleanObject(flamesArticle);

        /* first validation: article mandatory fields */
        const articleMandatoryFields = ["uniqueName", "name", "details", "previewImage", "images", "brand", "color", "sizes", "wearability", "price", "currency"];
        for (let i = 0; i < articleMandatoryFields.length; i++) {
            let fieldValue = flamesArticle[articleMandatoryFields[i]];
            if (fieldValue === undefined || fieldValue === null || fieldValue === "") {
                validationResult.failed = true;
                validationResult.message = "Mandatory field '" + articleMandatoryFields[i] + "' is missing or empty";
                return validationResult;
            };
        }

        /* second validation: sizes mandatory fields */
        const sizeMandatoryFields = ["size", "quantity"];
        for (let i = 0; i < sizeMandatoryFields.length; i++) {
            for (let l = 0; l < flamesArticle.sizes.length; l++) {
                let fieldValue = flamesArticle.sizes[l][sizeMandatoryFields[i]];
                if (fieldValue === undefined || fieldValue === null || fieldValue === "") {
                    validationResult.failed = true;
                    validationResult.message = "Mandatory field '" + sizeMandatoryFields[i] + "' is missing or empty in 'sizes' node number " + (l + 1);
                    return validationResult;
                };
            }
        }

        /* third validation: article fields types */
        const articleFieldsTypes = [
            { field: "uniqueName", type: ["string"], class: String },
            { field: "name", type: ["string"], class: String },
            { field: "details", type: ["string"], class: String },
            { field: "previewImage", type: ["string"], class: String },
            { field: "images", type: ["array"], class: Array }, //"array" type doesn't exist, it's used just in the concatenation of the error message
            { field: "brand", type: ["string"], class: String },
            { field: "color", type: ["string"], class: String },
            { field: "sizes", type: ["array"], class: Array },
            { field: "wearability", type: ["string"], class: String },
            { field: "price", type: ["number"], class: Number },
            { field: "currency", type: ["string"], class: String }];
        for (let i = 0; i < articleFieldsTypes.length; i++) {
            let articleField = flamesArticle[articleFieldsTypes[i].field];
            if (!(articleField instanceof articleFieldsTypes[i].class) && !articleFieldsTypes[i].type.includes(typeof (articleField))) {
                validationResult.failed = true;
                validationResult.message = "Field '" + articleFieldsTypes[i].field + "' must be of type " + articleFieldsTypes[i].type.join(" or ");
                return validationResult;
            }
        }

        /* fourth validation: size fields types */
        const sizeFieldsTypes = [
            { field: "size", type: ["string"], class: String },
            { field: "quantity", type: ["number"], class: Number }];
        for (let i = 0; i < sizeFieldsTypes.length; i++) {
            for (let l = 0; l < flamesArticle.sizes.length; l++) {
                let sizeField = flamesArticle.sizes[l][sizeFieldsTypes[i].field];
                if (!(sizeField instanceof sizeFieldsTypes[i].class) && !sizeFieldsTypes[i].type.includes(typeof (sizeField))) {
                    validationResult.failed = true;
                    validationResult.message = "Field '" + sizeFieldsTypes[i].field + "' must be of type " + sizeFieldsTypes[i].type.join(" or ") + " in 'sizes' node number " + (l + 1);
                    return validationResult;
                }
            }
        }

        /* fifth validation: uniqueName all lowercase */
        if(flamesArticle.uniqueName !== flamesArticle.uniqueName.toLowerCase()) {
            validationResult.failed = true;
            validationResult.message = "Field 'uniqueName' must be all lower case";
            return validationResult;
        }

        return validationResult;
    },
    validateFlamesArticleUpdate: function (flamesArticle) {
        let validationResult = {
            failed: false,
            message: null
        };

        this.cleanObject(flamesArticle);

        /* first validation: article fields types */
        const articleFieldsTypes = [
            { field: "uniqueName", type: ["string"], class: String },
            { field: "name", type: ["string"], class: String },
            { field: "details", type: ["string"], class: String },
            { field: "previewImage", type: ["string"], class: String },
            { field: "images", type: ["array"], class: Array }, //"array" type doesn't exist, it's used just in the concatenation of the error message
            { field: "brand", type: ["string"], class: String },
            { field: "color", type: ["string"], class: String },
            { field: "sizes", type: ["array"], class: Array },
            { field: "wearability", type: ["string"], class: String },
            { field: "price", type: ["number"], class: Number },
            { field: "currency", type: ["string"], class: String }];
        for (let i = 0; i < articleFieldsTypes.length; i++) {
            let articleField = flamesArticle[articleFieldsTypes[i].field];
            if (articleField === undefined) {
                continue; //skip fields validation when if they were not provided (no update needed)
            }
            else if (!(articleField instanceof articleFieldsTypes[i].class) && !articleFieldsTypes[i].type.includes(typeof (articleField))) {
                validationResult.failed = true;
                validationResult.message = "Field '" + articleFieldsTypes[i].field + "' must be of type " + articleFieldsTypes[i].type.join(" or ");
                return validationResult;
            }
        }

        /* second validation: size fields types */
        if (flamesArticle.sizes !== undefined) { //if sizes were provided
            const sizeFieldsTypes = [
                { field: "size", type: ["string"], class: String },
                { field: "quantity", type: ["number"], class: Number }];
            for (let i = 0; i < sizeFieldsTypes.length; i++) {
                for (let l = 0; l < flamesArticle.sizes.length; l++) {
                    let sizeField = flamesArticle.sizes[l][sizeFieldsTypes[i].field];
                    if (sizeField === undefined) {
                        continue; //skip fields validation when if they were not provided (no update needed)
                    }
                    else if (!(sizeField instanceof sizeFieldsTypes[i].class) && !sizeFieldsTypes[i].type.includes(typeof (sizeField))) {
                        validationResult.failed = true;
                        validationResult.message = "Field '" + sizeFieldsTypes[i].field + "' must be of type " + sizeFieldsTypes[i].type.join(" or ") + " in 'sizes' node number " + (l + 1);
                        return validationResult;
                    }
                }
            }
        }

        /* third validation: only positive price and quantity */
        if (flamesArticle.price !== undefined && flamesArticle.price <= 0) {
            validationResult.failed = true;
            validationResult.message = "Price can be only positive";
            return validationResult;
        }

        if (flamesArticle.sizes !== undefined) { //if sizes were provided
            for (let l = 0; l < flamesArticle.sizes.length; l++) {
                let size = flamesArticle.sizes[l];
                if (size.quantity !== undefined && size.quantity <= 0) {
                    validationResult.failed = true;
                    validationResult.message = "Quantity in 'sizes' node number " + (l + 1) + " can be only positive";
                    return validationResult;
                }
            }
        }

        /* fourth validation: sizes mandatory fields */
        if (flamesArticle.sizes !== undefined) { //if sizes were provided
            const sizeMandatoryFields = ["size"];
            for (let i = 0; i < sizeMandatoryFields.length; i++) {
                for (let l = 0; l < flamesArticle.sizes.length; l++) {
                    let fieldValue = flamesArticle.sizes[l][sizeMandatoryFields[i]];
                    if (fieldValue === undefined || fieldValue === null || fieldValue === "") {
                        validationResult.failed = true;
                        validationResult.message = "Mandatory field '" + sizeMandatoryFields[i] + "' is missing or empty in 'sizes' node number " + (l + 1);
                        return validationResult;
                    };
                }
            }
        }

        /* fifth validation: uniqueName all lowercase */
        if(flamesArticle.uniqueName !== undefined && flamesArticle.uniqueName !== flamesArticle.uniqueName.toLowerCase()) {
            validationResult.failed = true;
            validationResult.message = "Field 'uniqueName' must be all lower case";
            return validationResult;
        }

        return validationResult;
    },
    validateOutfitUpvote: function(actionBody) {
        let validationResult = {
            failed: false,
            message: null
        };

        this.cleanObject(actionBody);
        if(actionBody.outfitUniqueName === undefined || actionBody.outfitUniqueName.trim() === "") {
            validationResult.failed = true;
            validationResult.message = "Field 'outfitUniqueName' is missing or empty";
            return validationResult;
        }

        return validationResult;
    },

    validateShowTime: function(actionBody) {
        let validationResult = {
            failed: false,
            message: null
        };

        this.cleanObject(actionBody);
        if(actionBody.showTime === undefined) {
            validationResult.failed = true;
            validationResult.message = "Field 'outfitUniqueName' is missing or empty";
            return validationResult;
        } else if(!(actionBody.showTime > 0)) {
            validationResult.failed = true;
            validationResult.message = "Show time can only be positive";
            return validationResult;
        }

        return validationResult;
    },

    validateLeadCreation: function (lead) {
        this.cleanObject(lead);

        /* first validation: lead mandatory fields */
        const leadMandatoryFields = ["email"];
        let validationResult = this.validateMandatoryFields(lead, leadMandatoryFields);
        if (validationResult.failed) {
            return validationResult;
        }

        /* second validation: stylist fields types */
        const leadFieldsTypes = [
            { field: "email", type: ["string"], class: String }];
        validationResult = this.validateFieldTypes(lead, leadFieldsTypes);
        if (validationResult.failed) {
            return validationResult;
        }

        validationResult = this.checkEmailString(lead.email);

        return validationResult;
    },

    /* CONVERSIONS */
    convertFlamesArticleToShopifyArticle: async function (flamesArticle, shopifyConfig) {
        //images
        let articleImagesSrc = [];
        if (flamesArticle.previewImage) {
            let previewImage = await this.uploadImageFromUrl(flamesArticle.previewImage, flamesArticle.uniqueName);
            articleImagesSrc.push({ src: previewImage }); //previewImage must be the first one
        }
        if (flamesArticle.images) {
            for (let i = 0; i < flamesArticle.images.length; i++) {
                let image = await this.uploadImageFromUrl(flamesArticle.images[i], flamesArticle.uniqueName);
                articleImagesSrc.push({ src: image });
            }
        }

        //sizes and general data into variants
        let articleSizes = [];
        if (flamesArticle.sizes) {
            for (let i = 0; i < flamesArticle.sizes.length; i++) {
                articleSizes.push({ //flames sizes correspond to shopify variants "de facto"
                    options: [flamesArticle.color || "", flamesArticle.wearability || "", flamesArticle.sizes[i].size || ""],
                    price: flamesArticle.price ? flamesArticle.price + "" : null,
                    inventoryManagement: constants.shopify.inventoryManagementValue,
                    inventoryPolicy: constants.shopify.inventoryPolicyValue,
                    inventoryQuantities: {
                        availableQuantity: flamesArticle.sizes[i].quantity,
                        locationId: "gid://shopify/Location/" + shopifyConfig.locationID
                    }
                });
            }
        }

        //general data
        let shopifyArticle = {
            handle: flamesArticle.uniqueName,
            tags: [flamesArticle.uniqueName], //this will be used in products query syntax as it doesn't allow the use of 'handle'
            title: flamesArticle.name,
            descriptionHtml: flamesArticle.details,
            vendor: flamesArticle.brand,
            options: constants.shopify.articleOptions,
            images: articleImagesSrc,
            variants: articleSizes
        };

        this.cleanObject(shopifyArticle);

        return shopifyArticle;
    },
    applyCommonShopifyArticleToFlamesArticleConversion: function (genericShopifyArticle) {
        //general data
        let flamesArticle = {
            uniqueName: genericShopifyArticle.handle,
            name: genericShopifyArticle.title,
            details: genericShopifyArticle.description,
            brand: genericShopifyArticle.vendor,
            currency: constants.shopify.currency,
            createdAt: genericShopifyArticle.createdAt,
            updatedAt: genericShopifyArticle.updatedAt,
        };

        //images
        let articleImagesSrc = [];
        if (genericShopifyArticle.images && genericShopifyArticle.images.edges.length) {
            flamesArticle.previewImage = genericShopifyArticle.images.edges[0].node.originalSrc; //previewImage is always the first one

            for (let i = 1; i < genericShopifyArticle.images.edges.length; i++) {
                articleImagesSrc.push(genericShopifyArticle.images.edges[i].node.originalSrc);
            }
        }
        flamesArticle.images = articleImagesSrc;

        return flamesArticle;
    },
    convertShopifyAdminArticleToFlamesArticle: function (shopifyAdminArticle) {
        let flamesArticle = this.applyCommonShopifyArticleToFlamesArticleConversion(shopifyAdminArticle);

        //sizes && general data from variants
        let articleSizes = [];
        if (shopifyAdminArticle.variants && shopifyAdminArticle.variants.edges.length) {

            let firstVariant = shopifyAdminArticle.variants.edges[0].node;
            flamesArticle.price = parseFloat(firstVariant.price, 10);
            for (let l = 0; l < firstVariant.selectedOptions.length; l++) {
                flamesArticle[firstVariant.selectedOptions[l].name] = firstVariant.selectedOptions[l].value;
            }
            delete flamesArticle.size; //sizes is an array

            for (let i = 0; i < shopifyAdminArticle.variants.edges.length; i++) {
                let variant = shopifyAdminArticle.variants.edges[i].node;
                for (let l = 0, sizeFound = false; l < variant.selectedOptions.length && !sizeFound; l++) {
                    if (variant.selectedOptions[l].name === "size") {
                        sizeFound = true;
                        articleSizes.push({
                            quantity: variant.inventoryQuantity,
                            size: variant.selectedOptions[l].value
                        });
                    }
                }
            }
        }
        flamesArticle.sizes = articleSizes;

        this.cleanObject(flamesArticle);

        return flamesArticle;
    },
    convertShopifyArticleToFlamesArticle: function (shopifyArticle) {
        let flamesArticle = this.applyCommonShopifyArticleToFlamesArticleConversion(shopifyArticle);

        //sizes && general data from variants
        let articleSizes = [];
        if (shopifyArticle.variants && shopifyArticle.variants.edges.length) {

            let firstVariant = shopifyArticle.variants.edges[0].node;
            flamesArticle.price = parseFloat(firstVariant.priceV2.amount, 10);
            for (let l = 0; l < firstVariant.selectedOptions.length; l++) {
                flamesArticle[firstVariant.selectedOptions[l].name] = firstVariant.selectedOptions[l].value;
            }
            delete flamesArticle.size; //sizes is an array

            for (let i = 0; i < shopifyArticle.variants.edges.length; i++) {
                let variant = shopifyArticle.variants.edges[i].node;
                for (let l = 0, sizeFound = false; l < variant.selectedOptions.length && !sizeFound; l++) {
                    if (variant.selectedOptions[l].name === "size") {
                        sizeFound = true;
                        articleSizes.push({
                            quantity: variant.quantityAvailable,
                            size: variant.selectedOptions[l].value
                        });
                    }
                }
            }
        }
        flamesArticle.sizes = articleSizes;

        this.cleanObject(flamesArticle);

        return flamesArticle;
    },

    /* IMAGES REPOSITORY MANAGEMENT */
    uploadImageFromUrl: async function(url, imageName) {
        let httpsPattern = /^https?:\/\//i;
        let httpPattern = /^http?:\/\//i;
        if (httpsPattern.test(url) || httpPattern.test(url)) { //only absolute urls
            const sharedKeyCredential = new StorageSharedKeyCredential(cdn.account, cdn.key);

            const blobServiceClient = new BlobServiceClient(
            `https://${cdn.account}.blob.core.windows.net`,
            sharedKeyCredential
            );

            const containerClient = blobServiceClient.getContainerClient(cdn.container);

            let result = await fetch(url).then((res) => {
                return res;
            });
            let imageBlob = result.body;
            let imageContentType = result.headers.get("content-type") || constants.defaultImagesContentType;
            let blobName = imageName + new Date().getTime();
            let blockBlobClient = containerClient.getBlockBlobClient(blobName);
            var blobHttpHeader = {};
            blobHttpHeader.blobContentType = imageContentType;
            //
            //blockBlobClient.setHTTPHeaders({"blobContentType": imageContentType, "blobContentDisposition": "attachment; filename=package.jpeg"});

            let uploadBlobResponse = await blockBlobClient.uploadStream(imageBlob);
            let blobHTTPHeadersResponse = await blockBlobClient.setHTTPHeaders(blobHttpHeader);
            return cdn.endpoint + "/" + cdn.container + "/" + blobName;
        } else {
            return url;
        }
    },

    deleteImageFromUrl: async function(url) {
        let httpsPattern = /^https?:\/\//i;
        let httpPattern = /^http?:\/\//i;
        if (httpsPattern.test(url) || httpPattern.test(url)) { //only absolute urls
            const sharedKeyCredential = new StorageSharedKeyCredential(cdn.account, cdn.key);

            const blobServiceClient = new BlobServiceClient(
            `https://${cdn.account}.blob.core.windows.net`,
            sharedKeyCredential
            );

            const containerClient = blobServiceClient.getContainerClient(cdn.container);

            let blobName = url.replace(cdn.endpoint + "/" + cdn.container + "/", "");
            let blockBlobClient = containerClient.getBlockBlobClient(blobName);
            blockBlobClient.delete().then(uploadBlobResponse => {
                /* log something */
            }).catch((err) => {
                /* log something */
            });
        }
    }
};