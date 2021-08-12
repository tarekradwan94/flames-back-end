module.exports = {
    common: {
        adminUser: "flamesfashionbackend@gmail.com",
        maxCallsPerSecondByIP: 10,
        passwordSaltRounds: 10
    },
    frontEnd: {
        cookieSameSite: process.env.COOKIEPOLICY,
        cookieSecure: process.env.COOKIESECURE == "true",
        cookieExpiration: 60 * 60 * 24 * 365 * 1000, //1 year
        cookieDomain: ".radwantarek.com",
        cookiePath: "/",
        allowedOrigins: ["http://radwantarek.com", "https://flamesfrontend.z6.web.core.windows.net", "https://flames.radwantarek.com", "null"],
        cookieName: "_flookie",
        cookieSecret: "FlookieSecretRadwan1Aug2020",
        localeHTTPHeader: "Flames-language",
        orderByParam: "orderBy",
        filterByParam: "filterBy",
        searchByParam: "searchBy",
        filterEqOperator: " $eq ",
        filterAndOperator: " $and ",
        search: {
            priceOptions: {
                priceTier1: {
                    min: 0, max: 100
                },
                priceTier2: {
                    min: 100, max: 300
                },
                priceTier3: {
                    min: 300, max: 500
                },
                priceTier4: {
                    min: 500, max: 1000
                },
                priceTier5: {
                    min: 1000
                }
            }
        }
    },
    shopify: {
        articleOptions: ["color", "wearability", "size"], //it's mandatory to keep these option with this spelling due to conversions from Shopify to Flames
        inventoryManagementValue: "SHOPIFY",
        inventoryPolicyValue: "CONTINUE",
        currency: "EUR",
        recordsQuantityLimit: 180
    },
    inspiration: {
        maxOutfits: 8,
        defaultOrderByField: "updatedAt"
    },
    interactions: {
        outfitUpvoteAction: "outfitUpvote",
        outfitSearchAction: "outfitSearch",
        outfitOpenAction: "outfitOpen",
        occasionOpenAction: "occasionOpen",
        styleOpenAction: "styleOpen",
        articleOpenAction: "articleOpen",
        articleBuyAction: "articleBuy",
        outfitBuyAction: "outfitBuy",
        outfitShowTimeAction: "outfitShowTime",
        outfitZoomShowTimeAction: "outfitZoomShowTime",
        articleZoomShowTimeAction: "articleZoomShowTime",
        inspirationSortAction: "inspirationSort",
        searchSortAction: "searchSort"
    },
    userProfiling: {
        interactionCreationTimestampField: "createdAt",
        nOutfitUpvoteInteractions: 10,
        quotaOutfitUpvoteInteractions: 0.2,
        nOutfitOpenInteractions: 10,
        quotaOutfitOpenInteractions: 0.15,
        nStyleFilterInteractions: 10,
        quotaStyleFilterInteractions: 0.3,
        nOutfitBuyInteractions: 10,
        quotaOutfitBuyInteractions: 0.3,
        nOutfitShowTimeInteractions: 100,
        quotaOutfitShowTimeInteractions: 0.05
    },
    defaultImagesContentType: "image/jpeg"
}