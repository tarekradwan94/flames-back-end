module.exports = {
    "adminGraphQLAPI": process.env.SHOPIFY_HOST + "/admin/api/2020-10/graphql.json",
    "storeFrontGraphQLAPI": process.env.SHOPIFY_HOST + "/api/2020-10/graphql.json", 
    "X-Shopify-Storefront-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN,
    "username": process.env.SHOPIFY_USER,
    "password": process.env.SHOPIFY_PASSWORD,
    "locationID": process.env.SHOPIFY_LOCATION
};