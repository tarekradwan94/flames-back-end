const constants = require("../utils/constants");
const utilities = require("../utils/utilities");
const collectionName = "outfits";
const articleAPI = require("./articleAPI");

module.exports = {
    getOutfitByID: async function (db, outfitUniqueName, user) {
        let outfitQuery = {uniqueName: outfitUniqueName};
        return await db.collection(collectionName).aggregate([ //unpack articles, occasion, style and stylist relation
            {
                $lookup:
                {
                    from: "occasions",
                    localField: "occasionID",
                    foreignField: "uniqueName",
                    as: "occasion"
                }
            },
            {
                $lookup:
                {
                    from: "styles",
                    localField: "styleID",
                    foreignField: "uniqueName",
                    as: "style"
                }
            },
            {
                $lookup:
                {
                    from: "stylists",
                    localField: "stylistID",
                    foreignField: "uniqueName",
                    as: "stylist"
                }
            },
            {
                $lookup:
                {
                    from: "articles",
                    localField: "articleIDs",
                    foreignField: "uniqueName",
                    as: "articles"
                }
            },
            {
                $lookup:
                {
                    from: "interactions",
                    as: "isUpvoted",
                    pipeline: [
                        {
                          $match: {
                            $and : [
                                {userID: user ? user._id : ""},
                                {action: constants.interactions.outfitUpvoteAction},
                                {outfitID: outfitUniqueName}
                            ]
                          }
                        }
                    ]
                }
            },
            { $match: outfitQuery }
        ]).toArray().then(async outfits => {
            if(outfits.length === 0) {
                return {error: {message: "No outfit " + outfitUniqueName + " found"}, outfit: null};
            } else {
                outfits[0].isUpvoted = outfits[0].isUpvoted.length > 0;
                return {error: null, outfit: outfits[0]};
            }
        }).catch(error => {
            return {error, outfit: null};
        });
    },

    getOutfitByIDs: async function (db, outfitUniqueNames, user) {
        let outfitQuery = outfitUniqueNames.map( outfitUniqueName => { return {uniqueName: outfitUniqueName} });
        return await db.collection(collectionName).aggregate([ //unpack articles, occasion, style and stylist relation
            /*{
                $lookup:
                {
                    from: "occasions",
                    localField: "occasionID",
                    foreignField: "uniqueName",
                    as: "occasion"
                }
            },
            {
                $lookup:
                {
                    from: "styles",
                    localField: "styleID",
                    foreignField: "uniqueName",
                    as: "style"
                }
            },
            {
                $lookup:
                {
                    from: "stylists",
                    localField: "stylistID",
                    foreignField: "uniqueName",
                    as: "stylist"
                }
            },
            {
                $lookup:
                {
                    from: "articles",
                    localField: "articleIDs",
                    foreignField: "uniqueName",
                    as: "articles"
                }
            },
            {
                $lookup:
                {
                    from: "interactions",
                    as: "isUpvoted",
                    pipeline: [
                        {
                          $match: {
                            $and : [
                                {userID: user ? user._id : ""},
                                {action: constants.interactions.outfitUpvoteAction},
                                {outfitID: outfitUniqueName}
                            ]
                          }
                        }
                    ]
                }
            },*/
            { $match: { $or : outfitQuery } }
        ]).toArray().then(async outfits => {
            if(outfits.length === 0) {
                return {error: {message: "No outfit found"}, outfits: null};
            } else {
                /*outfits.forEach(function(outfit) {
                    outfit.isUpvoted = outfit.isUpvoted.length > 0;
                });*/
                return {error: null, outfits};
            }
        }).catch(error => {
            return {error, outfit: null};
        });
    },

    getAllOutfits: async function (db, orderByField, maxOutfits, user) {

        let userID = user ? user._id : "";

        let aggregationPipeline = [
            {
                $lookup: //unpack occasion
                {
                    from: "occasions",
                    localField: "occasionID",
                    foreignField: "uniqueName",
                    as: "occasion"
                }
            },
            {
                $lookup: //unpack style
                {
                    from: "styles",
                    localField: "styleID",
                    foreignField: "uniqueName",
                    as: "style"
                }
            },
            {
                $lookup: //unpack stylist
                {
                    from: "stylists",
                    localField: "stylistID",
                    foreignField: "uniqueName",
                    as: "stylist"
                }
            },
            {
                $lookup: //unpack articles
                {
                    from: "articles",
                    localField: "articleIDs",
                    foreignField: "uniqueName",
                    as: "articles"
                }
            },
            {
                $lookup:
                {
                    from: "interactions",
                    as: "isUpvoted",
                    let: { outfitUniqueName: '$uniqueName' },
                    pipeline: [
                        {
                          $match: {
                            $expr: {
                                $and: [
                                  { $eq: ['$outfitID', '$$outfitUniqueName'] },
                                  { $eq: ['$userID', userID ] },
                                  { $eq: ['$action', constants.interactions.outfitUpvoteAction ] }
                                ]
                              }
                          }
                        }
                    ]
                }
            }
        ];

        if(!orderByField) {
            orderByField = constants.inspiration.defaultOrderByField;
        }
        let sortNode = {};
        sortNode[orderByField] = -1; //descending
        aggregationPipeline = aggregationPipeline.concat(
            { $sort: sortNode }
        );

        if(maxOutfits) {
            aggregationPipeline = aggregationPipeline.concat(
                { $limit: maxOutfits }
            );
        }

        return await db.collection(collectionName).aggregate(aggregationPipeline).toArray().then( async outfits => {
            for(let i = 0; i < outfits.length; i++) {
                outfits[i].isUpvoted = outfits[i].isUpvoted.length > 0;
            }
            return {error: null, outfits};
        }).catch(error => {
            return {error, outfits: null};
        });
    },

    getInspiration: async function (db, orderByField, user, profile) {
        let userID = user ? user._id : "";

        let overallAggregation = [
            { $limit: 1 }, // Reduce the result set to a single document.
            { $project: { _id: 1 } }, // Strip all fields except the Id.
            { $project: { _id: 0 } }, // Strip the id. The document is now empty.
        ];

        if(!orderByField) {
            orderByField = constants.inspiration.defaultOrderByField;
        }
        let sortNode = {};
        sortNode[orderByField] = -1; //descending

        //get appropriate outfits based on the user profile (styles)
        let outfitLookups = profile.reduce((output, style) => {
            output = !output ? [] : output;
            let styleQuery = { styleID: style.styleID };
            let maxOutfitPerStyle = Math.round(constants.inspiration.maxOutfits * style.percentage);
            if(maxOutfitPerStyle > 0) {
                let styleAggregation = [
                    { $match: styleQuery },
                    { $limit: maxOutfitPerStyle },
                    {
                        $lookup: //unpack occasion
                        {
                            from: "occasions",
                            localField: "occasionID",
                            foreignField: "uniqueName",
                            as: "occasion"
                        }
                    },
                    {
                        $lookup: //unpack style
                        {
                            from: "styles",
                            localField: "styleID",
                            foreignField: "uniqueName",
                            as: "style"
                        }
                    },
                    {
                        $lookup: //unpack stylist
                        {
                            from: "stylists",
                            localField: "stylistID",
                            foreignField: "uniqueName",
                            as: "stylist"
                        }
                    },
                    {
                        $lookup: //unpack articles
                        {
                            from: "articles",
                            localField: "articleIDs",
                            foreignField: "uniqueName",
                            as: "articles"
                        }
                    },
                    {
                        $lookup:
                        {
                            from: "interactions",
                            as: "isUpvoted",
                            let: { outfitUniqueName: '$uniqueName' },
                            pipeline: [
                                {
                                $match: {
                                    $expr: {
                                        $and: [
                                        { $eq: ['$outfitID', '$$outfitUniqueName'] },
                                        { $eq: ['$userID', userID ] },
                                        { $eq: ['$action', constants.interactions.outfitUpvoteAction ] }
                                        ]
                                    }
                                }
                                }
                            ]
                        }
                    }
                ];

                output = output.concat({ $lookup: { from: collectionName, pipeline: styleAggregation, as: style.styleID } });
            }
            return output;
        }, []);

        overallAggregation = overallAggregation.concat(outfitLookups);

        let unionStage = profile.reduce((output, style) => {
            output = !output ? [] : output;
            let maxOutfitPerStyle = Math.round(constants.inspiration.maxOutfits * style.percentage);
            if(maxOutfitPerStyle > 0) { //like above, include only those that output some outfit
                output = output.concat("$"+style.styleID);
            }
            return output;
        }, []);

        overallAggregation = overallAggregation.concat([
            // Merge the collections together.
            {
              $project:
              {
                Union: { $concatArrays: unionStage }
              }
            },
      
            { $unwind: "$Union" }, // Unwind the union collection into a result set.
            { $replaceRoot: { newRoot: "$Union" } }, // Replace the root to cleanup the resulting documents.)
            { $sort: sortNode } //sort only at last stage
        ]);

        // MONGO DB 4.4 opportunity: UNION -> $unionWith
        return await db.collection(collectionName).aggregate(overallAggregation).toArray().then( async outfits => {
                if(outfits.length !== 0) {
                    for(let i = 0; i < outfits.length; i++) {
                        outfits[i].isUpvoted = outfits[i].isUpvoted.length > 0;
                    }
                    return {error: null, outfits};
                } else {
                    return {error: {message: "No outfits found"}, outfits: null};
                }
        }).catch(error => {
            return {error, outfits: null};
        });
    },

    getSearchResults: async function (db, filterByFields, searchByKeywords, orderByField, user) {
        let userID = user ? user._id : "";
        if(filterByFields || searchByKeywords) {
            //filter example "?filterBy=occasionID $eq wedding-guest;weekend; $and styleID $eq xxxx;yyyy"
            //keywords example "?searchBy=Red t-shirt"
            let andStatement = [];
            let filterFields = filterByFields ? filterByFields.split(constants.frontEnd.filterAndOperator): [];
            let colorOptions = [], wearabilityOptions = [], brandOptions = [];
            for(let i = 0; i < filterFields.length; i++) {
                let filterField = filterFields[i].split(constants.frontEnd.filterEqOperator)[0];
                let orStatements = [];
                let filterValues = filterFields[i].split(constants.frontEnd.filterEqOperator)[1].split(";");
                if(filterField === "occasionID" || filterField === "styleID") {
                    for(let l = 0; l < filterValues.length; l++) {
                        if(filterValues[l]) {
                            let orStatement = {};
                            orStatement["outfit." + filterField] = filterValues[l];
                            orStatements = orStatements.concat(orStatement);
                        }
                    }
                } else if (filterField === "totalPrice") {
                    for(let l = 0; l < filterValues.length; l++) {
                        if(filterValues[l]) {
                            let priceTier = constants.frontEnd.search.priceOptions[filterValues[l]];
                            if(priceTier) {
                                let filterStatement = {};
                                if(priceTier.min !== undefined && priceTier.min !== null) {
                                    filterStatement["$gt"] = priceTier.min;
                                }
                                if(priceTier.max !== undefined && priceTier.max !== null) {
                                    filterStatement["$lte"] = priceTier.max;
                                }
                                let orStatement = {};
                                orStatement["outfit." +filterField] = filterStatement;
                                orStatements = orStatements.concat(orStatement);
                            }
                        }
                    }
                } else if (filterField === "color") {
                    colorOptions = filterValues; //will be handled later on
                } else if (filterField === "wearability") {
                    wearabilityOptions = filterValues; //will be handled later on
                } else if (filterField === "brand") {
                    brandOptions = filterValues; //will be handled later on
                }
                if(orStatements.length > 0) {
                    andStatement = andStatement.concat(
                        {$or : orStatements}
                    );
                }
            }

            //handle article level filters
            let matchingArticleIDs = await articleAPI.searchForArticleIDs(db, colorOptions, wearabilityOptions, brandOptions);
            if(matchingArticleIDs.error) {
                return {error: matchingArticleIDs.error, outfits: null};
            } else {
                let articlesOrStatements = [];
                for(let l = 0; l < matchingArticleIDs.articles.length; l++) {
                    if(matchingArticleIDs.articles[l]) {
                        let orStatement = {};
                        orStatement["outfit.articleIDs"] = matchingArticleIDs.articles[l].uniqueName;
                        articlesOrStatements = articlesOrStatements.concat(orStatement);
                    }
                }
                if(articlesOrStatements.length > 0) {
                    andStatement = andStatement.concat(
                        {$or : articlesOrStatements}
                    );
                } else { //no article matches the filters
                    if(colorOptions.length > 0 || wearabilityOptions.length > 0 || brandOptions.length > 0) {
                        //if the user expressed some article filters and no article was found, then no outfit can match
                        andStatement = andStatement.concat(
                            {uniqueName: null} //impossible condition in order to return no outfit
                        );
                    }

                }
            }
        

            let andStatements = {$and : andStatement};

            let relationCollectionName = "outfitsTexts";
            let aggregationPipeline = [
                {
                    $lookup: //unpack outfit
                    {
                        from: "outfits",
                        localField: "outfitUniqueName",
                        foreignField: "uniqueName",
                        as: "outfit"
                    }
                },
                {
                    $lookup: //unpack occasion
                    {
                        from: "occasions",
                        localField: "outfit.occasionID",
                        foreignField: "uniqueName",
                        as: "occasion"
                    }
                },
                {
                    $lookup: //unpack style
                    {
                        from: "styles",
                        localField: "outfit.styleID",
                        foreignField: "uniqueName",
                        as: "style"
                    }
                },
                {
                    $lookup: //unpack stylist
                    {
                        from: "stylists",
                        localField: "outfit.stylistID",
                        foreignField: "uniqueName",
                        as: "stylist"
                    }
                },
                {
                    $lookup: //unpack articles
                    {
                        from: "articles",
                        localField: "outfit.articleIDs",
                        foreignField: "uniqueName",
                        as: "articles"
                    }
                },
                {
                    $lookup:
                    {
                        from: "interactions",
                        as: "isUpvoted",
                        let: { outfitUniqueName: '$outfitUniqueName' },
                        pipeline: [
                            {
                              $match: {
                                $expr: {
                                    $and: [
                                      { $eq: ['$outfitID', '$$outfitUniqueName'] },
                                      { $eq: ['$userID', userID ] },
                                      { $eq: ['$action', constants.interactions.outfitUpvoteAction ] }
                                    ]
                                  }
                              }
                            }
                        ]
                    }
                }
            ];
            if(andStatement.length > 0) {
                aggregationPipeline = aggregationPipeline.concat({ $match: andStatements });
            }

            if(searchByKeywords) {
                aggregationPipeline.unshift({ $match: {$text: { $search: searchByKeywords } } });
            }

            if(!orderByField) {
                orderByField = constants.inspiration.defaultOrderByField;
            }
            let sortNode = {};
            if(orderByField) {
                sortNode["outfit."+orderByField] = -1; //descending
                
            } else {
                sortNode = { relevance: searchByKeywords ? { $meta: "textScore" } : 1 };
            }
            aggregationPipeline = aggregationPipeline.concat(
                { $sort: sortNode }
            );

            return await db.collection(relationCollectionName).aggregate(aggregationPipeline).toArray().then( async outfitsTexts => {
                let processedOutfits = [];
                for (let i = 0; i < outfitsTexts.length; i++) {
                    outfitsTexts[i].outfit[0].occasion = outfitsTexts[i].occasion;
                    outfitsTexts[i].outfit[0].style = outfitsTexts[i].style;
                    outfitsTexts[i].outfit[0].stylist = outfitsTexts[i].stylist;
                    outfitsTexts[i].outfit[0].articles = outfitsTexts[i].articles;
                    outfitsTexts[i].outfit[0].isUpvoted = outfitsTexts[i].isUpvoted.length > 0;
                    processedOutfits = processedOutfits.concat(outfitsTexts[i].outfit);
                }
                return {error: null, outfits: processedOutfits};
            }).catch(error => {
                return {error, outfits: null};
            });
        } else { //if neither filters nor search keywords were expressed, this is basically an inspiration query
            return this.getAllOutfits(db, orderByField, constants.inspiration.maxOutfits, user);
        }
    }
}