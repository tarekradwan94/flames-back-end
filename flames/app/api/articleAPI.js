const shopifyConfig = require('../../config/shopify');
const fetch = require('node-fetch');
const constants = require("../utils/constants");
const utilities = require("../utils/utilities");

module.exports = {
    getArticlesByHandles: function (handles) {
        if (!handles || !(handles instanceof Array) || handles.length < 0) {
            return [];
        }
        else {
            const accessToken = shopifyConfig["X-Shopify-Storefront-Access-Token"];

            let handlesQueryString = "tag:'" + handles.join("' OR tag:'") + "'";

            const query = `{
                products(query: "${handlesQueryString}", first: ${constants.shopify.recordsQuantityLimit}) {
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

            return fetch(shopifyConfig.storeFrontGraphQLAPI, {
                method: "POST",
                headers: {
                    "X-Shopify-Storefront-Access-Token": accessToken,
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({ query })
            }).then(r => {
                return r.json();
            }).then(articles => {
                /* post process Shopify article */
                let flamesArticles = [];
                for (let i = 0; i < articles.data.products.edges.length; i++) {
                    flamesArticles.push(utilities.convertShopifyArticleToFlamesArticle(articles.data.products.edges[i].node));
                }
                return flamesArticles;
            }).catch(error => {
                return [];
            });
        }
    },

    upsertArticle: function (db, article) {
        utilities.preProcessMongoDocumentCreation(article);
        db.collection("articles").updateOne({uniqueName: article.uniqueName}, {$set: article}, { upsert: true }, (err, result) => {

        });
    },

    deleteArticle: function (db, articleUniqueName) {
        const query = { uniqueName: articleUniqueName };
        db.collection("articles").findOneAndDelete(query, (err, result) => {

        });
    },

    searchForArticleIDs: async function (db, colorOptions, wearabilityOptions, brandOptions) {
        let andStatement = [];

        let colorMatch = {};
        let orColorStatements = [];
        for (let i = 0; i < colorOptions.length; i++) {
            if (colorOptions[i]) {
                orColorStatements = orColorStatements.concat({ color: colorOptions[i]});
            }
        }
        if(orColorStatements.length > 0) {
            andStatement = andStatement.concat(
                {$or : orColorStatements}
            );
        }

        let wearabilityMatch = {};
        let orWearabilityStatements = [];
        for (let i = 0; i < wearabilityOptions.length; i++) {
            if (wearabilityOptions[i]) {
                orWearabilityStatements = orWearabilityStatements.concat({ wearability: wearabilityOptions[i]});
            }
        }
        if(orWearabilityStatements.length > 0) {
            andStatement = andStatement.concat(
                {$or : orWearabilityStatements}
            );
        }

        let brandMatch = {};
        let orBrandStatements = [];
        for (let i = 0; i < brandOptions.length; i++) {
            if (brandOptions[i]) {
                orBrandStatements = orBrandStatements.concat({ brand: brandOptions[i]});
            }
        }
        if(orBrandStatements.length > 0) {
            andStatement = andStatement.concat(
                {$or : orBrandStatements}
            );
        }

        if(andStatement.length > 0){ //if there is at least one filter
            let andStatements = {$and : andStatement};
            return await db.collection("articles").aggregate([
                { $match: andStatements }
            ]).toArray().then( async articles => {
                return {error: null, articles};
            }).catch(error => {
                return {error, articles: null};
            });
        } else {
            return {error: null, articles:[]};
        }
    }
};