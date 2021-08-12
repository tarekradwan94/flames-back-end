const constants = require("../utils/constants");
const utilities = require("../utils/utilities");
const collectionName = "interactions";
const outfitAPI = require("./outfitAPI");

module.exports = {
    getUserProfile: async function (req, db) {
        //measure what is the user's profile like in terms of styles taste
        //count last n outfit upvotes, last n outfit openings, last n style filters, last n outfit buy clicks, last m outfit showtimes
        //the output will be an array of styles with a percentage of their match

        let orderByField = constants.userProfiling.interactionCreationTimestampField;
        let sortNode = {};
        sortNode[orderByField] = -1; //descending

        //OUTFIT UPVOTE INTERACTIONS
        let outfitUpvoteinteraction = {
            userID: req.flamesUser._id,
            action: constants.interactions.outfitUpvoteAction
        };

        let maxOutfitUpvoteInteractions = constants.userProfiling.nOutfitUpvoteInteractions;

        let outfitUpvoteAggregationPipeline = [
            { $match: outfitUpvoteinteraction },
            { $sort: sortNode },
            { $limit: maxOutfitUpvoteInteractions }
        ];

        //OUTFIT OPEN INTERACTIONS
        let outfitOpenInteraction = {
            userID: req.flamesUser._id,
            action: constants.interactions.outfitOpenAction
        };

        let maxOutfitOpenInteractions = constants.userProfiling.nOutfitOpenInteractions;

        let outfitOpenAggregationPipeline = [
            { $match: outfitOpenInteraction },
            { $sort: sortNode },
            { $limit: maxOutfitOpenInteractions }
        ];

        //OUTFIT BUY INTERACTIONS
        let outfitBuyInteraction = {
            userID: req.flamesUser._id,
            action: constants.interactions.outfitBuyAction
        };

        let maxOutfitBuyInteractions = constants.userProfiling.nOutfitBuyInteractions;

        let outfitBuyAggregationPipeline = [
            { $match: outfitBuyInteraction },
            { $sort: sortNode },
            { $limit: maxOutfitBuyInteractions }
        ];

        //OUTFIT SHOWTIME INTERACTIONS
        let outfitShowTimeInteraction = {
            userID: req.flamesUser._id,
            action: constants.interactions.outfitShowTimeAction
        };

        let maxOutfitShowTimeInteractions = constants.userProfiling.nOutfitShowTimeInteractions;

        let outfitShowTimeAggregationPipeline = [
            { $match: outfitShowTimeInteraction },
            { $sort: sortNode },
            { $limit: maxOutfitShowTimeInteractions }
        ];

        //STYLE FILTER INTERACTIONS
        let styleFilterInteraction = {
            userID: req.flamesUser._id,
            action: constants.interactions.outfitSearchAction,
            "urlQuery.filterBy": /.*styleID.*/ //only those searches that include the a style specification
        };

        let maxStyleFilterInteractions = constants.userProfiling.nStyleFilterInteractions;

        let styleFilterAggregationPipeline = [
            { $match: styleFilterInteraction },
            { $sort: sortNode },
            { $limit: maxStyleFilterInteractions }
        ];

        // MONGO DB 4.4 opportunity: UNION -> $unionWith
        return await db.collection(collectionName).aggregate(
            //mimic a UNION operation
            [
              { $limit: 1 }, // Reduce the result set to a single document.
              { $project: { _id: 1 } }, // Strip all fields except the Id.
              { $project: { _id: 0 } }, // Strip the id. The document is now empty.
        
              // Lookup all collections to union together.
              { $lookup: { from: collectionName, pipeline: outfitUpvoteAggregationPipeline, as: 'OutfitUpvoteInteractions' } },
              { $lookup: { from: collectionName, pipeline: outfitOpenAggregationPipeline, as: 'OutfitOpenInteractions' } },
              { $lookup: { from: collectionName, pipeline: outfitBuyAggregationPipeline, as: 'OutfitBuyInteractions' } },
              { $lookup: { from: collectionName, pipeline: outfitShowTimeAggregationPipeline, as: 'OutfitShowTimeInteractions' } },
              { $lookup: { from: collectionName, pipeline: styleFilterAggregationPipeline, as: 'StyleFilterInteractions' } },

            ]).toArray().then( async interactions => {
                if(interactions.length !== 0) {
                    let outfitUpvoteInteractions = interactions[0].OutfitUpvoteInteractions;
                    let outfitOpenInteractions = interactions[0].OutfitOpenInteractions;
                    let outfitBuyInteractions = interactions[0].OutfitBuyInteractions;
                    let outfitShowTimeInteractions = interactions[0].OutfitShowTimeInteractions;
                    let styleFilterInteractions = interactions[0].StyleFilterInteractions;

                    let outfitIDs = [];
                    //collect all outfit IDs
                    outfitIDs = outfitIDs.concat(outfitUpvoteInteractions.map( interaction  => interaction.outfitID));
                    outfitIDs = outfitIDs.concat(outfitOpenInteractions.map( interaction  => interaction.outfitID));
                    outfitIDs = outfitIDs.concat(outfitBuyInteractions.map( interaction  => interaction.outfitID));
                    outfitIDs = outfitIDs.concat(outfitShowTimeInteractions.map( interaction  => interaction.outfitID));
                    //remove duplicated outfitIDs
                    outfitIDs = [...new Set(outfitIDs)];

                    let results = await outfitAPI.getOutfitByIDs(db, outfitIDs, req.flamesUser);
                    let error = null;
                    /*let error = results.error;
                    if (error) {
                        return {error, profile: null};
                    } else {*/
                        let outfits = results.outfits || [];
                        let outfitIDToStyleMap = {};
                        for(let i = 0; i < outfits.length; i++) {
                            outfitIDToStyleMap[outfits[i].uniqueName] = outfits[i].styleID;
                        }

                        //process upvoted styles
                        let outfitUpvoteStyleIDs = outfitUpvoteInteractions.map(interaction => outfitIDToStyleMap[interaction.outfitID]);
                        let uniqueOutfitUpvoteStyleIDs = [...new Set(outfitUpvoteStyleIDs)];
                        let upvotedStyles = uniqueOutfitUpvoteStyleIDs.map(styleID => { return {styleID, occurrences: outfitUpvoteStyleIDs.reduce((styleOccurrences, currentStyleID) => (currentStyleID === styleID ? styleOccurrences + 1 : styleOccurrences), 0)}});
                        

                        //process opened styles
                        let outfitOpenStyleIDs = outfitOpenInteractions.map(interaction => outfitIDToStyleMap[interaction.outfitID]);
                        let uniqueOutfitOpenStyleIDs = [...new Set(outfitOpenStyleIDs)];
                        let openedStyles = uniqueOutfitOpenStyleIDs.map(styleID => { return {styleID, occurrences: outfitOpenStyleIDs.reduce((styleOccurrences, currentStyleID) => (currentStyleID === styleID ? styleOccurrences + 1 : styleOccurrences), 0)}});
                        

                        //process bought styles
                        let outfitBuyStyleIDs = outfitBuyInteractions.map(interaction => outfitIDToStyleMap[interaction.outfitID]);
                        let uniqueOutfitBuyStyleIDs = [...new Set(outfitBuyStyleIDs)];
                        let boughtStyles = uniqueOutfitBuyStyleIDs.map(styleID => { return {styleID, occurrences: outfitBuyStyleIDs.reduce((styleOccurrences, currentStyleID) => (currentStyleID === styleID ? styleOccurrences + 1 : styleOccurrences), 0)}});
                        

                        //process shown styles
                        let outfitShowTimeStyleIDsDuration = outfitShowTimeInteractions.map(interaction => { return {styleID: outfitIDToStyleMap[interaction.outfitID], showTime: interaction.showTime}});
                        let outfitShowTimeStyleIDs = outfitShowTimeInteractions.map(interaction => outfitIDToStyleMap[interaction.outfitID]);
                        let uniqueOutfitShowTimeStyleIDs = [...new Set(outfitShowTimeStyleIDs)];
                        let shownStyles = uniqueOutfitShowTimeStyleIDs.map(styleID => { return {styleID, showTime: outfitShowTimeStyleIDsDuration.reduce((styleShowTime, currentStyleDuration) => (currentStyleDuration.styleID === styleID ? styleShowTime + currentStyleDuration.showTime : styleShowTime), 0)}});

                        //process filtered styles
                        let filterStyleIDs = styleFilterInteractions.reduce( (output, interaction) => {
                            output = !output ? [] : output;
                            let filterByFields = interaction.urlQuery[constants.frontEnd.filterByParam];
                            let filterFields = filterByFields ? filterByFields.split(constants.frontEnd.filterAndOperator): [];
                            for(let i = 0; i < filterFields.length; i++) {
                                let filterField = filterFields[i].split(constants.frontEnd.filterEqOperator)[0];
                                let filterValues = filterFields[i].split(constants.frontEnd.filterEqOperator)[1].split(";");
                                if(filterField === "styleID") {
                                    for(let l = 0; l < filterValues.length; l++) {
                                        if(filterValues[l]) {
                                            output = output.concat(filterValues[l]);
                                        }
                                    }
                                }
                            }
                            return output;
                        }, 0) || [];
                        let uniqueFilterStyleIDs = [...new Set(filterStyleIDs)];
                        let filteredStyles = uniqueFilterStyleIDs.map(styleID => { return {styleID, occurrences: filterStyleIDs.reduce((styleOccurrences, currentStyleID) => (currentStyleID === styleID ? styleOccurrences + 1 : styleOccurrences), 0)}});
                        

                        let totalUpvotedStylesOccurrences = outfitUpvoteStyleIDs.reduce((styleOccurrences, currentStyleID) => (styleOccurrences+1), 0);
                        let upvotedStylesPercentage = upvotedStyles.map(style => { return {styleID: style.styleID, percentage: (style.occurrences / totalUpvotedStylesOccurrences) * constants.userProfiling.quotaOutfitUpvoteInteractions }});

                        let totalOpenedStylesOccurrences = outfitOpenStyleIDs.reduce((styleOccurrences, currentStyleID) => (styleOccurrences+1), 0);
                        let openedStylesPercentage = openedStyles.map(style => { return {styleID: style.styleID, percentage: (style.occurrences / totalOpenedStylesOccurrences) * constants.userProfiling.quotaOutfitOpenInteractions }});

                        let totalBoughtStylesOccurrences = outfitBuyStyleIDs.reduce((styleOccurrences, currentStyleID) => (styleOccurrences+1), 0);
                        let boughtStylesPercentage = boughtStyles.map(style => { return {styleID: style.styleID, percentage: (style.occurrences / totalBoughtStylesOccurrences) * constants.userProfiling.quotaOutfitBuyInteractions }});

                        let totalShownStylesDuration = outfitShowTimeStyleIDsDuration.reduce((styleShowTime, currentStyleDuration) => (styleShowTime + currentStyleDuration.showTime), 0);
                        let shownStylesPercentage = shownStyles.map(style => { return {styleID: style.styleID, percentage: (style.showTime / totalShownStylesDuration) * constants.userProfiling.quotaOutfitShowTimeInteractions }});

                        let totalFilteredStylesOccurrences = filterStyleIDs.reduce((styleOccurrences, currentStyleID) => (styleOccurrences+1), 0);
                        let filteredStylesPercentage = filteredStyles.map(style => { return {styleID: style.styleID, percentage: (style.occurrences / totalFilteredStylesOccurrences) * constants.userProfiling.quotaStyleFilterInteractions }});


                        //merge all the pieces
                        let totalPercentages = upvotedStylesPercentage.concat(openedStylesPercentage.concat(boughtStylesPercentage.concat(shownStylesPercentage.concat(filteredStylesPercentage))));
                        let allStyleIDs = uniqueOutfitUpvoteStyleIDs.concat(uniqueOutfitOpenStyleIDs.concat(uniqueOutfitBuyStyleIDs.concat(uniqueOutfitShowTimeStyleIDs.concat(uniqueFilterStyleIDs))));
                        let allUniqueStyleIDs = [...new Set(allStyleIDs)];
                        let userProfile = allUniqueStyleIDs.map(styleID => { return {styleID, percentage: totalPercentages.reduce((stylePercentage, currentStylePercentage) => (currentStylePercentage.styleID === styleID ? stylePercentage + currentStylePercentage.percentage : stylePercentage), 0)}});
                        
                        return {error, profile: userProfile};
                    /*}*/
                    

                } else {
                    return {error: {message: "Generic error during user profiling"}, profile: null};
                }
        }).catch(error => {
            return {error, profile: null};
        });
    },

    saveOutfitUpvote: async function (req, db) {
        
        if(req.flamesUser) {
            let validationResult = utilities.validateOutfitUpvote(req.body);
            if (validationResult.failed) {
                return {error: {message: validationResult.message}, outfit: null};
            } else {
                let outfitUniqueName = req.body.outfitUniqueName;
                let interaction = {
                    userID: req.flamesUser._id,
                    action: constants.interactions.outfitUpvoteAction,
                    outfitID: outfitUniqueName
                };

                //before saving the upvote, check if the user already upvoted that outfit
                return await db.collection(collectionName).findOne(interaction).then(async result => {
                    if (!result) {

                        utilities.preProcessMongoDocumentCreation(interaction);

                        return await db.collection(collectionName).insertOne(interaction).then(async result => {
                            let outfitQuery = {
                                uniqueName: outfitUniqueName
                            };
                            let updateDocument = { $inc: { votesCounter: 1 } };
                            return await db.collection("outfits").findOneAndUpdate(outfitQuery, updateDocument, { returnOriginal: false }).then(async outfit => {
                                if (!outfit.value) {
                                    return {error: {message: "No outfit " + outfitUniqueName + " found" }, outfit: null};
                                } else {
                                    let updatedOutfit = await outfitAPI.getOutfitByID(db, outfitUniqueName, req.flamesUser);
                                    return {error: null, outfit: updatedOutfit};
                                }
                            }).catch(error => {
                                return {error, outfit: null};
                            });
                        }).catch(error => {
                            return {error, outfit: null};
                        });

                    } else {
                        return {error: {message: "The user already upvoted outfit " + outfitUniqueName}, outfit: null};
                    }
                }).catch(error => {
                    return {error, outfit: null};
                });
            }
        } else {
            return {error: {message: "User is not set"}, outfit: null};
        }
    },

    deleteOutfitUpvote: async function (req, db) {

        if(req.flamesUser) {
            let validationResult = utilities.validateOutfitUpvote(req.body);
            if (validationResult.failed) {
                return {error: {message: validationResult.message}, outfit: null};
            } else {
                let outfitUniqueName = req.body.outfitUniqueName;
                let interaction = {
                    userID: req.flamesUser._id,
                    action: constants.interactions.outfitUpvoteAction,
                    outfitID: outfitUniqueName
                };

                //before deleting the upvote, check if the user already upvoted that outfit
                return await db.collection(collectionName).findOne(interaction).then(async result => {
                    if (result) {
                        return await db.collection(collectionName).deleteOne(interaction).then(async result => {
                            let outfitQuery = {
                                uniqueName: outfitUniqueName
                            };
                            let updateDocument = { $inc: { votesCounter: -1 } };
                            return await db.collection("outfits").findOneAndUpdate(outfitQuery, updateDocument, { returnOriginal: false }).then(async outfit => {
                                if (!outfit.value) {
                                    return {error: {message: "No outfit " + outfitUniqueName + " found" }, outfit: null};
                                } else {
                                    let updatedOutfit = await outfitAPI.getOutfitByID(db, outfitUniqueName, req.flamesUser);
                                    return {error: null, outfit: updatedOutfit};
                                }
                            }).catch(error => {
                                return {error, outfit: null};
                            });
                        }).catch(error => {
                            return {error, outfit: null};
                        });

                    } else {
                        return {error: {message: "The user has never upvoted outfit " + outfitUniqueName}, outfit: null};
                    }
                }).catch(error => {
                    return {error, outfit: null};
                });
            }
        } else {
            return {error: {message: "User is not set"}, outfit: null};
        }
    },

    saveOutfitSearch: function(req, db) {
        let urlQuery = req.query;
        if(req.flamesUser) {
            let outfitUniqueName = req.body.outfitUniqueName;
            let interaction = {
                userID: req.flamesUser._id,
                action: constants.interactions.outfitSearchAction,
                urlQuery: urlQuery
            };

            utilities.preProcessMongoDocumentCreation(interaction);

            db.collection(collectionName).insertOne(interaction).then(result => {
                
            });
        } else {
            /* LOG ERROR */
        }
    },

    saveOutfitOpen: function(req, db) {
        if(req.flamesUser) {
            let outfitUniqueName = req.params.uniqueName;
            let interaction = {
                userID: req.flamesUser._id,
                action: constants.interactions.outfitOpenAction,
                outfitID: outfitUniqueName
            };

            utilities.preProcessMongoDocumentCreation(interaction);

            db.collection(collectionName).insertOne(interaction).then(result => {
                
            });
        } else {
            /* LOG ERROR */
        }
    },

    saveOccasionOpen: function(req, db) {
        if(req.flamesUser) {
            let occasionUniqueName = req.params.uniqueName;
            let interaction = {
                userID: req.flamesUser._id,
                action: constants.interactions.occasionOpenAction,
                occasionID: occasionUniqueName
            };

            utilities.preProcessMongoDocumentCreation(interaction);

            db.collection(collectionName).insertOne(interaction).then(result => {
                
            });
        } else {
            /* LOG ERROR */
        }
    },

    saveStyleOpen: function(req, db) {
        if(req.flamesUser) {
            let styleUniqueName = req.params.uniqueName;
            let interaction = {
                userID: req.flamesUser._id,
                action: constants.interactions.styleOpenAction,
                styleID: styleUniqueName
            };

            utilities.preProcessMongoDocumentCreation(interaction);

            db.collection(collectionName).insertOne(interaction).then(result => {
                
            });
        } else {
            /* LOG ERROR */
        }
    },

    saveArticleOpen:  function(req, db) {
        if(req.flamesUser) {
            let articleUniqueName = req.params.uniqueName;
            let interaction = {
                userID: req.flamesUser._id,
                action: constants.interactions.articleOpenAction,
                articleID: articleUniqueName
            };

            utilities.preProcessMongoDocumentCreation(interaction);

            db.collection(collectionName).insertOne(interaction).then(result => {
                
            });
        } else {
            /* LOG ERROR */
        }
    },

    saveArticleBuy: function(req, db) {
        if(req.flamesUser) {
            let articleUniqueName = req.params.uniqueName;
            let interaction = {
                userID: req.flamesUser._id,
                action: constants.interactions.articleBuyAction,
                articleID: articleUniqueName
            };

            utilities.preProcessMongoDocumentCreation(interaction);

            db.collection(collectionName).insertOne(interaction).then(result => {
                
            });
        } else {
            /* LOG ERROR */
        }
    },

    saveOutfitBuy: function(req, db) {
        if(req.flamesUser) {
            let outfitUniqueName = req.params.uniqueName;
            let interaction = {
                userID: req.flamesUser._id,
                action: constants.interactions.outfitBuyAction,
                outfitID: outfitUniqueName
            };

            utilities.preProcessMongoDocumentCreation(interaction);

            db.collection(collectionName).insertOne(interaction).then(result => {
                
            });
        } else {
            /* LOG ERROR */
        }
    },

    saveInspirationSort: function(req, db) {
        let urlQuery = req.query;
        let orderByField = urlQuery[constants.frontEnd.orderByParam];

        if(req.flamesUser) {
            if(orderByField) { //only if an sorting field was specified
                let interaction = {
                    userID: req.flamesUser._id,
                    action: constants.interactions.inspirationSortAction,
                    orderByField: orderByField
                };

                utilities.preProcessMongoDocumentCreation(interaction);

                db.collection(collectionName).insertOne(interaction).then(result => {
                    
                });
            }
        } else {
            /* LOG ERROR */
        }
    },

    saveSearchSort: function(req, db) {
        let urlQuery = req.query;
        let orderByField = urlQuery[constants.frontEnd.orderByParam];

        if(req.flamesUser) {
            if(orderByField) { //only if an sorting field was specified
                let interaction = {
                    userID: req.flamesUser._id,
                    action: constants.interactions.searchSortAction,
                    orderByField: orderByField
                };

                utilities.preProcessMongoDocumentCreation(interaction);

                db.collection(collectionName).insertOne(interaction).then(result => {
                    
                });
            }
        } else {
            /* LOG ERROR */
        }
    },

    saveOutfitShowTime: function(req, db) {
        if(req.flamesUser) {
            let validationResult = utilities.validateShowTime(req.body);
            if (validationResult.failed) {
                return {error: {message: validationResult.message}, outfit: null};
            } else {
                let outfitUniqueName = req.params.uniqueName;
                let interaction = {
                    userID: req.flamesUser._id,
                    action: constants.interactions.outfitShowTimeAction,
                    outfitID: outfitUniqueName,
                    showTime: req.body.showTime
                };

                utilities.preProcessMongoDocumentCreation(interaction);

                db.collection(collectionName).insertOne(interaction).then(result => {
                    
                });
            }
        } else {
            /* LOG ERROR */
        }
    },

    saveOutfitZoomShowTime: function(req, db) {
        if(req.flamesUser) {
            let validationResult = utilities.validateShowTime(req.body);
            if (validationResult.failed) {
                return {error: {message: validationResult.message}, outfit: null};
            } else {
                let outfitUniqueName = req.params.uniqueName;
                let interaction = {
                    userID: req.flamesUser._id,
                    action: constants.interactions.outfitZoomShowTimeAction,
                    outfitID: outfitUniqueName,
                    showTime: req.body.showTime
                };

                utilities.preProcessMongoDocumentCreation(interaction);

                db.collection(collectionName).insertOne(interaction).then(result => {
                    
                });
            }
        } else {
            /* LOG ERROR */
        }
    },

    saveArticleZoomShowTime: function(req, db) {
        if(req.flamesUser) {
            let validationResult = utilities.validateShowTime(req.body);
            if (validationResult.failed) {
                return {error: {message: validationResult.message}, outfit: null};
            } else {
                let articleUniqueName = req.params.uniqueName;
                let interaction = {
                    userID: req.flamesUser._id,
                    action: constants.interactions.articleZoomShowTimeAction,
                    articleID: articleUniqueName,
                    showTime: req.body.showTime
                };

                utilities.preProcessMongoDocumentCreation(interaction);

                db.collection(collectionName).insertOne(interaction).then(result => {
                    
                });
            }
        } else {
            /* LOG ERROR */
        }
    }
};