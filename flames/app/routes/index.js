const outfitRoutes = require('./outfit_routes');
const occasionRoutes = require('./occasion_routes');
const styleRoutes = require('./style_routes');
const stylistRoutes = require('./stylist_routes');
const articleRoutes = require('./article_routes');
const interactionRoutes = require('./interaction_routes');
const landingRoutes = require('./landing_routes');
const userRoutes = require('./user_routes');

module.exports = function(app, db, shopifyConfig) {
    outfitRoutes(app, db);
    occasionRoutes(app, db);
    styleRoutes(app, db);
    stylistRoutes(app, db);
    articleRoutes(app, db, shopifyConfig);
    interactionRoutes(app, db);
    landingRoutes(app, db);
    userRoutes(app, db);
}