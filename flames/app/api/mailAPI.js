const nodemailer = require('nodemailer');
const smtpConfig = require('../../config/smtp');
const collectionName = "emails";

module.exports = {
    transporter: null,

    createTransporter: function () {
        if (!this.transporter) {
            this.transporter = nodemailer.createTransport({
                service: smtpConfig.server,
                auth: {
                    user: smtpConfig.user,
                    pass: smtpConfig.password
                }
            });
        }
        return this.transporter;
    },

    sendEmail: function (toAddress, subject, body, databaseInstance) {
        let mailer = this.createTransporter();
        let mailOptions = {
            from: smtpConfig.user,
            to: toAddress,
            subject,
            html: body
        };

        mailer.sendMail(mailOptions, function (error, info) {
            if (error) {
                mailOptions.result = error;
            } else {
                mailOptions.result = "Success";
            }
            databaseInstance.collection(collectionName).insertOne(mailOptions, (err, result) => {
                
            });
        });
    }
};