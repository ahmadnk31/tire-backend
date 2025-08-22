"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailTranslations = void 0;
exports.getEmailTranslation = getEmailTranslation;
exports.replaceTemplateVariables = replaceTemplateVariables;
exports.emailTranslations = {
    en: {
        verification: {
            subject: 'Verify your email - Ariana Bandencentraal',
            title: 'Verify Your Email Address',
            greeting: 'Thank you for creating an account with Ariana Bandencentraal!',
            description: 'To complete your registration, please verify your email address by clicking the button below:',
            buttonText: 'Verify Email Address',
            expiryWarning: '⏰ This link will expire in 24 hours for security reasons.',
            ignoreMessage: 'If you didn\'t create an account, please ignore this email.',
            manualLinkText: 'If the button doesn\'t work, copy and paste this link into your browser:'
        },
        passwordReset: {
            subject: 'Reset your password - Ariana Bandencentraal',
            title: 'Reset Your Password',
            greeting: 'Hello!',
            description: 'We received a request to reset your password. Click the button below to create a new password:',
            buttonText: 'Reset Password',
            expiryWarning: '⏰ This link will expire in 1 hour for security reasons.',
            ignoreMessage: 'If you didn\'t request a password reset, please ignore this email.',
            manualLinkText: 'If the button doesn\'t work, copy and paste this link into your browser:'
        },
        contactConfirmation: {
            subject: 'Message Received - Ariana Bandencentraal',
            title: 'Thank You for Contacting Us',
            greeting: 'Dear {{name}},',
            description: 'We have received your message and will get back to you as soon as possible.',
            inquiryType: 'Inquiry Type',
            subjectLabel: 'Subject',
            messageLabel: 'Message',
            contactInfo: 'Contact Information',
            responseTime: 'We typically respond within 24 hours during business days.'
        },
        adminNotification: {
            subject: '🔔 New Contact: {{subject}}',
            title: 'New Contact Form Submission',
            newContact: 'New Contact',
            customerInfo: 'Customer Information',
            inquiryDetails: 'Inquiry Details',
            contactInfo: 'Contact Information'
        },
        newsletterWelcome: {
            subject: 'Welcome to Ariana Bandencentraal Newsletter! 🚗',
            title: 'Welcome to Our Newsletter!',
            greeting: 'Dear {{name}},',
            description: 'Thank you for subscribing to our newsletter! You\'ll now receive updates about:',
            benefits: [
                'Latest tire releases and promotions',
                'Seasonal maintenance tips',
                'Exclusive discounts and offers',
                'Industry news and updates'
            ],
            unsubscribe: 'You can unsubscribe at any time by clicking the link at the bottom of our emails.'
        },
        orderConfirmation: {
            subject: 'Order Confirmation - Ariana Bandencentraal',
            title: 'Order Confirmation',
            greeting: 'Dear {{name}},',
            orderNumber: 'Order Number',
            orderDate: 'Order Date',
            items: 'Items',
            total: 'Total',
            shippingAddress: 'Shipping Address',
            billingAddress: 'Billing Address',
            paymentMethod: 'Payment Method',
            estimatedDelivery: 'Estimated Delivery',
            contactSupport: 'If you have any questions, please contact our support team.'
        }
    },
    nl: {
        verification: {
            subject: 'Verifieer je e-mail - Ariana Bandencentraal',
            title: 'Verifieer Je E-mailadres',
            greeting: 'Bedankt voor het aanmaken van een account bij Ariana Bandencentraal!',
            description: 'Om je registratie te voltooien, verifieer je e-mailadres door op de onderstaande knop te klikken:',
            buttonText: 'E-mailadres Verifiëren',
            expiryWarning: '⏰ Deze link verloopt over 24 uur om veiligheidsredenen.',
            ignoreMessage: 'Als je geen account hebt aangemaakt, kun je deze e-mail negeren.',
            manualLinkText: 'Als de knop niet werkt, kopieer en plak deze link in je browser:'
        },
        passwordReset: {
            subject: 'Reset je wachtwoord - Ariana Bandencentraal',
            title: 'Reset Je Wachtwoord',
            greeting: 'Hallo!',
            description: 'We hebben een verzoek ontvangen om je wachtwoord te resetten. Klik op de onderstaande knop om een nieuw wachtwoord aan te maken:',
            buttonText: 'Wachtwoord Resetten',
            expiryWarning: '⏰ Deze link verloopt over 1 uur om veiligheidsredenen.',
            ignoreMessage: 'Als je geen wachtwoordreset hebt aangevraagd, kun je deze e-mail negeren.',
            manualLinkText: 'Als de knop niet werkt, kopieer en plak deze link in je browser:'
        },
        contactConfirmation: {
            subject: 'Bericht Ontvangen - Ariana Bandencentraal',
            title: 'Bedankt voor Je Bericht',
            greeting: 'Beste {{name}},',
            description: 'We hebben je bericht ontvangen en nemen zo snel mogelijk contact met je op.',
            inquiryType: 'Type Vraag',
            subjectLabel: 'Onderwerp',
            messageLabel: 'Bericht',
            contactInfo: 'Contactgegevens',
            responseTime: 'We reageren meestal binnen 24 uur tijdens werkdagen.'
        },
        adminNotification: {
            subject: '🔔 Nieuw Contact: {{subject}}',
            title: 'Nieuw Contactformulier',
            newContact: 'Nieuw Contact',
            customerInfo: 'Klantgegevens',
            inquiryDetails: 'Vraagdetails',
            contactInfo: 'Contactgegevens'
        },
        newsletterWelcome: {
            subject: 'Welkom bij de Ariana Bandencentraal Nieuwsbrief! 🚗',
            title: 'Welkom bij Onze Nieuwsbrief!',
            greeting: 'Beste {{name}},',
            description: 'Bedankt voor het abonneren op onze nieuwsbrief! Je ontvangt nu updates over:',
            benefits: [
                'Nieuwste bandenreleases en promoties',
                'Seizoensgebonden onderhoudstips',
                'Exclusieve kortingen en aanbiedingen',
                'Industrienieuws en updates'
            ],
            unsubscribe: 'Je kunt je op elk moment afmelden door op de link onderaan onze e-mails te klikken.'
        },
        orderConfirmation: {
            subject: 'Bestellingsbevestiging - Ariana Bandencentraal',
            title: 'Bestellingsbevestiging',
            greeting: 'Beste {{name}},',
            orderNumber: 'Bestelnummer',
            orderDate: 'Besteldatum',
            items: 'Artikelen',
            total: 'Totaal',
            shippingAddress: 'Verzendadres',
            billingAddress: 'Factuuradres',
            paymentMethod: 'Betaalmethode',
            estimatedDelivery: 'Geschatte Levering',
            contactSupport: 'Als je vragen hebt, neem dan contact op met ons supportteam.'
        }
    }
};
function getEmailTranslation(language = 'en') {
    return exports.emailTranslations[language] || exports.emailTranslations.en;
}
function replaceTemplateVariables(text, variables) {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return variables[key] || match;
    });
}
