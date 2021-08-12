const utilities = require("../utils/utilities");
const interactionAPI = require("../api/interactionAPI");
const {ObjectId} = require('mongodb'); // or ObjectID 

module.exports = function (app, db) {
    /* OCCASION OPEN */
    app.post("/interaction/openOccasion/:uniqueName", async (req, res) => {

        interactionAPI.saveOccasionOpen(req, db);
        res.send({}); //no need for a real response, we are just tracking the user interaction here

    });

    /* STYLE OPEN */
    app.post("/interaction/openStyle/:uniqueName", async (req, res) => {

        interactionAPI.saveStyleOpen(req, db);
        res.send({}); //no need for a real response, we are just tracking the user interaction here

    });

    /* ARTICLE OPEN */
    app.post("/interaction/openArticle/:uniqueName", async (req, res) => {

        interactionAPI.saveArticleOpen(req, db);
        res.send({}); //no need for a real response, we are just tracking the user interaction here

    });

    /* OUTFIT OPEN */
    app.post("/interaction/openOutfit/:uniqueName", async (req, res) => {

        interactionAPI.saveOutfitOpen(req, db);
        res.send({}); //no need for a real response, we are just tracking the user interaction here

    });

    /* ARTICLE BUY */
    app.post("/interaction/buyArticle/:uniqueName", async (req, res) => {

        interactionAPI.saveArticleBuy(req, db);
        res.send({}); //no need for a real response, we are just tracking the user interaction here

    });

    /* OUTFIT BUY */
    app.post("/interaction/buyOutfit/:uniqueName", async (req, res) => {

        interactionAPI.saveOutfitBuy(req, db);
        res.send({}); //no need for a real response, we are just tracking the user interaction here

    });

    /* OUTFIT SHOW TIME */
    app.post("/interaction/outfitShowTime/:uniqueName", async (req, res) => {

        interactionAPI.saveOutfitShowTime(req, db);
        res.send({}); //no need for a real response, we are just tracking the user interaction here

    });

    /* OUTFIT ZOOM SHOW TIME */
    app.post("/interaction/outfitZoomShowTime/:uniqueName", async (req, res) => {

        interactionAPI.saveOutfitShowTime(req, db);
        res.send({}); //no need for a real response, we are just tracking the user interaction here

    });

    /* ARTICLE ZOOM SHOW TIME */
    app.post("/interaction/articleZoomShowTime/:uniqueName", async (req, res) => {

        interactionAPI.saveArticleZoomShowTime(req, db);
        res.send({}); //no need for a real response, we are just tracking the user interaction here

    });

    /* USER PROFILE MONITOR */
    app.get("/interaction/userProfileMonitor/:userID", async (req, res) => {
        let fakeUserObject = {};
        fakeUserObject.flamesUser = {}
        fakeUserObject.flamesUser._id = ObjectId(req.params.userID);

        let userProfile = await interactionAPI.getUserProfile(fakeUserObject, db);
        
        let error = userProfile.error;
        let result;
        if(error) {
            res.status(500).send({ "error": error.message, "errorCode": error.code });
        } else {
            let profile = userProfile.profile;
            res.send(profile);
        }
    });
};