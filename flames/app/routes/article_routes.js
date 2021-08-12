const utilities = require("../utils/utilities");
const fetch = require('node-fetch');
const constants = require("../utils/constants");
const articleAPI = require("../api/articleAPI");
const middleware = require("../utils/middleware");
/* Main difference compared to the other APIs is that the database is both MongoDB and Shopify */

module.exports = function (app, db, shopifyConfig) {
    /* CREATE */
    app.post("/article", middleware.checkAuthentication, async (req, res) => {
        let article = req.body;
        /* article validation */
        let validationResult = utilities.validateFlamesArticleCreation(article);

        if (validationResult.failed) {
            res.status(500).send({ "error": validationResult.message })
        } else {
            /* pre process Shopify article */
            const input = await utilities.convertFlamesArticleToShopifyArticle(article, shopifyConfig);

            const base64Credentials = Buffer.from(shopifyConfig.username + ":" + shopifyConfig.password).toString("base64");

            let articleUniqueName = input.handle;
            const query = `{
                productByHandle(handle: "${articleUniqueName}") {
                    id
                }
            }`;

            /* first step check if the uniqueName is already reserved for another article */
            fetch(shopifyConfig.adminGraphQLAPI, {
                method: "POST",
                headers: {
                    "Authorization": `Basic ${base64Credentials}`,
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({ query })
            }).then(output => {
                return output.json();
            }).then(article => {
                if (article && article.data && article.data.productByHandle && article.data.productByHandle.id) {
                    res.status(500).send({ "error": "uniqueName '" + articleUniqueName + "' is already used by another article" });
                    for(let k = 0; k < input.images.length; k++) {
                        utilities.deleteImageFromUrl(input.images[k].src);
                    }
                } else {
                    const query = `mutation productCreate($input: ProductInput!) {
                        productCreate(input: $input) {
                            product {
                                id
                                description
                                createdAt
                                handle
                                title
                                description
                                images(first: ${constants.shopify.recordsQuantityLimit}) {
                                    edges {
                                        node {
                                        originalSrc
                                        }
                                    }
                                }
                                vendor
                                variants(first: ${constants.shopify.recordsQuantityLimit}) {
                                    edges {
                                        node {
                                            price
                                            inventoryQuantity
                                            selectedOptions {
                                                name
                                                value
                                            }
                                        }
                                    }
                                }
                                createdAt
                                updatedAt
                            }
                            shop {
                                id
                            }
                            userErrors {
                                field
                                message
                            }
                        }
                    }`;

                    /* second step create article */
                    fetch(shopifyConfig.adminGraphQLAPI, {
                        method: "POST",
                        headers: {
                            "Authorization": `Basic ${base64Credentials}`,
                            "Content-Type": "application/json",
                            "Accept": "application/json"
                        },
                        body: JSON.stringify({ query, variables: { input } })
                    }).then(output => {
                        return output.json();
                    }).then(result => {
                        if (result.errors && result.errors.length > 0) {
                            const err = result.errors[0];
                            res.status(500).send({ "error": err.message })
                            for(let k = 0; k < input.images.length; k++) {
                                utilities.deleteImageFromUrl(input.images[k].src);
                            }
                        } else if (result.data.productCreate && result.data.productCreate.userErrors && result.data.productCreate.userErrors.length) {
                            const err = result.data.productCreate.userErrors[0];
                            res.status(500).send({ "error": err.message })
                            for(let k = 0; k < input.images.length; k++) {
                                utilities.deleteImageFromUrl(input.images[k].src);
                            }
                        } else {
                            const query = `mutation publishablePublishToCurrentChannel($id: ID!) {
                                publishablePublishToCurrentChannel(id: $id) {
                                    shop {
                                        id
                                    }
                                    userErrors {
                                        field
                                        message
                                    }
                                }
                            }`;

                            const id = result.data.productCreate.product.id;

                            /* third step publish it to distribution channel */
                            fetch(shopifyConfig.adminGraphQLAPI, {
                                method: "POST",
                                headers: {
                                    "Authorization": `Basic ${base64Credentials}`,
                                    "Content-Type": "application/json",
                                    "Accept": "application/json"
                                },
                                body: JSON.stringify({ query, variables: { id } })
                            }).then(output => {
                                return output.json();
                            }).then(publishableResult => {
                                if (publishableResult.errors && publishableResult.errors.length > 0) {
                                    const err = publishableResult.errors[0];
                                    res.status(500).send({ "error": err.message })
                                    for(let k = 0; k < input.images.length; k++) {
                                        utilities.deleteImageFromUrl(input.images[k].src);
                                    }
                                } else if (publishableResult.data.publishablePublishToCurrentChannel && publishableResult.data.publishablePublishToCurrentChannel.userErrors && publishableResult.data.publishablePublishToCurrentChannel.userErrors.length) {
                                    const err = publishableResult.data.publishablePublishToCurrentChannel.userErrors[0];
                                    res.status(500).send({ "error": err.message })
                                    for(let k = 0; k < input.images.length; k++) {
                                        utilities.deleteImageFromUrl(input.images[k].src);
                                    }
                                } else {
                                    /* post process Shopify article */
                                    let flamesArticle = utilities.convertShopifyAdminArticleToFlamesArticle(result.data.productCreate.product);
                                    flamesArticle.externalUrl = req.body.externalUrl;
                                    articleAPI.upsertArticle(db, flamesArticle); //save link between article and color, wearability and brand
                                    res.send(flamesArticle);
                                    for(let k = 0; k < input.images.length; k++) {
                                        utilities.deleteImageFromUrl(input.images[k].src);
                                    }
                                }
                            }).catch(error => {
                                res.status(500).send({ "error": error.message, "errorCode": error.code })
                                for(let k = 0; k < input.images.length; k++) {
                                    utilities.deleteImageFromUrl(input.images[k].src);
                                }
                            });
                        }
                    }).catch(error => {
                        res.status(500).send({ "error": error.message, "errorCode": error.code })
                        for(let k = 0; k < input.images.length; k++) {
                            utilities.deleteImageFromUrl(input.images[k].src);
                        }
                    });
                }
            }).catch(error => {
                res.status(500).send({ "error": error.message, "errorCode": error.code })
                for(let k = 0; k < input.images.length; k++) {
                    utilities.deleteImageFromUrl(input.images[k].src);
                }
            });
        }
    });

    /* READ */
    app.get('/article/:uniqueName', (req, res) => {
        let articleUniqueName = req.params.uniqueName;
        const accessToken = shopifyConfig["X-Shopify-Storefront-Access-Token"];

        const query = `{
          productByHandle(handle: "${articleUniqueName}") {
            description
            createdAt
            handle
            title
            description
            images(first: ${constants.shopify.recordsQuantityLimit}) {
              edges {
                node {
                  originalSrc
                }
              }
            }
            vendor
            variants(first: ${constants.shopify.recordsQuantityLimit}) {
              edges {
                node {
                  quantityAvailable
                  priceV2 {
                    amount
                    currencyCode
                  }
                  selectedOptions {
                    name
                    value
                  }
                }
              }
            }
            createdAt
            updatedAt
          }
        }`;

        fetch(shopifyConfig.storeFrontGraphQLAPI, {
            method: "POST",
            headers: {
                "X-Shopify-Storefront-Access-Token": accessToken,
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({ query })
        }).then(r => {
            return r.json();
        }).then(article => {
            /* post process Shopify article */
            let flamesArticle = utilities.convertShopifyArticleToFlamesArticle(article.data.productByHandle);
            res.send(flamesArticle);
        }).catch(error => {
            res.status(500).send({ "error": error.message, "errorCode": error.code })
        });
    });

    /* UPDATE */
    app.put('/article/:uniqueName', middleware.checkAuthentication, (req, res) => {
        let flamesArticle = req.body;

        /* article validation */
        let validationResult = utilities.validateFlamesArticleUpdate(flamesArticle);

        if (validationResult.failed) {
            res.status(500).send({ "error": validationResult.message })
        } else {
            let articleUniqueName = req.params.uniqueName;

            const base64Credentials = Buffer.from(shopifyConfig.username + ":" + shopifyConfig.password).toString("base64");

            let articleNewUniqueName = flamesArticle.uniqueName;

            function processUpdate(articleUniqueName) {
                const query = `{
                    productByHandle(handle: "${articleUniqueName}") {
                        id
                        images(first: ${constants.shopify.recordsQuantityLimit}) {
                                edges {
                                    node {
                                    originalSrc
                                    }
                                }
                            }
                        variants(first: ${constants.shopify.recordsQuantityLimit}) {
                            edges {
                            node {
                                id
                                inventoryItem {
                                inventoryLevel (locationId:"gid://shopify/Location/${shopifyConfig.locationID}") {
                                    id
                                }
                                }
                                inventoryQuantity
                                selectedOptions {
                                name
                                value
                                }
                            }
                            }
                        }
                    }
                }`;

                /* second step gather article shopify ID */
                fetch(shopifyConfig.adminGraphQLAPI, {
                    method: "POST",
                    headers: {
                        "Authorization": `Basic ${base64Credentials}`,
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    body: JSON.stringify({ query })
                }).then(output => {
                    return output.json();
                }).then(async article => {
                    if (article && article.data && article.data.productByHandle && article.data.productByHandle.id) {
                        const articleShopifyID = article.data.productByHandle.id;

                        /* pre process Shopify article */
                        const input = await utilities.convertFlamesArticleToShopifyArticle(flamesArticle, shopifyConfig);
                        const variants = input.variants;
                        delete input.variants; //handle variants update separately

                        delete input.options; //options are hardcoded, they never get updated, remove the field to prevent "faking" a real update

                        let operationsQueue = [];
                        if (Object.keys(input).length !== 0) { //if there are product-related fields to be updated
                            input.id = articleShopifyID;

                            /*handle images:
                                * if only previewImage was provided, then get the other images and push them in the images array
                                * if only images array was provided, then get the first image (which is the previewImage) and push it at position 0 of images array */
                            if (flamesArticle.previewImage !== undefined && flamesArticle.previewImage !== null && flamesArticle.previewImage !== "" &&
                                (flamesArticle.images === undefined || flamesArticle.images !== null || flamesArticle.images.length === 0)) {
                                let sourceArticle = article.data.productByHandle;
                                if (sourceArticle.images && sourceArticle.images.edges.length) {
                                    for (let i = 1; i < sourceArticle.images.edges.length; i++) {
                                        input.images.push({ src: sourceArticle.images.edges[i].node.originalSrc });
                                    }
                                }
                            } else if ((flamesArticle.previewImage !== undefined || flamesArticle.previewImage !== null || flamesArticle.previewImage === "") &&
                                flamesArticle.images !== undefined && flamesArticle.images !== null && flamesArticle.images.length !== 0) {
                                let sourceArticle = article.data.productByHandle;
                                if (sourceArticle.images && sourceArticle.images.edges.length) {
                                    input.images = [{ src: sourceArticle.images.edges[0].node.originalSrc }, ...input.images];
                                }
                            }


                            const query = `mutation productUpdate($input: ProductInput!) {
                                productUpdate(input: $input) {
                                    product {
                                        id
                                    }
                                    userErrors {
                                        field
                                        message
                                    }
                                }
                            }`;

                            /* third (option) step update article-related data */
                            let operation = fetch(shopifyConfig.adminGraphQLAPI, {
                                method: "POST",
                                headers: {
                                    "Authorization": `Basic ${base64Credentials}`,
                                    "Content-Type": "application/json",
                                    "Accept": "application/json"
                                },
                                body: JSON.stringify({ query, variables: { input } })
                            });

                            operationsQueue.push(operation);
                        }


                        let unprocessedVariants = []; //use this variable to track the unprocessed variants: in case of color, wearability or price change, no matter what's the specified input variant, apply the change to all variants since these are header (prouct) fields for Flames
                        if (article.data.productByHandle.variants && article.data.productByHandle.variants.edges.length) {
                            for (let i = 0; i < article.data.productByHandle.variants.edges.length; i++) {
                                let tmpVariant = article.data.productByHandle.variants.edges[i].node;
                                unprocessedVariants.push(tmpVariant);
                            }
                        }

                        if (variants && variants.length) { //if there are variants to be updated
                            for (let i = 0; i < variants.length; i++) {
                                let variant = variants[i];
                                let variantColor = variant.options[0]; //options: color - wearability - size
                                let variantWearability = variant.options[1]; //options: color - wearability - size
                                let variantSize = variant.options[2]; //options: color - wearability - size

                                let inventoryQuantity = variant.inventoryQuantities;
                                delete variant.inventoryQuantities; //remove the quantity node from the variant and handle it later on

                                let variantShopifyID, variantSourceColor, variantSourceWearability, variantSourceQuantity, variantInventoryLevelID;

                                for (let i = 0; i < unprocessedVariants.length; i++) {
                                    let tmpVariant = unprocessedVariants[i];

                                    for (let l = 0, sizeFound = false; l < tmpVariant.selectedOptions.length && !sizeFound; l++) {
                                        if (tmpVariant.selectedOptions[l].name === constants.shopify.articleOptions[2] /* -> size */ && tmpVariant.selectedOptions[l].value === variantSize) {
                                            sizeFound = true;
                                            unprocessedVariants.splice(unprocessedVariants.indexOf(tmpVariant), 1); //remove the variant since it's going to be processed
                                            variantShopifyID = tmpVariant.id;
                                            variantSourceQuantity = tmpVariant.inventoryQuantity;
                                            variantInventoryLevelID = tmpVariant.inventoryItem.inventoryLevel.id;
                                        }

                                        if (sizeFound) { //if size matches, then you found the correct variant, now loop again over the selectedOptions to get the source color and wearability for later use
                                            for (let k = 0; k < tmpVariant.selectedOptions.length; k++) {
                                                if (tmpVariant.selectedOptions[k].name === constants.shopify.articleOptions[0] /* -> color */) {
                                                    variantSourceColor = tmpVariant.selectedOptions[k].value;
                                                } else if (tmpVariant.selectedOptions[k].name === constants.shopify.articleOptions[1] /* -> wearability */) {
                                                    variantSourceWearability = tmpVariant.selectedOptions[k].value;
                                                }
                                            }
                                        }
                                    }
                                }


                                /* now handle the options update:
                                    * if both color and wearability are blank, then no update must be carried on for the options (size is not taken into account since the assumption is that sizes cannot be updated)
                                    * if only one between color and wearability is valorized, valorize the other blank option with it's original value so that options array is completely fulled and can be passed to the mutation
                                        (otherwise you will pass an option array with some blanks and that is going to wipe out the option value from Shopify - e.g. options = ["blue", "", "XL"] will wipe out the wearability) */
                                if (variantColor !== null && variantColor !== undefined && variantColor === ""
                                    && variantWearability !== null && variantWearability !== undefined && variantWearability === "") {
                                    delete variant.options;
                                } else {
                                    if (variantColor === "" && variantWearability !== "") {
                                        variant.options[0] = variantSourceColor;
                                    } else if (variantWearability === "" && variantColor !== "") {
                                        variant.options[1] = variantSourceWearability;
                                    }
                                }

                                if (variantShopifyID) {
                                    delete variant.inventoryManagement;
                                    delete variant.inventoryPolicy;

                                    if (Object.keys(variant).length !== 0) { //if there are variant-related fields to be updated
                                        variant.id = variantShopifyID;

                                        const query = `mutation productVariantUpdate($input: ProductVariantInput!) {
                                            productVariantUpdate(input: $input) {
                                                product {
                                                    id
                                                }
                                                userErrors {
                                                    field
                                                    message
                                                }
                                            }
                                        }`;

                                        /* fourth (optional) step update each variant */
                                        let operation = fetch(shopifyConfig.adminGraphQLAPI, {
                                            method: "POST",
                                            headers: {
                                                "Authorization": `Basic ${base64Credentials}`,
                                                "Content-Type": "application/json",
                                                "Accept": "application/json"
                                            },
                                            body: JSON.stringify({ query, variables: { input: variant } })
                                        });

                                        operationsQueue.push(operation);
                                    }


                                    if (inventoryQuantity.availableQuantity) { //if inventory stock must be update

                                        let variantInventoryStock = {
                                            inventoryLevelId: variantInventoryLevelID,
                                            availableDelta: (inventoryQuantity.availableQuantity - variantSourceQuantity) //delta is how much must be added to the original quantity
                                        };

                                        const query = `mutation inventoryAdjustQuantity($input: InventoryAdjustQuantityInput!) {
                                            inventoryAdjustQuantity(input: $input) {
                                                inventoryLevel {
                                                    id
                                                }
                                                userErrors {
                                                    field
                                                    message
                                                }
                                            }
                                        }`;

                                        /* fifth (optional) step update each variant's inventory stock */
                                        let operation = fetch(shopifyConfig.adminGraphQLAPI, {
                                            method: "POST",
                                            headers: {
                                                "Authorization": `Basic ${base64Credentials}`,
                                                "Content-Type": "application/json",
                                                "Accept": "application/json"
                                            },
                                            body: JSON.stringify({ query, variables: { input: variantInventoryStock } })
                                        });

                                        operationsQueue.push(operation);
                                    }

                                }
                            }
                        }

                        if (flamesArticle.color || flamesArticle.wearability || flamesArticle.price) { //if at least one of these attributes is to be updated, propagate it also to all the other unprocessed variants of the product
                            for (let i = 0; i < unprocessedVariants.length; i++) {
                                let variantSize, variantColor, variantWearability;
                                for (let l = 0; l < unprocessedVariants[i].selectedOptions.length; l++) {
                                    if (unprocessedVariants[i].selectedOptions[l].name === constants.shopify.articleOptions[2] /* -> size */) {
                                        variantSize = unprocessedVariants[i].selectedOptions[l].value;
                                        variantShopifyID = unprocessedVariants[i].id;
                                    } else if (unprocessedVariants[i].selectedOptions[l].name === constants.shopify.articleOptions[0] /* -> color */) {
                                        variantColor = unprocessedVariants[i].selectedOptions[l].value;
                                    } else if (unprocessedVariants[i].selectedOptions[l].name === constants.shopify.articleOptions[1] /* -> wearability */) {
                                        variantWearability = unprocessedVariants[i].selectedOptions[l].value;
                                    }
                                }

                                let unprocessedVariant = { //flames sizes correspond to shopify variants "de facto"
                                    price: flamesArticle.price ? flamesArticle.price + "" : null
                                }

                                if (flamesArticle.color || flamesArticle.wearability) { //valorize the option field only if there is a real need for updating some fields
                                    unprocessedVariant.options = [flamesArticle.color || variantColor, flamesArticle.wearability || variantWearability, variantSize];
                                }

                                utilities.cleanObject(unprocessedVariant);

                                if (Object.keys(unprocessedVariant).length !== 0) { //if there are variant-related fields to be updated

                                    unprocessedVariant.id = variantShopifyID;

                                    const query = `mutation productVariantUpdate($input: ProductVariantInput!) {
                                        productVariantUpdate(input: $input) {
                                            product {
                                                id
                                            }
                                            userErrors {
                                                field
                                                message
                                            }
                                        }
                                    }`;

                                    /* sixth (optional) step update each variant */
                                    let operation = fetch(shopifyConfig.adminGraphQLAPI, {
                                        method: "POST",
                                        headers: {
                                            "Authorization": `Basic ${base64Credentials}`,
                                            "Content-Type": "application/json",
                                            "Accept": "application/json"
                                        },
                                        body: JSON.stringify({ query, variables: { input: unprocessedVariant } })
                                    });

                                    operationsQueue.push(operation);
                                }
                            }
                        }

                        function dequeueOperations(operationsQueue) {
                            let operation = operationsQueue.pop();
                            operation.then(output => {
                                output.json().then(result => {
                                    if (result.errors && result.errors.length > 0) { //in case of errors output them immediately
                                        const err = result.errors[0];
                                        res.status(500).send({ "error": err.message })
                                        for(let k = 0; k < input.images.length; k++) {
                                            utilities.deleteImageFromUrl(input.images[k].src);
                                        }
                                    } else if (result.data.productUpdate && result.data.productUpdate.userErrors && result.data.productUpdate.userErrors.length) {
                                        const err = result.data.productUpdate.userErrors[0];
                                        res.status(500).send({ "error": err.message })
                                        for(let k = 0; k < input.images.length; k++) {
                                            utilities.deleteImageFromUrl(input.images[k].src);
                                        }
                                    } else if (result.data.productVariantUpdate && result.data.productVariantUpdate.userErrors && result.data.productVariantUpdate.userErrors.length) {
                                        const err = result.data.productVariantUpdate.userErrors[0];
                                        res.status(500).send({ "error": err.message })
                                        for(let k = 0; k < input.images.length; k++) {
                                            utilities.deleteImageFromUrl(input.images[k].src);
                                        }
                                    } else {
                                        if (operationsQueue.length) { //keep poping and executing the operations until the last one
                                            dequeueOperations(operationsQueue);
                                        } else {

                                            //force a product read request in order to be sure to return the updated product
                                            if (flamesArticle.uniqueName) {
                                                articleUniqueName = flamesArticle.uniqueName; //if there was an input uniqueName, it means it was updated
                                            }
                                            const query = `{
                                                productByHandle(handle: "${articleUniqueName}") {
                                                    id
                                                    description
                                                    createdAt
                                                    handle
                                                    title
                                                    description
                                                    images(first: ${constants.shopify.recordsQuantityLimit}) {
                                                        edges {
                                                            node {
                                                            originalSrc
                                                            }
                                                        }
                                                    }
                                                    vendor
                                                    variants(first: ${constants.shopify.recordsQuantityLimit}) {
                                                        edges {
                                                            node {
                                                                price
                                                                inventoryQuantity
                                                                selectedOptions {
                                                                    name
                                                                    value
                                                                }
                                                            }
                                                        }
                                                    }
                                                    createdAt
                                                    updatedAt
                                                }
                                            }`;

                                            /* seventh step gather updated article */
                                            fetch(shopifyConfig.adminGraphQLAPI, {
                                                method: "POST",
                                                headers: {
                                                    "Authorization": `Basic ${base64Credentials}`,
                                                    "Content-Type": "application/json",
                                                    "Accept": "application/json"
                                                },
                                                body: JSON.stringify({ query })
                                            }).then(output => {
                                                return output.json();
                                            }).then(result => {
                                                let flamesArticle;
                                                if (result.data.productByHandle) {
                                                    flamesArticle = utilities.convertShopifyAdminArticleToFlamesArticle(result.data.productByHandle);
                                                }
                                                flamesArticle.externalUrl = req.body.externalUrl;
                                                articleAPI.upsertArticle(db, flamesArticle); //save link between article and color, wearability and brand
                                                res.send(flamesArticle);
                                                for(let k = 0; k < input.images.length; k++) {
                                                    utilities.deleteImageFromUrl(input.images[k].src);
                                                }
                                                const articleTextQuery = { "articlesUniqueNames": flamesArticle.uniqueName };
                                                db.collection("outfitsTexts").find(articleTextQuery).toArray().then( async outfits => {
                                                    for (let i = 0; i < outfits.length; i++) {
                                                        let articleIndexFound = false;
                                                        for (let l = 0; l < outfits[i].articlesUniqueNames.length && !articleIndexFound; l++) {
                                                            if(outfits[i].articlesUniqueNames[l] === flamesArticle.uniqueName) {
                                                                articleIndexFound = true;
                                                                //articlesNames, articlesColors, articlesBrands, articlesWearabilities, articlesDetails are parallel arrays
                                                                outfits[i].articlesNames[l] = flamesArticle.name;
                                                                outfits[i].articlesColors[l] = flamesArticle.color;
                                                                outfits[i].articlesBrands[l] = flamesArticle.brand;
                                                                outfits[i].articlesWearabilities[l] = flamesArticle.wearability;
                                                                outfits[i].articlesDetails[l] = flamesArticle.details;
                                                                let updateTextDocument = { $set: outfits[i] };
                                                                db.collection("outfitsTexts").updateMany({outfitUniqueName: outfits[i].outfitUniqueName}, updateTextDocument, {}, (err, output) => {
                                                                });
                                                            }
                                                        }
                                                    }
                                                }).catch(error => {
                                                    /* log error */
                                                });
                                            }).catch(error => {
                                                res.status(500).send({ "error": error.message, "errorCode": error.code });
                                                for(let k = 0; k < input.images.length; k++) {
                                                    utilities.deleteImageFromUrl(input.images[k].src);
                                                }
                                            });
                                        }
                                    }
                                }).catch(error => {
                                    res.status(500).send({ "error": error.message, "errorCode": error.code });
                                    for(let k = 0; k < input.images.length; k++) {
                                        utilities.deleteImageFromUrl(input.images[k].src);
                                    }
                                });
                            });
                        };
                        if (operationsQueue.length) {
                            dequeueOperations(operationsQueue);
                        } else {
                            res.status(400).send({ "error": "No update operation requested" });
                            for(let k = 0; k < input.images.length; k++) {
                                utilities.deleteImageFromUrl(input.images[k].src);
                            }
                        }

                    } else {
                        if (article.errors) {
                            res.status(500).send({ "error": article.errors[0].message });
                        } else {
                            res.status(404).send({ "error": "No article " + articleUniqueName + " found" });
                        }
                    }
                }).catch(error => {
                    res.status(500).send({ "error": error.message, "errorCode": error.code });
                });
            }

            if (articleNewUniqueName !== articleUniqueName) { //if the uniqueName is to be updated
                const query = `{
                    productByHandle(handle: "${articleNewUniqueName}") {
                        id
                    }
                }`;

                /* first step check if the uniqueName is already reserved for another article */
                fetch(shopifyConfig.adminGraphQLAPI, {
                    method: "POST",
                    headers: {
                        "Authorization": `Basic ${base64Credentials}`,
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    body: JSON.stringify({ query })
                }).then(output => {
                    return output.json();
                }).then(article => {
                    if (article && article.data && article.data.productByHandle && article.data.productByHandle.id) {
                        res.status(500).send({ "error": "uniqueName '" + articleNewUniqueName + "' is already used by another article" });
                    } else {
                        processUpdate(articleUniqueName);
                    }
                }).catch(error => {
                    res.status(500).send({ "error": error.message, "errorCode": error.code })
                });
            } else {
                processUpdate(articleUniqueName);
            }
        }
    });

    /* DELETE */
    app.delete('/article/:uniqueName', middleware.checkAuthentication, (req, res) => {
        let articleUniqueName = req.params.uniqueName;
        const accessToken = shopifyConfig["X-Shopify-Storefront-Access-Token"];

        const query = `{
            productByHandle(handle: "${articleUniqueName}") {
              id
            }
        }`;

        /* first step gather article shopify ID */
        fetch(shopifyConfig.storeFrontGraphQLAPI, {
            method: "POST",
            headers: {
                "X-Shopify-Storefront-Access-Token": accessToken,
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({ query })
        }).then(output => {
            return output.json();
        }).then(article => {
            if (article && article.data && article.data.productByHandle && article.data.productByHandle.id) {
                const articleShopifyID = article.data.productByHandle.id;
                const base64Credentials = Buffer.from(shopifyConfig.username + ":" + shopifyConfig.password).toString("base64");

                const query = `mutation productDelete($input: ProductDeleteInput!) {
                    productDelete(input: $input) {
                      deletedProductId
                      shop {
                        id
                      }
                      userErrors {
                        field
                        message
                      }
                    }
                  }`;

                const input = {
                    "id": articleShopifyID
                };

                /* second step delete it */
                fetch(shopifyConfig.adminGraphQLAPI, {
                    method: "POST",
                    headers: {
                        "Authorization": `Basic ${base64Credentials}`,
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    body: JSON.stringify({ query, variables: { input } })
                }).then(output => {
                    return output.json();
                }).then(result => {
                    if (result.errors && result.errors.length > 0) {
                        const err = result.errors[0];
                        res.status(500).send({ "error": err.message })
                    } else if (result.data.productDelete && result.data.productDelete.userErrors && result.data.productDelete.userErrors.length) {
                        const err = result.data.productDelete.userErrors[0];
                        res.status(500).send({ "error": err.message })
                    } else {
                        articleAPI.deleteArticle(db, articleUniqueName); //remove link between article and color, wearability and brand
                        res.send("Article " + articleUniqueName + " deleted!");
                    }
                }).catch(error => {
                    res.status(500).send({ "error": error.message, "errorCode": error.code })
                });
            } else {
                res.status(404).send({ "error": "No article " + articleUniqueName + " found" });
            }
        }).catch(error => {
            res.status(500).send({ "error": error.message, "errorCode": error.code })
        });
    });

    /* QUERY */
    app.get('/articles', (req, res) => {

        const accessToken = shopifyConfig["X-Shopify-Storefront-Access-Token"];
        const query = `{
            products(first: ${constants.shopify.recordsQuantityLimit}) {
              edges {
                node {
                  description
                  createdAt
                  handle
                  title
                  description
                  images(first: ${constants.shopify.recordsQuantityLimit}) {
                    edges {
                      node {
                        originalSrc
                      }
                    }
                  }
                  vendor
                  variants(first: ${constants.shopify.recordsQuantityLimit}) {
                    edges {
                      node {
                        quantityAvailable
                        priceV2 {
                          amount
                          currencyCode
                        }
                        selectedOptions {
                          name
                          value
                        }
                      }
                    }
                  }
                  createdAt
                  updatedAt
                }
              }
            }
          }`;

        fetch(shopifyConfig.storeFrontGraphQLAPI, {
            method: "POST",
            headers: {
                "X-Shopify-Storefront-Access-Token": accessToken,
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({ query })
        }).then(output => {
            return output.json();
        }).then(articles => {
            /* post process Shopify articles */
            if (articles.data && articles.data.products) {
                let flamesArticles = [];
                for (let i = 0; i < articles.data.products.edges.length; i++) {
                    let flamesArticle = utilities.convertShopifyArticleToFlamesArticle(articles.data.products.edges[i].node);
                    flamesArticles.push(flamesArticle);
                }
                res.send(flamesArticles);
            } else if (articles.errors && articles.errors.length > 0) {
                const err = articles.errors[0];
                res.status(500).send({ "error": err.message });
            }
        }).catch(error => {
            res.status(500).send({ "error": error.message, "errorCode": error.code })
        });
    });

    /* BRANDS */
    app.get('/articles/brands', (req, res) => {
        db.collection("articles").distinct("brand", (err, brands) => {
            if (err) {
                res.status(500).send({ "error": err.message, "errorCode": err.code });
            } else {
                res.send(brands);
            }
        });
    });

    /* COLORS */
    app.get('/articles/colors', (req, res) => {
        db.collection("articles").distinct("color", (err, colors) => {
            if (err) {
                res.status(500).send({ "error": err.message, "errorCode": err.code });
            } else {
                res.send(colors);
            }
        });
    });

    /* WEARABILITIES */
    app.get('/articles/wearabilities', (req, res) => {
        db.collection("articles").distinct("wearability", (err, wearabilities) => {
            if (err) {
                res.status(500).send({ "error": err.message, "errorCode": err.code });
            } else {
                res.send(wearabilities);
            }
        });
    });
    
};
