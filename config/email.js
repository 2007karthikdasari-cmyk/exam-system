const nodemailer = require('nodemailer');
require('dotenv').config();

// Create transporter with better configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false
    },
    pool: true,
    maxConnections: 1,
    rateDelta: 1000,
    rateLimit: 5
});

// Verify connection configuration
transporter.verify(function(error, success) {
    if (error) {
        console.log('Email configuration error:', error);
    } else {
        console.log('Email server is ready to send messages');
    }
});

const sendEmail = async (to, subject, html, text = null) => {
    try {
        const mailOptions = {
            from: `"ExamSystem" <${process.env.EMAIL_USER}>`,
            to: to,
            subject: subject,
            text: text || html.replace(/<[^>]*>/g, ''), // Plain text fallback
            html: html
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully to:', to);
        console.log('Message ID:', info.messageId);
        return true;
    } catch (error) {
        console.error('Email sending error:', error);
        return false;
    }
};

module.exports = { sendEmail };