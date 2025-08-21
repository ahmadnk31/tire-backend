"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProductCatalogTemplate = void 0;
exports.sendVerificationEmail = sendVerificationEmail;
exports.sendContactConfirmationEmail = sendContactConfirmationEmail;
exports.sendAdminNotificationEmail = sendAdminNotificationEmail;
exports.sendNewsletterWelcomeEmail = sendNewsletterWelcomeEmail;
exports.sendPasswordResetEmail = sendPasswordResetEmail;
exports.sendOrderConfirmationEmail = sendOrderConfirmationEmail;
exports.sendAdminReplyEmail = sendAdminReplyEmail;
exports.sendNewsletterCampaignEmail = sendNewsletterCampaignEmail;
const client_ses_1 = require("@aws-sdk/client-ses");
const ses = new client_ses_1.SESClient({
    region: process.env.MY_AWS_REGION || 'eu-central-1',
    credentials: {
        accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY,
    },
});
const getEmailTemplate = (content, title) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(135deg, hsl(220, 9%, 20%) 0%, hsl(220, 9%, 30%) 100%);
            color: white;
            padding: 30px 20px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 600;
        }
        .content {
            padding: 30px 20px;
        }
        .footer {
            background-color: #f8fafc;
            padding: 20px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
            font-size: 14px;
            color: #64748b;
        }
        .button {
            display: inline-block;
            background-color: hsl(220, 9%, 20%);
            color: white;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-weight: 600;
            margin: 15px 0;
        }
        .highlight {
            background-color: #f1f5f9;
            padding: 15px;
            border-left: 4px solid hsl(220, 9%, 20%);
            margin: 15px 0;
        }
        .contact-info {
            background-color: #f8fafc;
            padding: 20px;
            border-radius: 6px;
            margin: 20px 0;
        }
        .contact-info h3 {
            margin-top: 0;
            color: #1e293b;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Ariana Bandencentraal</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">Your Tire Experts in Amsterdam</p>
        </div>
        <div class="content">
            ${content}
        </div>
        <div class="footer">
            <p><strong>Ariana Bandencentraal</strong></p>
            <p>123 Tire Street, Amsterdam, Netherlands 1234 AB</p>
            <p>Phone: +31 20 123 4567 | Email: info@arianabandencentraal.nl</p>
            <p>Business Hours: Mon-Fri 8:00-18:00, Sat 8:00-16:00</p>
        </div>
    </div>
</body>
</html>
`;
const getContactConfirmationTemplate = (name, inquiryType, subject, email) => {
    const inquiryTypeMap = {
        general: 'General Question',
        quote: 'Request Quote',
        appointment: 'Schedule Appointment',
        warranty: 'Warranty Claim',
        complaint: 'Complaint',
        support: 'Technical Support'
    };
    const unsubscribeUrl = `${process.env.FRONTEND_URL || 'https://tire-frontend.vercel.app'}/unsubscribe?email=${encodeURIComponent(email)}`;
    const content = `
    <h2>Thank you for contacting us, ${name}!</h2>
    <p>We have received your message and will get back to you within 24 hours.</p>
    
    <div class="highlight">
        <h3>Your Inquiry Details:</h3>
        <p><strong>Type:</strong> ${inquiryTypeMap[inquiryType] || inquiryType}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
    </div>

    <h3>What happens next?</h3>
    <ul>
        <li>Our team will review your message carefully</li>
        <li>We'll respond within 24 hours during business hours</li>
        <li>If urgent, call us directly at +31 20 123 4567</li>
    </ul>

    <div class="contact-info">
        <h3>Need Immediate Help?</h3>
        <p><strong>Emergency Service:</strong> +31 6 9999 0000 (24/7)</p>
        <p><strong>WhatsApp:</strong> +31 6 1234 5678</p>
        <p><strong>Visit Our Store:</strong> 123 Tire Street, Amsterdam</p>
    </div>

    <p>Thank you for choosing Ariana Bandencentraal for your tire needs!</p>
    
    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
        <p>This is an automated confirmation email. No longer wish to receive updates from us?</p>
        <p><a href="${unsubscribeUrl}" style="color: hsl(220, 9%, 20%); text-decoration: none;">Unsubscribe here</a></p>
        <p>Ariana Bandencentraal | Amsterdam, Netherlands</p>
    </div>
  `;
    return getEmailTemplate(content, `Message Received - ${subject}`);
};
const getAdminNotificationTemplate = (name, email, inquiryType, subject, message, phone) => {
    const inquiryTypeMap = {
        general: 'General Question',
        quote: 'Request Quote',
        appointment: 'Schedule Appointment',
        warranty: 'Warranty Claim',
        complaint: 'Complaint',
        support: 'Technical Support'
    };
    const content = `
    <h2>🔔 New Contact Form Submission</h2>
    <p>A new message has been received through the website contact form.</p>
    
    <div class="highlight">
        <h3>Customer Information:</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
        <p><strong>Inquiry Type:</strong> ${inquiryTypeMap[inquiryType] || inquiryType}</p>
        <p><strong>Subject:</strong> ${subject}</p>
    </div>

    <div class="contact-info">
        <h3>Message:</h3>
        <p style="white-space: pre-wrap; background: #f8fafc; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0;">${message}</p>
    </div>

    <p><strong>⏰ Response Required:</strong> Please respond within 24 hours</p>
    <p><strong>📅 Submitted:</strong> ${new Date().toLocaleString()}</p>

    <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
        <p><strong>Quick Actions:</strong></p>
        <a href="mailto:${email}" class="button">Reply to Customer</a>
    </div>
  `;
    return getEmailTemplate(content, `🔔 New Contact: ${subject}`);
};
const getNewsletterWelcomeTemplate = (email, name) => {
    const greeting = name ? `Hi ${name}` : 'Hello';
    const unsubscribeUrl = `${process.env.FRONTEND_URL || 'https://tire-frontend.vercel.app'}/unsubscribe?email=${encodeURIComponent(email)}`;
    const content = `
    <h2>${greeting}! Welcome to Ariana Bandencentraal</h2>
    <p>Thank you for subscribing to our newsletter! You're now part of our tire family.</p>
    
    <div class="highlight">
        <h3>🎉 What you can expect:</h3>
        <ul>
            <li>Exclusive tire deals and promotions</li>
            <li>Seasonal tire maintenance tips</li>
            <li>New product announcements</li>
            <li>Safety tips and driving advice</li>
            <li>Workshop updates and service reminders</li>
        </ul>
    </div>

    <h3>🚗 Why Choose Ariana Bandencentraal?</h3>
    <ul>
        <li><strong>Expert Installation:</strong> Professional tire mounting and balancing</li>
        <li><strong>Quality Brands:</strong> Top tire brands at competitive prices</li>
        <li><strong>Emergency Service:</strong> 24/7 roadside assistance available</li>
        <li><strong>Seasonal Storage:</strong> Tire storage services</li>
        <li><strong>Free Consultation:</strong> Expert advice on tire selection</li>
    </ul>

    <div class="contact-info">
        <h3>🛞 Ready for New Tires?</h3>
        <p>Browse our extensive tire collection online or visit our Amsterdam showroom.</p>
        <a href="${process.env.FRONTEND_URL || 'https://tire-frontend.vercel.app'}/products" class="button">Shop Tires Now</a>
    </div>

    <p>Follow us on social media for daily tips and updates!</p>
    
    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
        <p>You're receiving this email because you subscribed to our newsletter.</p>
        <p>Don't want to receive these emails? <a href="${unsubscribeUrl}" style="color: #2563eb; text-decoration: none;">Unsubscribe here</a></p>
        <p>Ariana Bandencentraal | Amsterdam, Netherlands</p>
    </div>
  `;
    return getEmailTemplate(content, 'Welcome to Ariana Bandencentraal Newsletter! 🚗');
};
async function sendVerificationEmail(email, token) {
    const link = `${process.env.FRONTEND_URL}/verify?email=${encodeURIComponent(email)}&token=${token}`;
    const content = `
    <h2>Verify Your Email Address</h2>
    <p>Thank you for creating an account with Ariana Bandencentraal!</p>
    <p>To complete your registration, please verify your email address by clicking the button below:</p>
    
    <div style="text-align: center; margin: 30px 0;">
        <a href="${link}" class="button">Verify Email Address</a>
    </div>

    <div class="highlight">
        <p><strong>⏰ This link will expire in 24 hours for security reasons.</strong></p>
        <p>If you didn't create an account, please ignore this email.</p>
    </div>

    <p>If the button doesn't work, copy and paste this link into your browser:</p>
    <p style="word-break: break-all; background: #f8fafc; padding: 10px; border-radius: 4px;">${link}</p>
  `;
    const params = {
        Source: process.env.SES_FROM_EMAIL,
        Destination: { ToAddresses: [email] },
        Message: {
            Subject: { Data: 'Verify your email - Ariana Bandencentraal' },
            Body: {
                Html: { Data: getEmailTemplate(content, 'Verify Your Email') },
            },
        },
    };
    const command = new client_ses_1.SendEmailCommand(params);
    await ses.send(command);
}
async function sendContactConfirmationEmail(email, name, inquiryType, subject) {
    const params = {
        Source: process.env.SES_FROM_EMAIL,
        Destination: { ToAddresses: [email] },
        Message: {
            Subject: { Data: `Message Received - ${subject}` },
            Body: {
                Html: { Data: getContactConfirmationTemplate(name, inquiryType, subject, email) },
            },
        },
    };
    const command = new client_ses_1.SendEmailCommand(params);
    await ses.send(command);
}
async function sendAdminNotificationEmail(adminEmail, customerName, customerEmail, inquiryType, subject, message, phone) {
    const params = {
        Source: process.env.SES_FROM_EMAIL,
        Destination: { ToAddresses: [adminEmail] },
        Message: {
            Subject: { Data: `🔔 New Contact: ${subject}` },
            Body: {
                Html: { Data: getAdminNotificationTemplate(customerName, customerEmail, inquiryType, subject, message, phone) },
            },
        },
    };
    const command = new client_ses_1.SendEmailCommand(params);
    await ses.send(command);
}
async function sendNewsletterWelcomeEmail(email, name) {
    const params = {
        Source: process.env.SES_FROM_EMAIL,
        Destination: { ToAddresses: [email] },
        Message: {
            Subject: { Data: 'Welcome to Ariana Bandencentraal Newsletter! 🚗' },
            Body: {
                Html: { Data: getNewsletterWelcomeTemplate(email, name) },
            },
        },
    };
    const command = new client_ses_1.SendEmailCommand(params);
    await ses.send(command);
}
async function sendPasswordResetEmail(email, token) {
    const link = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    const content = `
    <h2>Password Reset Request</h2>
    <p>We received a request to reset your password for your Ariana Bandencentraal account.</p>
    <p>Click the button below to create a new password:</p>
    
    <div style="text-align: center; margin: 30px 0;">
        <a href="${link}" class="button">Reset Password</a>
    </div>

    <div class="highlight">
        <p><strong>⏰ This link will expire in 1 hour for security reasons.</strong></p>
        <p>If you didn't request a password reset, please ignore this email.</p>
    </div>

    <p>If the button doesn't work, copy and paste this link into your browser:</p>
    <p style="word-break: break-all; background: #f8fafc; padding: 10px; border-radius: 4px;">${link}</p>

    <div class="contact-info">
        <h3>🔒 Security Tips:</h3>
        <ul>
            <li>Never share your password with anyone</li>
            <li>Use a strong, unique password</li>
            <li>Enable two-factor authentication if available</li>
        </ul>
    </div>
  `;
    const params = {
        Source: process.env.SES_FROM_EMAIL,
        Destination: { ToAddresses: [email] },
        Message: {
            Subject: { Data: 'Password Reset - Ariana Bandencentraal' },
            Body: {
                Html: { Data: getEmailTemplate(content, 'Password Reset') },
            },
        },
    };
    const command = new client_ses_1.SendEmailCommand(params);
    await ses.send(command);
}
async function sendOrderConfirmationEmail(email, customerName, orderNumber, orderItems, totalAmount) {
    const unsubscribeUrl = `${process.env.FRONTEND_URL || 'https://tire-frontend.vercel.app'}/unsubscribe?email=${encodeURIComponent(email)}`;
    const itemsList = orderItems.map(item => `<li>${item.quantity}x ${item.name} - €${item.price.toFixed(2)}</li>`).join('');
    const content = `
    <h2>Order Confirmation - Thank you ${customerName}!</h2>
    <p>Your tire order has been successfully placed and is being processed.</p>
    
    <div class="highlight">
        <h3>📋 Order Details:</h3>
        <p><strong>Order Number:</strong> #${orderNumber}</p>
        <p><strong>Order Date:</strong> ${new Date().toLocaleDateString()}</p>
        <p><strong>Total Amount:</strong> €${totalAmount.toFixed(2)}</p>
    </div>

    <div class="contact-info">
        <h3>🛞 Items Ordered:</h3>
        <ul>${itemsList}</ul>
    </div>

    <h3>What happens next?</h3>
    <ul>
        <li>We'll prepare your order within 1-2 business days</li>
        <li>You'll receive installation appointment details</li>
        <li>Our team will contact you to confirm timing</li>
        <li>Professional installation at our Amsterdam location</li>
    </ul>

    <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'https://tire-frontend.vercel.app'}/orders/${orderNumber}" class="button">Track Your Order</a>
    </div>

    <div class="contact-info">
        <h3>🔧 Installation Details:</h3>
        <p><strong>Location:</strong> 123 Tire Street, Amsterdam</p>
        <p><strong>Included Services:</strong></p>
        <ul>
            <li>Professional tire mounting</li>
            <li>Wheel balancing</li>
            <li>Disposal of old tires</li>
            <li>Post-installation check</li>
        </ul>
    </div>

    <p>Questions about your order? Reply to this email or call us at +31 20 123 4567.</p>
    
    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
        <p>This is an order confirmation email. No longer wish to receive marketing emails from us?</p>
        <p><a href="${unsubscribeUrl}" style="color: hsl(220, 9%, 20%); text-decoration: none;">Unsubscribe here</a></p>
        <p>Ariana Bandencentraal | Amsterdam, Netherlands</p>
    </div>
  `;
    const params = {
        Source: process.env.SES_FROM_EMAIL,
        Destination: { ToAddresses: [email] },
        Message: {
            Subject: { Data: `Order Confirmation #${orderNumber} - Ariana Bandencentraal` },
            Body: {
                Html: { Data: getEmailTemplate(content, `Order Confirmation #${orderNumber}`) },
            },
        },
    };
    const command = new client_ses_1.SendEmailCommand(params);
    await ses.send(command);
}
async function sendAdminReplyEmail(customerEmail, customerName, originalSubject, originalMessage, originalDate, replySubject, replyMessage) {
    const unsubscribeUrl = `${process.env.FRONTEND_URL || 'https://tire-frontend.vercel.app'}/unsubscribe?email=${encodeURIComponent(customerEmail)}`;
    const content = `
    <h2>Re: ${originalSubject}</h2>
    <p>Dear ${customerName},</p>
    <p>Thank you for contacting Ariana Bandencentraal. Here is our response to your inquiry:</p>
    
    <div class="highlight">
        <h3>Our Response:</h3>
        <p style="white-space: pre-wrap; line-height: 1.6;">${replyMessage}</p>
    </div>

    <div class="contact-info">
        <h3>Your Original Message:</h3>
        <p><strong>Date:</strong> ${originalDate}</p>
        <p><strong>Subject:</strong> ${originalSubject}</p>
        <p><strong>Message:</strong></p>
        <p style="white-space: pre-wrap; background: #f8fafc; padding: 15px; border-radius: 6px; border: 1px solid #e2e8f0;">${originalMessage}</p>
    </div>

    <p>If you have any additional questions, please don't hesitate to contact us.</p>
    
    <div class="contact-info">
        <h3>🔧 Need More Help?</h3>
        <p><strong>Call Us:</strong> +31 20 123 4567</p>
        <p><strong>WhatsApp:</strong> +31 6 1234 5678</p>
        <p><strong>Visit Us:</strong> 123 Tire Street, Amsterdam</p>
        <p><strong>Hours:</strong> Mon-Fri 8:00-18:00, Sat 8:00-16:00</p>
        <p><strong>Emergency:</strong> +31 6 9999 0000 (24/7)</p>
    </div>

    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
        <p>This is a direct response from our customer service team. Your satisfaction is our priority.</p>
        <p>No longer wish to receive emails from us? <a href="${unsubscribeUrl}" style="color: hsl(220, 9%, 20%); text-decoration: none;">Unsubscribe here</a></p>
        <p>Ariana Bandencentraal | Amsterdam, Netherlands</p>
    </div>
  `;
    const params = {
        Source: process.env.SES_FROM_EMAIL,
        Destination: { ToAddresses: [customerEmail] },
        Message: {
            Subject: { Data: `Re: ${replySubject} - Ariana Bandencentraal` },
            Body: {
                Html: { Data: getEmailTemplate(content, `Reply: ${replySubject}`) },
            },
        },
    };
    const command = new client_ses_1.SendEmailCommand(params);
    await ses.send(command);
}
async function sendNewsletterCampaignEmail(email, subject, message, unsubscribeUrl) {
    let emailContent;
    if (message.includes('<html') || message.includes('<!DOCTYPE')) {
        emailContent = message;
    }
    else {
        const content = `
      <h2>${subject}</h2>
      <div style="white-space: pre-wrap; line-height: 1.6; margin: 20px 0;">
        ${message}
      </div>

      <div class="highlight">
          <h3>🛞 Latest from Ariana Bandencentraal</h3>
          <p>Your trusted tire experts in Amsterdam, bringing you the latest updates, offers, and tire care tips.</p>
      </div>

      <div class="contact-info">
          <h3>🔧 Our Services</h3>
          <ul>
              <li>Professional tire installation and balancing</li>
              <li>Wheel alignment and tire repair</li>
              <li>Seasonal tire storage</li>
              <li>Emergency roadside assistance (24/7)</li>
              <li>Free tire consultation and size guidance</li>
          </ul>
      </div>

      <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'https://tire-frontend.vercel.app'}/products" class="button">Shop Tires Now</a>
      </div>

      <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
          <p>You're receiving this email because you subscribed to our newsletter.</p>
          ${unsubscribeUrl ? `<p><a href="${unsubscribeUrl}" style="color: #64748b; text-decoration: underline;">Unsubscribe from our newsletter</a></p>` : ''}
          <p>Follow us on social media for daily tips and updates!</p>
      </div>
    `;
        emailContent = getEmailTemplate(content, 'Newsletter Campaign - Tire Shop');
    }
    const params = {
        Source: process.env.SES_FROM_EMAIL,
        Destination: { ToAddresses: [email] },
        Message: {
            Subject: { Data: subject },
            Body: {
                Html: { Data: emailContent },
            },
        },
    };
    const command = new client_ses_1.SendEmailCommand(params);
    await ses.send(command);
}
;
const getProductCatalogTemplate = (data, unsubscribeUrl) => {
    const { products, campaignTitle, websiteUrl } = data;
    const productCards = products.map(product => {
        const productUrl = `${websiteUrl}/products/${product.id}`;
        const imageUrl = product.images?.[0] || '/placeholder.svg';
        const originalPrice = product.comparePrice ? parseFloat(product.comparePrice) : null;
        const currentPrice = parseFloat(product.price);
        const discount = originalPrice ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100) : 0;
        return `
      <div style="background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden; margin-bottom: 20px; max-width: 300px; display: inline-block; vertical-align: top; margin-right: 15px;">
        <div style="position: relative;">
          <img src="${imageUrl}" alt="${product.name}" style="width: 100%; height: 200px; object-fit: cover;">
          ${discount > 0 ? `<div style="position: absolute; top: 10px; right: 10px; background: #ef4444; color: white; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: bold;">-${discount}%</div>` : ''}
          ${product.stock <= 5 ? `<div style="position: absolute; top: 10px; left: 10px; background: #f59e0b; color: white; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: bold;">Low Stock</div>` : ''}
        </div>
        
        <div style="padding: 16px;">
          <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #1f2937; line-height: 1.4;">${product.name}</h3>
          <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">${product.brand} ${product.model}</p>
          <p style="margin: 0 0 12px 0; font-size: 14px; color: #374151; font-weight: 500;">Size: ${product.size}</p>
          
          <div style="display: flex; align-items: center; margin-bottom: 12px;">
            <span style="font-size: 18px; font-weight: 700; color: #1f2937;">$${product.price}</span>
            ${product.comparePrice ? `<span style="font-size: 14px; color: #9ca3af; text-decoration: line-through; margin-left: 8px;">$${product.comparePrice}</span>` : ''}
          </div>
          
          ${product.rating ? `
            <div style="display: flex; align-items: center; margin-bottom: 12px;">
              <div style="display: flex; margin-right: 4px;">
                ${Array.from({ length: 5 }).map((_, i) => `<span style="color: ${i < Math.floor(parseFloat(product.rating)) ? '#fbbf24' : '#d1d5db'};">★</span>`).join('')}
              </div>
              <span style="font-size: 12px; color: #6b7280;">(${product.rating}/5)</span>
            </div>
          ` : ''}
          
          <a href="${productUrl}" style="display: inline-block; width: 100%; text-align: center; background: hsl(220, 9%, 20%); color: white; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; box-sizing: border-box;">View Details</a>
        </div>
      </div>
    `;
    }).join('');
    const content = `
    <div class="hero-section">
        <h1>🚗 ${campaignTitle}</h1>
        <p style="font-size: 18px; margin: 20px 0;">Discover our carefully selected tire collection with unbeatable prices and quality!</p>
    </div>

    <div style="text-align: center; margin: 30px 0;">
        <h2 style="color: #1f2937; margin-bottom: 20px;">Featured Products</h2>
        <div style="text-align: center;">
            ${productCards}
        </div>
    </div>

    <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 30px 0; text-align: center;">
        <h3 style="color: #1f2937; margin-bottom: 15px;">🎯 Why Choose Our Tires?</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 20px;">
            <div>
                <h4 style="color: hsl(220, 9%, 20%); margin-bottom: 5px;">🛡️ Quality Guaranteed</h4>
                <p style="font-size: 14px; color: #64748b; margin: 0;">Premium brands with warranty</p>
            </div>
            <div>
                <h4 style="color: hsl(220, 9%, 20%); margin-bottom: 5px;">🚚 Free Delivery</h4>
                <p style="font-size: 14px; color: #64748b; margin: 0;">On orders over $200</p>
            </div>
            <div>
                <h4 style="color: hsl(220, 9%, 20%); margin-bottom: 5px;">⚡ Fast Installation</h4>
                <p style="font-size: 14px; color: #e7eaeeff; margin: 0;">Professional service in 30 mins</p>
            </div>
            <div>
                <h4 style="color: hsl(220, 9%, 20%); margin-bottom: 5px;">💰 Best Prices</h4>
                <p style="font-size: 14px; color: #f4f6f8ff; margin: 0;">Price match guarantee</p>
            </div>
        </div>
    </div>

    <div style="text-align: center; margin: 30px 0;">
        <a href="${websiteUrl}/products" class="button text-white">Browse All Tires</a>
        <p style="margin-top: 15px; font-size: 14px; color: #64748b;">Can't find what you're looking for? <a href="${websiteUrl}/contact" style="color: hsl(220, 9%, 20%);">Contact our experts</a></p>
    </div>

    <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
        <p>You're receiving this email because you subscribed to our newsletter.</p>
        ${unsubscribeUrl ? `<p><a href="${unsubscribeUrl}" style="color: hsl(220, 9%, 20%); text-decoration: underline;">Unsubscribe from our newsletter</a></p>` : ''}
        <p>Follow us on social media for the latest tire deals and automotive tips!</p>
    </div>
  `;
    return getEmailTemplate(content, `${campaignTitle} - Tire Shop`);
};
exports.getProductCatalogTemplate = getProductCatalogTemplate;
