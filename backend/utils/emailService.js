import nodemailer from 'nodemailer';
import CompanyContact from '../models/CompanyContact.js';

// Helper function to identify email provider
const getEmailProvider = (email) => {
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return 'Unknown';
    
    if (domain.includes('gmail')) return 'Gmail';
    if (domain.includes('outlook') || domain.includes('hotmail') || domain.includes('live')) return 'Outlook/Hotmail';
    if (domain.includes('yahoo')) return 'Yahoo';
    if (domain.includes('icloud') || domain.includes('me.com')) return 'iCloud';
    if (domain.includes('protonmail') || domain.includes('proton')) return 'ProtonMail';
    return `Corporate (${domain})`;
};

// Send email via Brevo API (works with ALL email types: Gmail, corporate, any domain)
const sendViaBrevoAPI = async (to, ccEmails, subject, htmlContent) => {
    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL;
    const senderName = process.env.BREVO_SENDER_NAME || 'Financial Manager';
    
    if (!apiKey || !senderEmail) {
        console.warn('⚠️ BREVO_API_KEY or BREVO_SENDER_EMAIL not found. Skipping Brevo API.');
        return null;
    }
    
    try {
        const recipients = [{ email: to }];
        
        // Handle CC emails with or without names - extract email address
        const ccRecipients = ccEmails.map(emailStr => {
            // Extract email from formats like: "Name <email>" or just "email"
            const emailMatch = emailStr.match(/<(.+?)>/) || emailStr.match(/(\S+@\S+)/);
            const email = emailMatch ? emailMatch[1] : emailStr.trim();
            
            // Try to extract name if present
            const nameMatch = emailStr.match(/^(.+?)\s*</);
            const name = nameMatch ? nameMatch[1].trim() : undefined;
            
            const recipient = { email: email };
            if (name) {
                recipient.name = name;
            }
            return recipient;
        });
        
        const payload = {
            sender: { email: senderEmail, name: senderName },
            to: recipients,
            subject: subject,
            htmlContent: htmlContent
        };
        
        if (ccRecipients.length > 0) {
            payload.cc = ccRecipients;
        }
        
        console.log('📤 Sending via Brevo API (v3/smtp/email):');
        console.log('   To:', to, `(${getEmailProvider(to)})`);
        console.log('   CC Recipients (raw):', ccEmails);
        console.log('   CC Recipients (processed):', JSON.stringify(ccRecipients, null, 2));
        console.log('   CC Count:', ccRecipients.length);
        if (ccRecipients.length > 0) {
            console.log('   CC Providers:', ccEmails.map(e => getEmailProvider(e)).join(', '));
        }
        console.log('   From:', `${senderName} <${senderEmail}>`);
        console.log('   Subject:', subject);
        console.log('\n🔍 Full Payload being sent to Brevo:');
        console.log(JSON.stringify({
            ...payload,
            htmlContent: '[HTML CONTENT - HIDDEN]'
        }, null, 2));
        
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': apiKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        const responseText = await response.text();
        
        if (!response.ok) {
            console.error('❌ Brevo API HTTP Error:', response.status, response.statusText);
            console.error('   Response:', responseText);
            let error;
            try {
                error = JSON.parse(responseText);
            } catch (e) {
                error = { message: responseText };
            }
            throw new Error(`Brevo API error: ${error.message || response.statusText}`);
        }
        
        const result = JSON.parse(responseText);
        console.log('✅ Email sent via Brevo API successfully!');
        console.log('   Message ID:', result.messageId);
        console.log('   To:', to);
        console.log('   CC sent to:', ccEmails.join(', ') || 'NONE');
        console.log('   Full API Response:', JSON.stringify(result, null, 2));
        
        // Check if Brevo actually sent to CC recipients
        if (ccEmails.length > 0) {
            console.log('\n⚠️ IMPORTANT: Brevo API might have restrictions on CC for free accounts.');
            console.log('   If CC recipients did NOT receive emails, this is a Brevo limitation.');
            console.log('   Solution: Using individual email sending instead...\n');
        }
        
        return {
            success: true,
            messageId: result.messageId,
            service: 'Brevo API',
            ccCount: ccEmails.length,
            needsIndividualSending: ccEmails.length > 0  // Flag to trigger individual sends
        };
    } catch (error) {
        console.error('❌ Brevo API error:', error.message);
        if (error.stack) {
            console.error('   Stack:', error.stack);
        }
        return null;
    }
};

// Create Brevo SMTP transporter (works with ALL email types: Gmail, corporate, any domain)
let brevoTransporter = null;

const getBrevoTransporter = () => {
    if (!brevoTransporter) {
        const smtpLogin = process.env.BREVO_SMTP_LOGIN;
        const apiKey = process.env.BREVO_API_KEY;
        
        if (!smtpLogin || !apiKey) {
            console.warn('⚠️ BREVO_SMTP_LOGIN or BREVO_API_KEY not found. Skipping Brevo SMTP.');
            return null;
        }
        
        brevoTransporter = nodemailer.createTransport({
            host: 'smtp-relay.brevo.com',
            port: 587,
            secure: false,
            auth: {
                user: smtpLogin,
                pass: apiKey
            }
        });
        console.log('✅ Brevo SMTP transporter initialized with login:', smtpLogin);
    }
    return brevoTransporter;
};

// Create Gmail transporter (fallback)
let gmailTransporter = null;

const getGmailTransporter = () => {
    if (!gmailTransporter) {
        gmailTransporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER || 'your-email@gmail.com',
                pass: process.env.EMAIL_PASSWORD || 'your-app-password'
            },
            pool: true,
            maxConnections: 5,
            maxMessages: 100,
            rateDelta: 1000,
            rateLimit: 1
        });
        console.log('✅ Gmail SMTP transporter initialized (fallback)');
    }
    return gmailTransporter;
};

// Get company email from DATABASE
export const getCompanyEmail = async (companyName) => {
    try {
        const contact = await CompanyContact.findByCompanyName(companyName);
        
        if (contact) {
            console.log(`📋 Retrieved company contact for "${companyName}":`, {
                email: contact.email,
                ccEmails: contact.ccEmails,
                ccEmailsType: typeof contact.ccEmails,
                ccEmailsIsArray: Array.isArray(contact.ccEmails),
                ccCount: contact.ccEmails?.length || 0,
                rawContact: JSON.stringify(contact.ccEmails)
            });
            
            // Ensure ccEmails is always an array
            let ccEmailsArray = [];
            if (contact.ccEmails) {
                if (Array.isArray(contact.ccEmails)) {
                    ccEmailsArray = contact.ccEmails;
                } else if (typeof contact.ccEmails === 'string') {
                    // Handle case where it might be stored as string
                    ccEmailsArray = contact.ccEmails.split(/[,;\n]/).map(e => e.trim()).filter(e => e);
                }
            }
            
            console.log(`✅ Processed CC emails:`, ccEmailsArray);
            
            return {
                email: contact.email,
                contactPerson: contact.contactPerson || 'Valued Customer',
                companyName: contact.companyName,
                ccEmails: ccEmailsArray, // CC emails array
                phone: contact.phone || '',
                department: contact.department || ''
            };
        }
        
        console.log(`❌ No contact found for company: "${companyName}"`);
        return null;
    } catch (error) {
        console.error('Error reading company email:', error);
        return null;
    }
};

// Helper to determine payment status
const getPaymentStatus = (invoice) => {
    const balance = parseFloat(invoice.balance_due || 0);
    if (balance <= 0) return 'Paid';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dueDate = new Date(invoice.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    
    if (dueDate < today) return 'Overdue';
    
    const total = parseFloat(invoice.total_Amount || 0);
    if (balance < total && balance > 0) return 'PartiallyPaid';
    
    return 'Due';
};

// Template for DUE invoices (Enhanced Professional Corporate Design)
const getDueTemplate = (invoice, recipientInfo) => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <title>Invoice Payment Reminder</title>
        <!--[if mso]>
        <style type="text/css">
            body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
        </style>
        <![endif]-->
    </head>
    <body style="margin: 0; padding: 0; background-color: #f0f4f8; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
        <!-- Email Container -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f0f4f8; padding: 40px 20px;">
            <tr>
                <td align="center">
                    <!-- Main Email Card -->
                    <table role="presentation" width="650" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.12);">
                        
                        <!-- Professional Header with Branding -->
                        <tr>
                            <td style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #3b82f6 100%); padding: 0;">
                                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                    <tr>
                                        <td style="padding: 40px 50px;">
                                            <!-- Company Logo & Name -->
                                            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                                <tr>
                                                    <td style="padding-bottom: 24px;">
                                                        <table cellpadding="0" cellspacing="0" border="0">
                                                            <tr>
                                                                <td style="background-color: rgba(255,255,255,0.95); padding: 14px 24px; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                                                                    <h1 style="margin: 0; color: #1e3a8a; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; text-transform: uppercase;">
                                                                        <span style="color: #2563eb;">FINANCE</span> PORTAL
                                                                    </h1>
                                                                </td>
                                                            </tr>
                                                        </table>
                                                    </td>
                                                    <td align="right" style="padding-bottom: 24px;">
                                                        <div style="background-color: rgba(255,255,255,0.2); backdrop-filter: blur(10px); padding: 10px 20px; border-radius: 30px; border: 2px solid rgba(255,255,255,0.3);">
                                                            <span style="color: #ffffff; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">⏰ Payment Due</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            </table>
                                            <!-- Title -->
                                            <h2 style="margin: 16px 0 0 0; color: #ffffff; font-size: 32px; font-weight: 700; letter-spacing: -1px; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">Invoice Payment Reminder</h2>
                                            <p style="margin: 12px 0 0 0; color: rgba(255,255,255,0.95); font-size: 16px; font-weight: 500; letter-spacing: 0.3px;">Your prompt payment is appreciated</p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        
                        <!-- Content Body -->
                        <tr>
                            <td style="padding: 50px;">
                                <!-- Greeting Card -->
                                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 36px;">
                                    <tr>
                                        <td style="background: linear-gradient(to right, #f0f9ff, #e0f2fe); padding: 24px 28px; border-radius: 12px; border-left: 5px solid #2563eb;">
                                            <p style="margin: 0 0 6px 0; color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Bill To</p>
                                            <h3 style="margin: 0; color: #0f172a; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">${invoice.companyName}</h3>
                                            ${recipientInfo.contactPerson ? `<p style="margin: 8px 0 0 0; color: #475569; font-size: 14px;">Attn: ${recipientInfo.contactPerson}</p>` : ''}
                                        </td>
                                    </tr>
                                </table>
                                
                                <p style="margin: 0 0 36px 0; color: #334155; font-size: 16px; line-height: 1.8; font-weight: 500;">
                                    Dear Valued Partner,<br><br>
                                    This is a friendly reminder regarding your upcoming invoice payment. We kindly request that you process the payment by the due date to ensure continued smooth business operations.
                                </p>
                                
                                <!-- Enhanced Invoice Details Card -->
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 50%, #f0f9ff 100%); border-radius: 16px; border: 3px solid #3b82f6; margin-bottom: 36px; overflow: hidden; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);">
                                    <tr>
                                        <td style="padding: 36px 32px;">
                                            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                                <tr>
                                                    <td colspan="2" style="padding-bottom: 24px;">
                                                        <table cellpadding="0" cellspacing="0" border="0">
                                                            <tr>
                                                                <td style="background-color: #1e40af; padding: 10px 20px; border-radius: 8px;">
                                                                    <h4 style="margin: 0; color: #ffffff; font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">📋 INVOICE SUMMARY</h4>
                                                                </td>
                                                            </tr>
                                                        </table>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 14px 0; color: #64748b; font-size: 15px; font-weight: 600;">Invoice Number</td>
                                                    <td style="padding: 14px 0; color: #0f172a; font-size: 17px; font-weight: 800; text-align: right; font-family: 'Courier New', monospace; letter-spacing: 1px;">${invoice.invoiceNumber}</td>
                                                </tr>
                                                <tr style="border-top: 2px dashed #bfdbfe;">
                                                    <td style="padding: 14px 0; color: #64748b; font-size: 15px; font-weight: 600;">Invoice Date</td>
                                                    <td style="padding: 14px 0; color: #1e293b; font-size: 16px; font-weight: 700; text-align: right;">${new Date(invoice.invoiceDate).toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'})}</td>
                                                </tr>
                                                <tr style="border-top: 2px dashed #bfdbfe;">
                                                    <td style="padding: 14px 0; color: #64748b; font-size: 15px; font-weight: 600;">Payment Due Date</td>
                                                    <td style="padding: 14px 0; color: #1e40af; font-size: 16px; font-weight: 800; text-align: right;">📅 ${new Date(invoice.dueDate).toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'})}</td>
                                                </tr>
                                                <tr style="border-top: 3px solid #3b82f6; background: linear-gradient(to right, rgba(59, 130, 246, 0.1), rgba(37, 99, 235, 0.15));">
                                                    <td style="padding: 20px 0 8px 0; color: #0f172a; font-size: 18px; font-weight: 800;">TOTAL AMOUNT DUE</td>
                                                    <td style="padding: 20px 0 8px 0; color: #1e3a8a; font-size: 40px; font-weight: 900; text-align: right; letter-spacing: -1.5px; line-height: 1;">₹${parseFloat(invoice.balance_due || 0).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                                </tr>
                                                <tr>
                                                    <td colspan="2" style="padding: 0 0 12px 0; text-align: right;">
                                                        <span style="color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase;">Indian Rupees</span>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                                
                                ${invoice.description ? `
                                <!-- Description Section -->
                                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; padding: 26px; border-radius: 12px; border-left: 5px solid #6366f1; margin-bottom: 32px;">
                                    <tr>
                                        <td>
                                            <p style="margin: 0 0 10px 0; color: #6366f1; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">📝 Description</p>
                                            <p style="margin: 0; color: #1e293b; font-size: 15px; line-height: 1.8; font-weight: 500;">${invoice.description}</p>
                                        </td>
                                    </tr>
                                </table>
                                ` : ''}
                                
                                ${invoice.bankAccountNo ? `
                                <!-- Enhanced Payment Information -->
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(to bottom, #ffffff, #f8fafc); border: 2px solid #e2e8f0; border-radius: 16px; margin-bottom: 36px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
                                    <tr>
                                        <td style="background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%); padding: 18px 28px;">
                                            <h4 style="margin: 0; color: #ffffff; font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">💳 PAYMENT DETAILS</h4>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 28px;">
                                            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                                ${invoice.bankAccountName ? `
                                                <tr>
                                                    <td style="padding: 12px 0; color: #64748b; font-size: 14px; font-weight: 600;">Beneficiary Name</td>
                                                    <td style="padding: 12px 0; color: #0f172a; font-size: 15px; font-weight: 700; text-align: right;">${invoice.bankAccountName}</td>
                                                </tr>
                                                <tr style="border-top: 1px dashed #e2e8f0;">` : '<tr>'}
                                                    <td style="padding: 12px 0; color: #64748b; font-size: 14px; font-weight: 600;">Account Number</td>
                                                    <td style="padding: 12px 0; color: #1e3a8a; font-size: 16px; font-weight: 800; text-align: right; font-family: 'Courier New', monospace; letter-spacing: 1px; background-color: #eff6ff; padding: 8px 12px; border-radius: 6px;">${invoice.bankAccountNo}</td>
                                                </tr>
                                                ${invoice.bankIFSC ? `
                                                <tr style="border-top: 1px dashed #e2e8f0;">
                                                    <td style="padding: 12px 0; color: #64748b; font-size: 14px; font-weight: 600;">IFSC Code</td>
                                                    <td style="padding: 12px 0; color: #1e3a8a; font-size: 16px; font-weight: 800; text-align: right; font-family: 'Courier New', monospace; letter-spacing: 1px;">${invoice.bankIFSC}</td>
                                                </tr>` : ''}
                                                ${invoice.bankName ? `
                                                <tr style="border-top: 1px dashed #e2e8f0;">
                                                    <td style="padding: 12px 0; color: #64748b; font-size: 14px; font-weight: 600;">Bank Name</td>
                                                    <td style="padding: 12px 0; color: #0f172a; font-size: 15px; font-weight: 700; text-align: right;">${invoice.bankName}</td>
                                                </tr>` : ''}
                                                ${invoice.bankBranch ? `
                                                <tr style="border-top: 1px dashed #e2e8f0;">
                                                    <td style="padding: 12px 0; color: #64748b; font-size: 14px; font-weight: 600;">Branch</td>
                                                    <td style="padding: 12px 0; color: #0f172a; font-size: 14px; font-weight: 600; text-align: right;">${invoice.bankBranch}</td>
                                                </tr>` : ''}
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                                ` : ''}
                                
                                <!-- Action Button -->
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 32px;">
                                    <tr>
                                        <td align="center" style="padding: 20px 0;">
                                            <table cellpadding="0" cellspacing="0" border="0">
                                                <tr>
                                                    <td style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); padding: 16px 48px; border-radius: 50px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);">
                                                        <a href="mailto:accounts@yourcompany.com?subject=Payment%20for%20Invoice%20${invoice.invoiceNumber}" style="color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">
                                                            💬 Contact Us for Payment
                                                        </a>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                                
                                <!-- Important Notice Box -->
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(to right, #dbeafe, #e0f2fe); border-radius: 12px; border-left: 5px solid #0ea5e9; margin-bottom: 36px;">
                                    <tr>
                                        <td style="padding: 22px 26px;">
                                            <table cellpadding="0" cellspacing="0" border="0">
                                                <tr>
                                                    <td style="padding-right: 12px; vertical-align: top;">
                                                        <span style="font-size: 24px;">ℹ️</span>
                                                    </td>
                                                    <td>
                                                        <p style="margin: 0; color: #0c4a6e; font-size: 15px; font-weight: 600; line-height: 1.7;">
                                                            Please ensure payment is submitted by <strong style="color: #1e3a8a;">${new Date(invoice.dueDate).toLocaleDateString('en-IN', {day: 'numeric', month: 'long', year: 'numeric'})}</strong> to avoid late payment charges and maintain uninterrupted service.
                                                        </p>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                                
                                <p style="margin: 0 0 28px 0; color: #64748b; font-size: 14px; line-height: 1.8;">
                                    If you have already processed this payment, please accept our thanks and disregard this reminder. For any queries or payment confirmation, please don't hesitate to contact our accounts receivable team.
                                </p>
                                
                                <!-- Payment Instructions Images -->
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(to bottom, #f8fafc, #ffffff); border: 2px solid #e2e8f0; border-radius: 16px; margin-bottom: 36px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
                                    <tr>
                                        <td style="background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%); padding: 18px 28px;">
                                            <h4 style="margin: 0; color: #ffffff; font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">📋 PAYMENT INSTRUCTIONS</h4>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 28px; text-align: center;">
                                            <p style="margin: 0 0 20px 0; color: #475569; font-size: 14px; font-weight: 600;">Please refer to the following payment guide:</p>
                                            
                                            <!-- Image 1 -->
                                            <div style="margin-bottom: 20px;">
                                                <img src="https://i.postimg.cc/rszYzVtC/Picture1.png" alt="Payment Instructions - Part 1" style="max-width: 100%; height: auto; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); border: 2px solid #e2e8f0;" />
                                            </div>
                                            
                                            <!-- Image 2 -->
                                            <div style="margin-bottom: 10px;">
                                                <img src="https://i.postimg.cc/m2nqKHFM/Picture2.png" alt="Payment Instructions - Part 2" style="max-width: 100%; height: auto; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); border: 2px solid #e2e8f0;" />
                                            </div>
                                            
                                            <p style="margin: 20px 0 0 0; color: #64748b; font-size: 12px; font-style: italic;">For your convenience, please follow the above guidelines for a smooth payment process</p>
                                        </td>
                                    </tr>
                                </table>
                                
                                <!-- Professional Signature -->
                                <div style="margin-top: 44px; padding-top: 28px; border-top: 2px solid #e2e8f0;">
                                    <p style="margin: 0 0 10px 0; color: #0f172a; font-size: 15px; font-weight: 600;">Warm regards,</p>
                                    <p style="margin: 0 0 4px 0; color: #1e3a8a; font-size: 18px; font-weight: 800;">Accounts Receivable Department</p>
                                    <p style="margin: 0 0 2px 0; color: #2563eb; font-size: 16px; font-weight: 700;">Finance Portal</p>
                                    <p style="margin: 8px 0 0 0; color: #64748b; font-size: 13px; font-weight: 500;">Your Trusted Financial Partner</p>
                                </div>
                            </td>
                        </tr>
                        
                        <!-- Enhanced Professional Footer -->
                        <tr>
                            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%); padding: 0;">
                                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                    <tr>
                                        <td style="padding: 36px 50px; text-align: center;">
                                            <!-- Footer Content -->
                                            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                                <tr>
                                                    <td align="center" style="padding-bottom: 20px;">
                                                        <h3 style="margin: 0 0 8px 0; color: #ffffff; font-size: 20px; font-weight: 700;">Finance Portal</h3>
                                                        <p style="margin: 0; color: #94a3b8; font-size: 13px; font-weight: 500;">Professional Accounts Receivable Management</p>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 20px 0; border-top: 1px solid rgba(148, 163, 184, 0.2); border-bottom: 1px solid rgba(148, 163, 184, 0.2);">
                                                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                                            <tr>
                                                                <td align="center" style="padding: 4px 0;">
                                                                    <p style="margin: 0; color: #cbd5e1; font-size: 13px; font-weight: 500;">
                                                                        📧 <a href="mailto:accounts@yourcompany.com" style="color: #60a5fa; text-decoration: none; font-weight: 600;">accounts@yourcompany.com</a>
                                                                    </p>
                                                                </td>
                                                            </tr>
                                                            <tr>
                                                                <td align="center" style="padding: 4px 0;">
                                                                    <p style="margin: 0; color: #cbd5e1; font-size: 13px; font-weight: 500;">
                                                                        📞 +91 XXXX XXXXXX | 🌐 www.yourcompany.com
                                                                    </p>
                                                                </td>
                                                            </tr>
                                                        </table>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td align="center" style="padding-top: 20px;">
                                                        <p style="margin: 0 0 8px 0; color: #94a3b8; font-size: 12px; line-height: 1.6;">
                                                            This is an automated payment reminder sent by Finance Portal.<br>
                                                            Please do not reply directly to this email.
                                                        </p>
                                                        <p style="margin: 0; color: #64748b; font-size: 11px; font-weight: 500;">
                                                            © ${new Date().getFullYear()} Finance Portal. All Rights Reserved.
                                                        </p>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
`;

// Template for OVERDUE invoices (Urgent reminder)
const getOverdueTemplate = (invoice, recipientInfo) => {
    const daysOverdue = Math.floor((new Date() - new Date(invoice.dueDate)) / (1000 * 60 * 60 * 24));
    
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice Overdue - Urgent Action Required</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc;">
            <tr>
                <td align="center" style="padding: 40px 20px;">
                    <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); overflow: hidden;">
                        <!-- Header with Red Gradient -->
                        <tr>
                            <td style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 40px 30px; text-align: center;">
                                <div style="background-color: rgba(255,255,255,0.2); display: inline-block; padding: 10px 20px; border-radius: 50px; margin-bottom: 15px;">
                                    <span style="color: #ffffff; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px;">⚠️ URGENT - Payment Overdue</span>
                                </div>
                                <h1 style="color: #ffffff; margin: 15px 0 10px 0; font-size: 32px; font-weight: 700; line-height: 1.2;">Immediate Action Required</h1>
                                <p style="color: rgba(255,255,255,0.95); margin: 0; font-size: 16px; font-weight: 600;">${daysOverdue} Day${daysOverdue > 1 ? 's' : ''} Past Due Date</p>
                            </td>
                        </tr>
                        
                        <!-- Main Content -->
                        <tr>
                            <td style="padding: 40px 35px;">
                                <p style="color: #1e293b; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">
                                    Dear Team at <strong style="color: #dc2626;">${invoice.companyName}</strong>,
                                </p>
                                
                                <p style="color: #475569; margin: 0 0 30px 0; font-size: 15px; line-height: 1.7;">
                                    This is an <strong style="color: #dc2626;">urgent reminder</strong> that the following invoice payment is now <strong style="color: #dc2626;">overdue by ${daysOverdue} day${daysOverdue > 1 ? 's' : ''}</strong>. We request your immediate attention to settle this outstanding amount.
                                </p>
                                
                                <!-- Invoice Details Card -->
                                <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 30px; background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); border-radius: 12px; overflow: hidden; border: 2px solid #fca5a5;">
                                    <tr>
                                        <td style="padding: 25px;">
                                            <table role="presentation" style="width: 100%; border-collapse: collapse;">
                                                <tr>
                                                    <td style="padding: 12px 0; border-bottom: 1px solid rgba(220, 38, 38, 0.1);">
                                                        <span style="color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Invoice Number</span>
                                                    </td>
                                                    <td style="padding: 12px 0; text-align: right; border-bottom: 1px solid rgba(220, 38, 38, 0.1);">
                                                        <span style="color: #1e293b; font-size: 15px; font-weight: 700;">${invoice.invoiceNumber}</span>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 12px 0; border-bottom: 1px solid rgba(220, 38, 38, 0.1);">
                                                        <span style="color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Company Name</span>
                                                    </td>
                                                    <td style="padding: 12px 0; text-align: right; border-bottom: 1px solid rgba(220, 38, 38, 0.1);">
                                                        <span style="color: #1e293b; font-size: 15px; font-weight: 700;">${invoice.companyName}</span>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 12px 0; border-bottom: 1px solid rgba(220, 38, 38, 0.1);">
                                                        <span style="color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Original Due Date</span>
                                                    </td>
                                                    <td style="padding: 12px 0; text-align: right; border-bottom: 1px solid rgba(220, 38, 38, 0.1);">
                                                        <span style="color: #dc2626; font-size: 15px; font-weight: 700;">${invoice.dueDate}</span>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 12px 0; border-bottom: 2px solid rgba(220, 38, 38, 0.3);">
                                                        <span style="color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Days Overdue</span>
                                                    </td>
                                                    <td style="padding: 12px 0; text-align: right; border-bottom: 2px solid rgba(220, 38, 38, 0.3);">
                                                        <span style="color: #dc2626; font-size: 18px; font-weight: 700;">${daysOverdue} Day${daysOverdue > 1 ? 's' : ''}</span>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 20px 0 10px 0;">
                                                        <span style="color: #1e293b; font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Outstanding Amount</span>
                                                    </td>
                                                    <td style="padding: 20px 0 10px 0; text-align: right;">
                                                        <span style="color: #dc2626; font-size: 32px; font-weight: 800;">₹${invoice.balance_due?.toLocaleString('en-IN')}</span>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                                
                                ${invoice.description ? `
                                <!-- Service Description -->
                                <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
                                    <tr>
                                        <td style="padding: 20px; background-color: #fef2f2; border-radius: 10px; border-left: 4px solid #dc2626;">
                                            <p style="color: #64748b; margin: 0 0 8px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Service Description</p>
                                            <p style="color: #1e293b; margin: 0; font-size: 14px; line-height: 1.6;">${invoice.description}</p>
                                        </td>
                                    </tr>
                                </table>
                                ` : ''}
                                
                                ${invoice.bankAccountNo ? `
                                <!-- Enhanced Payment Information -->
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(to bottom, #ffffff, #fef2f2); border: 2px solid #fca5a5; border-radius: 16px; margin-bottom: 36px; overflow: hidden; box-shadow: 0 2px 8px rgba(220, 38, 38, 0.15);">
                                    <tr>
                                        <td style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 18px 28px;">
                                            <h4 style="margin: 0; color: #ffffff; font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">💳 PAYMENT DETAILS - URGENT</h4>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 28px;">
                                            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                                ${invoice.bankAccountName ? `
                                                <tr>
                                                    <td style="padding: 12px 0; color: #64748b; font-size: 14px; font-weight: 600;">Beneficiary Name</td>
                                                    <td style="padding: 12px 0; color: #0f172a; font-size: 15px; font-weight: 700; text-align: right;">${invoice.bankAccountName}</td>
                                                </tr>
                                                <tr style="border-top: 1px dashed #fca5a5;">` : '<tr>'}
                                                    <td style="padding: 12px 0; color: #64748b; font-size: 14px; font-weight: 600;">Account Number</td>
                                                    <td style="padding: 12px 0; color: #dc2626; font-size: 16px; font-weight: 800; text-align: right; font-family: 'Courier New', monospace; letter-spacing: 1px; background-color: #fee2e2; padding: 8px 12px; border-radius: 6px;">${invoice.bankAccountNo}</td>
                                                </tr>
                                                ${invoice.bankIFSC ? `
                                                <tr style="border-top: 1px dashed #fca5a5;">
                                                    <td style="padding: 12px 0; color: #64748b; font-size: 14px; font-weight: 600;">IFSC Code</td>
                                                    <td style="padding: 12px 0; color: #dc2626; font-size: 16px; font-weight: 800; text-align: right; font-family: 'Courier New', monospace; letter-spacing: 1px;">${invoice.bankIFSC}</td>
                                                </tr>` : ''}
                                                ${invoice.bankName ? `
                                                <tr style="border-top: 1px dashed #fca5a5;">
                                                    <td style="padding: 12px 0; color: #64748b; font-size: 14px; font-weight: 600;">Bank Name</td>
                                                    <td style="padding: 12px 0; color: #0f172a; font-size: 15px; font-weight: 700; text-align: right;">${invoice.bankName}</td>
                                                </tr>` : ''}
                                                ${invoice.bankBranch ? `
                                                <tr style="border-top: 1px dashed #fca5a5;">
                                                    <td style="padding: 12px 0; color: #64748b; font-size: 14px; font-weight: 600;">Branch</td>
                                                    <td style="padding: 12px 0; color: #0f172a; font-size: 14px; font-weight: 600; text-align: right;">${invoice.bankBranch}</td>
                                                </tr>` : ''}
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                                ` : ''}
                                
                                <!-- Action Button -->
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 32px;">
                                    <tr>
                                        <td align="center" style="padding: 20px 0;">
                                            <table cellpadding="0" cellspacing="0" border="0">
                                                <tr>
                                                    <td style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 16px 48px; border-radius: 50px; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4);">
                                                        <a href="mailto:accounts@yourcompany.com?subject=Overdue%20Payment%20for%20Invoice%20${invoice.invoiceNumber}" style="color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">
                                                            ⚡ URGENT - Pay Now
                                                        </a>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                                
                                <!-- Urgent Notice -->
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(to right, #fee2e2, #fecaca); border-radius: 12px; border-left: 5px solid #dc2626; margin-bottom: 36px;">
                                    <tr>
                                        <td style="padding: 22px 26px;">
                                            <table cellpadding="0" cellspacing="0" border="0">
                                                <tr>
                                                    <td style="padding-right: 12px; vertical-align: top;">
                                                        <span style="font-size: 24px;">⚠️</span>
                                                    </td>
                                                    <td>
                                                        <p style="margin: 0; color: #7f1d1d; font-size: 15px; font-weight: 700; line-height: 1.7;">
                                                            <strong>URGENT NOTICE:</strong> Please settle this payment immediately to avoid late payment charges, service interruption, or collection action. Contact us if you need to arrange a payment plan.
                                                        </p>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                                
                                <p style="margin: 0 0 28px 0; color: #64748b; font-size: 14px; line-height: 1.8;">
                                    If you have any issues or need to discuss payment arrangements, please contact our accounts receivable team immediately. We're here to work with you to resolve this matter.
                                </p>
                                
                                <!-- Payment Instructions Images -->
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(to bottom, #fef2f2, #ffffff); border: 2px solid #fca5a5; border-radius: 16px; margin-bottom: 36px; overflow: hidden; box-shadow: 0 2px 8px rgba(220, 38, 38, 0.15);">
                                    <tr>
                                        <td style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 18px 28px;">
                                            <h4 style="margin: 0; color: #ffffff; font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">📋 PAYMENT INSTRUCTIONS</h4>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 28px; text-align: center;">
                                            <p style="margin: 0 0 20px 0; color: #7f1d1d; font-size: 14px; font-weight: 700;">Please refer to the following payment guide for immediate action:</p>
                                            
                                            <!-- Image 1 -->
                                            <div style="margin-bottom: 20px;">
                                                <img src="https://i.postimg.cc/rszYzVtC/Picture1.png" alt="Payment Instructions - Part 1" style="max-width: 100%; height: auto; border-radius: 12px; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.2); border: 2px solid #fca5a5;" />
                                            </div>
                                            
                                            <!-- Image 2 -->
                                            <div style="margin-bottom: 10px;">
                                                <img src="https://i.postimg.cc/m2nqKHFM/Picture2.png" alt="Payment Instructions - Part 2" style="max-width: 100%; height: auto; border-radius: 12px; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.2); border: 2px solid #fca5a5;" />
                                            </div>
                                            
                                            <p style="margin: 20px 0 0 0; color: #991b1b; font-size: 12px; font-weight: 600; font-style: italic;">⚠️ Please follow the above guidelines urgently to avoid further delays</p>
                                        </td>
                                    </tr>
                                </table>
                                
                                <!-- Professional Signature -->
                                <div style="margin-top: 44px; padding-top: 28px; border-top: 2px solid #e2e8f0;">
                                    <p style="margin: 0 0 10px 0; color: #0f172a; font-size: 15px; font-weight: 600;">Urgently,</p>
                                    <p style="margin: 0 0 4px 0; color: #dc2626; font-size: 18px; font-weight: 800;">Accounts Receivable Department</p>
                                    <p style="margin: 0 0 2px 0; color: #991b1b; font-size: 16px; font-weight: 700;">Finance Portal</p>
                                    <p style="margin: 8px 0 0 0; color: #64748b; font-size: 13px; font-weight: 500;">Immediate Action Required</p>
                                </div>
                            </td>
                        </tr>
                        
                        <!-- Enhanced Professional Footer -->
                        <tr>
                            <td style="background: linear-gradient(135deg, #7f1d1d 0%, #991b1b 50%, #b91c1c 100%); padding: 0;">
                                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                    <tr>
                                        <td style="padding: 36px 50px; text-align: center;">
                                            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                                <tr>
                                                    <td align="center" style="padding-bottom: 20px;">
                                                        <h3 style="margin: 0 0 8px 0; color: #ffffff; font-size: 20px; font-weight: 700;">Finance Portal</h3>
                                                        <p style="margin: 0; color: #fca5a5; font-size: 13px; font-weight: 500;">Professional Accounts Receivable Management</p>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 20px 0; border-top: 1px solid rgba(252, 165, 165, 0.2); border-bottom: 1px solid rgba(252, 165, 165, 0.2);">
                                                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                                            <tr>
                                                                <td align="center" style="padding: 4px 0;">
                                                                    <p style="margin: 0; color: #fecaca; font-size: 13px; font-weight: 500;">
                                                                        📧 <a href="mailto:accounts@yourcompany.com" style="color: #fef2f2; text-decoration: none; font-weight: 600;">accounts@yourcompany.com</a>
                                                                    </p>
                                                                </td>
                                                            </tr>
                                                            <tr>
                                                                <td align="center" style="padding: 4px 0;">
                                                                    <p style="margin: 0; color: #fecaca; font-size: 13px; font-weight: 500;">
                                                                        📞 +91 XXXX XXXXXX | 🌐 www.yourcompany.com
                                                                    </p>
                                                                </td>
                                                            </tr>
                                                        </table>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td align="center" style="padding-top: 20px;">
                                                        <p style="margin: 0 0 8px 0; color: #fca5a5; font-size: 12px; line-height: 1.6;">
                                                            This is an automated overdue payment notification sent by Finance Portal.<br>
                                                            Please do not reply directly to this email. Contact us immediately to resolve this matter.
                                                        </p>
                                                        <p style="margin: 0; color: #dc2626; font-size: 11px; font-weight: 500; background-color: #fee2e2; padding: 8px 12px; border-radius: 6px; display: inline-block;">
                                                            © ${new Date().getFullYear()} Finance Portal. All Rights Reserved.
                                                        </p>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
`;
};

// Template for PAID invoices (Thank you confirmation)
const getPaidTemplate = (invoice, recipientInfo) => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Received - Thank You</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc;">
            <tr>
                <td align="center" style="padding: 40px 20px;">
                    <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); overflow: hidden;">
                        <!-- Header with Green Gradient -->
                        <tr>
                            <td style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 40px 30px; text-align: center;">
                                <div style="background-color: rgba(255,255,255,0.2); display: inline-block; padding: 10px 20px; border-radius: 50px; margin-bottom: 15px;">
                                    <span style="color: #ffffff; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px;">✓ Payment Received</span>
                                </div>
                                <h1 style="color: #ffffff; margin: 15px 0 10px 0; font-size: 32px; font-weight: 700; line-height: 1.2;">Thank You!</h1>
                                <p style="color: rgba(255,255,255,0.95); margin: 0; font-size: 16px; font-weight: 600;">Payment Confirmation</p>
                            </td>
                        </tr>
                        
                        <!-- Main Content -->
                        <tr>
                            <td style="padding: 40px 35px;">
                                <p style="color: #1e293b; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">
                                    Dear Team at <strong style="color: #059669;">${invoice.companyName}</strong>,
                                </p>
                                
                                <p style="color: #475569; margin: 0 0 30px 0; font-size: 15px; line-height: 1.7;">
                                    Thank you for your payment! We have received the full payment for the following invoice. We appreciate your prompt payment and continued business.
                                </p>
                                
                                <!-- Invoice Details Card -->
                                <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 30px; background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); border-radius: 12px; overflow: hidden; border: 2px solid #6ee7b7;">
                                    <tr>
                                        <td style="padding: 25px;">
                                            <table role="presentation" style="width: 100%; border-collapse: collapse;">
                                                <tr>
                                                    <td style="padding: 12px 0; border-bottom: 1px solid rgba(5, 150, 105, 0.1);">
                                                        <span style="color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Invoice Number</span>
                                                    </td>
                                                    <td style="padding: 12px 0; text-align: right; border-bottom: 1px solid rgba(5, 150, 105, 0.1);">
                                                        <span style="color: #1e293b; font-size: 15px; font-weight: 700;">${invoice.invoiceNumber}</span>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 12px 0; border-bottom: 1px solid rgba(5, 150, 105, 0.1);">
                                                        <span style="color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Company Name</span>
                                                    </td>
                                                    <td style="padding: 12px 0; text-align: right; border-bottom: 1px solid rgba(5, 150, 105, 0.1);">
                                                        <span style="color: #1e293b; font-size: 15px; font-weight: 700;">${invoice.companyName}</span>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 12px 0; border-bottom: 1px solid rgba(5, 150, 105, 0.1);">
                                                        <span style="color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Invoice Date</span>
                                                    </td>
                                                    <td style="padding: 12px 0; text-align: right; border-bottom: 1px solid rgba(5, 150, 105, 0.1);">
                                                        <span style="color: #1e293b; font-size: 15px; font-weight: 700;">${new Date(invoice.invoiceDate).toLocaleDateString('en-IN', {day: '2-digit', month: 'short', year: 'numeric'})}</span>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 12px 0; border-bottom: 2px solid rgba(5, 150, 105, 0.3);">
                                                        <span style="color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Payment Status</span>
                                                    </td>
                                                    <td style="padding: 12px 0; text-align: right; border-bottom: 2px solid rgba(5, 150, 105, 0.3);">
                                                        <span style="color: #059669; font-size: 15px; font-weight: 700;">✓ PAID</span>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 20px 0 10px 0;">
                                                        <span style="color: #1e293b; font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Amount Paid</span>
                                                    </td>
                                                    <td style="padding: 20px 0 10px 0; text-align: right;">
                                                        <span style="color: #059669; font-size: 32px; font-weight: 800;">₹${invoice.total_Amount?.toLocaleString('en-IN')}</span>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                                
                                ${invoice.description ? `
                                <!-- Service Description -->
                                <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
                                    <tr>
                                        <td style="padding: 20px; background-color: #f0fdf4; border-radius: 10px; border-left: 4px solid #059669;">
                                            <p style="color: #64748b; margin: 0 0 8px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Service Description</p>
                                            <p style="color: #1e293b; margin: 0; font-size: 14px; line-height: 1.6;">${invoice.description}</p>
                                        </td>
                                    </tr>
                                </table>
                                ` : ''}
                                
                                <!-- Success Notice -->
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(to right, #d1fae5, #a7f3d0); border-radius: 12px; border-left: 5px solid #059669; margin-bottom: 36px;">
                                    <tr>
                                        <td style="padding: 22px 26px;">
                                            <table cellpadding="0" cellspacing="0" border="0">
                                                <tr>
                                                    <td style="padding-right: 12px; vertical-align: top;">
                                                        <span style="font-size: 24px;">✅</span>
                                                    </td>
                                                    <td>
                                                        <p style="margin: 0; color: #065f46; font-size: 15px; font-weight: 700; line-height: 1.7;">
                                                            <strong>PAYMENT CONFIRMED:</strong> This invoice has been marked as fully paid in our system. Thank you for your prompt payment and continued partnership!
                                                        </p>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                                
                                <p style="margin: 0 0 28px 0; color: #64748b; font-size: 14px; line-height: 1.8;">
                                    We truly appreciate your business and look forward to serving you again. If you have any questions about this transaction or need a receipt, please feel free to contact us.
                                </p>
                                
                                <!-- Payment Instructions Images -->
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(to bottom, #f0fdf4, #ffffff); border: 2px solid #6ee7b7; border-radius: 16px; margin-bottom: 36px; overflow: hidden; box-shadow: 0 2px 8px rgba(5, 150, 105, 0.15);">
                                    <tr>
                                        <td style="background: linear-gradient(135deg, #059669 0%, #047857 100%); padding: 18px 28px;">
                                            <h4 style="margin: 0; color: #ffffff; font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">📋 PAYMENT REFERENCE GUIDE</h4>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 28px; text-align: center;">
                                            <p style="margin: 0 0 20px 0; color: #065f46; font-size: 14px; font-weight: 600;">For your records, here is our payment guide:</p>
                                            
                                            <!-- Image 1 -->
                                            <div style="margin-bottom: 20px;">
                                                <img src="https://i.postimg.cc/rszYzVtC/Picture1.png" alt="Payment Instructions - Part 1" style="max-width: 100%; height: auto; border-radius: 12px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.2); border: 2px solid #6ee7b7;" />
                                            </div>
                                            
                                            <!-- Image 2 -->
                                            <div style="margin-bottom: 10px;">
                                                <img src="https://i.postimg.cc/m2nqKHFM/Picture2.png" alt="Payment Instructions - Part 2" style="max-width: 100%; height: auto; border-radius: 12px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.2); border: 2px solid #6ee7b7;" />
                                            </div>
                                            
                                            <p style="margin: 20px 0 0 0; color: #047857; font-size: 12px; font-weight: 600; font-style: italic;">✅ Thank you for following our payment procedures!</p>
                                        </td>
                                    </tr>
                                </table>
                                
                                <!-- Professional Signature -->
                                <div style="margin-top: 44px; padding-top: 28px; border-top: 2px solid #e2e8f0;">
                                    <p style="margin: 0 0 10px 0; color: #0f172a; font-size: 15px; font-weight: 600;">With gratitude,</p>
                                    <p style="margin: 0 0 4px 0; color: #059669; font-size: 18px; font-weight: 800;">Accounts Receivable Department</p>
                                    <p style="margin: 0 0 2px 0; color: #047857; font-size: 16px; font-weight: 700;">Finance Portal</p>
                                    <p style="margin: 8px 0 0 0; color: #64748b; font-size: 13px; font-weight: 500;">Thank You for Your Business</p>
                                </div>
                            </td>
                        </tr>
                        
                        <!-- Enhanced Professional Footer -->
                        <tr>
                            <td style="background: linear-gradient(135deg, #065f46 0%, #047857 50%, #059669 100%); padding: 0;">
                                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                    <tr>
                                        <td style="padding: 36px 50px; text-align: center;">
                                            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                                <tr>
                                                    <td align="center" style="padding-bottom: 20px;">
                                                        <h3 style="margin: 0 0 8px 0; color: #ffffff; font-size: 20px; font-weight: 700;">Finance Portal</h3>
                                                        <p style="margin: 0; color: #6ee7b7; font-size: 13px; font-weight: 500;">Professional Accounts Receivable Management</p>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 20px 0; border-top: 1px solid rgba(110, 231, 183, 0.2); border-bottom: 1px solid rgba(110, 231, 183, 0.2);">
                                                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                                            <tr>
                                                                <td align="center" style="padding: 4px 0;">
                                                                    <p style="margin: 0; color: #a7f3d0; font-size: 13px; font-weight: 500;">
                                                                        📧 <a href="mailto:accounts@yourcompany.com" style="color: #d1fae5; text-decoration: none; font-weight: 600;">accounts@yourcompany.com</a>
                                                                    </p>
                                                                </td>
                                                            </tr>
                                                            <tr>
                                                                <td align="center" style="padding: 4px 0;">
                                                                    <p style="margin: 0; color: #a7f3d0; font-size: 13px; font-weight: 500;">
                                                                        📞 +91 XXXX XXXXXX | 🌐 www.yourcompany.com
                                                                    </p>
                                                                </td>
                                                            </tr>
                                                        </table>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td align="center" style="padding-top: 20px;">
                                                        <p style="margin: 0 0 8px 0; color: #6ee7b7; font-size: 12px; line-height: 1.6;">
                                                            This is an automated payment confirmation sent by Finance Portal.<br>
                                                            Please do not reply directly to this email.
                                                        </p>
                                                        <p style="margin: 0; color: #059669; font-size: 11px; font-weight: 500; background-color: #d1fae5; padding: 8px 12px; border-radius: 6px; display: inline-block;">
                                                            © ${new Date().getFullYear()} Finance Portal. All Rights Reserved.
                                                        </p>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
`;

// Template for PARTIALLY PAID invoices
const getPartiallyPaidTemplate = (invoice, recipientInfo) => {
    const paidAmount = (invoice.total_Amount || 0) - (invoice.balance_due || 0);
    const percentPaid = ((paidAmount / (invoice.total_Amount || 1)) * 100).toFixed(0);
    
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Partial Payment Received - Balance Due</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8fafc;">
            <tr>
                <td align="center" style="padding: 40px 20px;">
                    <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.08); overflow: hidden;">
                        <!-- Header with Orange Gradient -->
                        <tr>
                            <td style="background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%); padding: 40px 30px; text-align: center;">
                                <div style="background-color: rgba(255,255,255,0.2); display: inline-block; padding: 10px 20px; border-radius: 50px; margin-bottom: 15px;">
                                    <span style="color: #ffffff; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px;">⏳ Partial Payment Received</span>
                                </div>
                                <h1 style="color: #ffffff; margin: 15px 0 10px 0; font-size: 32px; font-weight: 700; line-height: 1.2;">Payment Update</h1>
                                <p style="color: rgba(255,255,255,0.95); margin: 0; font-size: 16px; font-weight: 600;">Remaining Balance Pending</p>
                            </td>
                        </tr>
                        
                        <!-- Main Content -->
                        <tr>
                            <td style="padding: 40px 35px;">
                                <p style="color: #1e293b; margin: 0 0 20px 0; font-size: 16px; line-height: 1.6;">
                                    Dear Team at <strong style="color: #ea580c;">${invoice.companyName}</strong>,
                                </p>
                                
                                <p style="color: #475569; margin: 0 0 30px 0; font-size: 15px; line-height: 1.7;">
                                    Thank you for your recent payment of <strong style="color: #ea580c;">₹${paidAmount.toLocaleString('en-IN')}</strong>! This is a reminder that there is still a remaining balance of <strong style="color: #ea580c;">₹${invoice.balance_due?.toLocaleString('en-IN')}</strong> outstanding on this invoice.
                                </p>
                                
                                <!-- Invoice Details Card with Progress -->
                                <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 30px; background: linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%); border-radius: 12px; overflow: hidden; border: 2px solid #fdba74;">
                                    <tr>
                                        <td style="padding: 25px;">
                                            <table role="presentation" style="width: 100%; border-collapse: collapse;">
                                                <tr>
                                                    <td style="padding: 12px 0; border-bottom: 1px solid rgba(234, 88, 12, 0.1);">
                                                        <span style="color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Invoice Number</span>
                                                    </td>
                                                    <td style="padding: 12px 0; text-align: right; border-bottom: 1px solid rgba(234, 88, 12, 0.1);">
                                                        <span style="color: #1e293b; font-size: 15px; font-weight: 700;">${invoice.invoiceNumber}</span>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 12px 0; border-bottom: 1px solid rgba(234, 88, 12, 0.1);">
                                                        <span style="color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Company Name</span>
                                                    </td>
                                                    <td style="padding: 12px 0; text-align: right; border-bottom: 1px solid rgba(234, 88, 12, 0.1);">
                                                        <span style="color: #1e293b; font-size: 15px; font-weight: 700;">${invoice.companyName}</span>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 12px 0; border-bottom: 1px solid rgba(234, 88, 12, 0.1);">
                                                        <span style="color: #64748b; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Total Invoice Amount</span>
                                                    </td>
                                                    <td style="padding: 12px 0; text-align: right; border-bottom: 1px solid rgba(234, 88, 12, 0.1);">
                                                        <span style="color: #1e293b; font-size: 15px; font-weight: 600;">₹${invoice.total_Amount?.toLocaleString('en-IN')}</span>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 12px 0; border-bottom: 2px solid rgba(234, 88, 12, 0.3);">
                                                        <span style="color: #059669; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Amount Paid</span>
                                                    </td>
                                                    <td style="padding: 12px 0; text-align: right; border-bottom: 2px solid rgba(234, 88, 12, 0.3);">
                                                        <span style="color: #059669; font-size: 15px; font-weight: 700;">₹${paidAmount.toLocaleString('en-IN')} (${percentPaid}%)</span>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 20px 0 10px 0;">
                                                        <span style="color: #1e293b; font-size: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Remaining Balance</span>
                                                    </td>
                                                    <td style="padding: 20px 0 10px 0; text-align: right;">
                                                        <span style="color: #ea580c; font-size: 32px; font-weight: 800;">₹${invoice.balance_due?.toLocaleString('en-IN')}</span>
                                                    </td>
                                                </tr>
                                            </table>
                                            
                                            <!-- Payment Progress Bar -->
                                            <table role="presentation" style="width: 100%; border-collapse: collapse; margin-top: 25px; background-color: #ffffff; border-radius: 8px; padding: 15px;">
                                                <tr>
                                                    <td>
                                                        <table role="presentation" style="width: 100%; border-collapse: collapse;">
                                                            <tr>
                                                                <td style="padding-bottom: 10px;">
                                                                    <span style="color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Payment Progress</span>
                                                                </td>
                                                                <td style="padding-bottom: 10px; text-align: right;">
                                                                    <span style="color: #ea580c; font-size: 14px; font-weight: 800;">${percentPaid}%</span>
                                                                </td>
                                                            </tr>
                                                        </table>
                                                        <table role="presentation" style="width: 100%; height: 12px; border-collapse: collapse; background-color: #fef3c7; border-radius: 6px; overflow: hidden;">
                                                            <tr>
                                                                <td style="width: ${percentPaid}%; background: linear-gradient(90deg, #ea580c 0%, #fb923c 100%); border-radius: 6px;"></td>
                                                                <td style="width: ${100 - percentPaid}%;"></td>
                                                            </tr>
                                                        </table>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                                
                                ${invoice.description ? `
                                <!-- Service Description -->
                                <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
                                    <tr>
                                        <td style="padding: 20px; background-color: #fef9f3; border-radius: 10px; border-left: 4px solid #ea580c;">
                                            <p style="color: #64748b; margin: 0 0 8px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Service Description</p>
                                            <p style="color: #1e293b; margin: 0; font-size: 14px; line-height: 1.6;">${invoice.description}</p>
                                        </td>
                                    </tr>
                                </table>
                                ` : ''}
                                
                                ${invoice.bankAccountNo ? `
                                <!-- Enhanced Payment Information -->\n                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(to bottom, #ffffff, #fffbeb); border: 2px solid #fdba74; border-radius: 16px; margin-bottom: 36px; overflow: hidden; box-shadow: 0 2px 8px rgba(234, 88, 12, 0.15);">
                                    <tr>
                                        <td style="background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%); padding: 18px 28px;">
                                            <h4 style="margin: 0; color: #ffffff; font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">💳 PAYMENT DETAILS - REMAINING BALANCE</h4>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 28px;">
                                            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                                ${invoice.bankAccountName ? `
                                                <tr>
                                                    <td style="padding: 12px 0; color: #64748b; font-size: 14px; font-weight: 600;">Beneficiary Name</td>
                                                    <td style="padding: 12px 0; color: #0f172a; font-size: 15px; font-weight: 700; text-align: right;">${invoice.bankAccountName}</td>
                                                </tr>
                                                <tr style="border-top: 1px dashed #fdba74;">` : '<tr>'}
                                                    <td style="padding: 12px 0; color: #64748b; font-size: 14px; font-weight: 600;">Account Number</td>
                                                    <td style="padding: 12px 0; color: #ea580c; font-size: 16px; font-weight: 800; text-align: right; font-family: 'Courier New', monospace; letter-spacing: 1px; background-color: #ffedd5; padding: 8px 12px; border-radius: 6px;">${invoice.bankAccountNo}</td>
                                                </tr>
                                                ${invoice.bankIFSC ? `
                                                <tr style="border-top: 1px dashed #fdba74;">
                                                    <td style="padding: 12px 0; color: #64748b; font-size: 14px; font-weight: 600;">IFSC Code</td>
                                                    <td style="padding: 12px 0; color: #ea580c; font-size: 16px; font-weight: 800; text-align: right; font-family: 'Courier New', monospace; letter-spacing: 1px;">${invoice.bankIFSC}</td>
                                                </tr>` : ''}
                                                ${invoice.bankName ? `
                                                <tr style="border-top: 1px dashed #fdba74;">
                                                    <td style="padding: 12px 0; color: #64748b; font-size: 14px; font-weight: 600;">Bank Name</td>
                                                    <td style="padding: 12px 0; color: #0f172a; font-size: 15px; font-weight: 700; text-align: right;">${invoice.bankName}</td>
                                                </tr>` : ''}
                                                ${invoice.bankBranch ? `
                                                <tr style="border-top: 1px dashed #fdba74;">
                                                    <td style="padding: 12px 0; color: #64748b; font-size: 14px; font-weight: 600;">Branch</td>
                                                    <td style="padding: 12px 0; color: #0f172a; font-size: 14px; font-weight: 600; text-align: right;">${invoice.bankBranch}</td>
                                                </tr>` : ''}
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                                ` : ''}
                                
                                <!-- Action Button -->
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 32px;">
                                    <tr>
                                        <td align="center" style="padding: 20px 0;">
                                            <table cellpadding="0" cellspacing="0" border="0">
                                                <tr>
                                                    <td style="background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%); padding: 16px 48px; border-radius: 50px; box-shadow: 0 4px 12px rgba(234, 88, 12, 0.3);">
                                                        <a href="mailto:accounts@yourcompany.com?subject=Balance%20Payment%20for%20Invoice%20${invoice.invoiceNumber}" style="color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">
                                                            💰 Complete Payment
                                                        </a>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                                
                                <!-- Reminder Notice -->
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(to right, #fef3c7, #fde68a); border-radius: 12px; border-left: 5px solid #f59e0b; margin-bottom: 36px;">
                                    <tr>
                                        <td style="padding: 22px 26px;">
                                            <table cellpadding="0" cellspacing="0" border="0">
                                                <tr>
                                                    <td style="padding-right: 12px; vertical-align: top;">
                                                        <span style="font-size: 24px;">⏳</span>
                                                    </td>
                                                    <td>
                                                        <p style="margin: 0; color: #92400e; font-size: 15px; font-weight: 700; line-height: 1.7;">
                                                            <strong>PAYMENT REMINDER:</strong> Please complete the remaining balance of <strong style="color: #ea580c;">₹${invoice.balance_due?.toLocaleString('en-IN')}</strong> at your earliest convenience to close this invoice.
                                                        </p>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                                
                                <p style="margin: 0 0 28px 0; color: #64748b; font-size: 14px; line-height: 1.8;">
                                    We sincerely appreciate your partial payment. If you have any questions or need assistance completing the payment, please don't hesitate to contact our accounts receivable team.
                                </p>
                                
                                <!-- Payment Instructions Images -->
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: linear-gradient(to bottom, #fffbeb, #ffffff); border: 2px solid #fdba74; border-radius: 16px; margin-bottom: 36px; overflow: hidden; box-shadow: 0 2px 8px rgba(234, 88, 12, 0.15);">
                                    <tr>
                                        <td style="background: linear-gradient(135deg, #ea580c 0%, #c2410c 100%); padding: 18px 28px;">
                                            <h4 style="margin: 0; color: #ffffff; font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">📋 PAYMENT INSTRUCTIONS</h4>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 28px; text-align: center;">
                                            <p style="margin: 0 0 20px 0; color: #92400e; font-size: 14px; font-weight: 600;">Please refer to the following payment guide for remaining balance:</p>
                                            
                                            <!-- Image 1 -->
                                            <div style="margin-bottom: 20px;">
                                                <img src="https://i.postimg.cc/rszYzVtC/Picture1.png" alt="Payment Instructions - Part 1" style="max-width: 100%; height: auto; border-radius: 12px; box-shadow: 0 4px 12px rgba(234, 88, 12, 0.2); border: 2px solid #fdba74;" />
                                            </div>
                                            
                                            <!-- Image 2 -->
                                            <div style="margin-bottom: 10px;">
                                                <img src="https://i.postimg.cc/m2nqKHFM/Picture2.png" alt="Payment Instructions - Part 2" style="max-width: 100%; height: auto; border-radius: 12px; box-shadow: 0 4px 12px rgba(234, 88, 12, 0.2); border: 2px solid #fdba74;" />
                                            </div>
                                            
                                            <p style="margin: 20px 0 0 0; color: #c2410c; font-size: 12px; font-weight: 600; font-style: italic;">Thank you for following the payment guidelines</p>
                                        </td>
                                    </tr>
                                </table>
                                
                                <!-- Professional Signature -->
                                <div style="margin-top: 44px; padding-top: 28px; border-top: 2px solid #e2e8f0;">
                                    <p style="margin: 0 0 10px 0; color: #0f172a; font-size: 15px; font-weight: 600;">Kind regards,</p>
                                    <p style="margin: 0 0 4px 0; color: #ea580c; font-size: 18px; font-weight: 800;">Accounts Receivable Department</p>
                                    <p style="margin: 0 0 2px 0; color: #c2410c; font-size: 16px; font-weight: 700;">Finance Portal</p>
                                    <p style="margin: 8px 0 0 0; color: #64748b; font-size: 13px; font-weight: 500;">Thank You for Your Partnership</p>
                                </div>
                            </td>
                        </tr>
                        
                        <!-- Enhanced Professional Footer -->
                        <tr>
                            <td style="background: linear-gradient(135deg, #92400e 0%, #b45309 50%, #ea580c 100%); padding: 0;">
                                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                    <tr>
                                        <td style="padding: 36px 50px; text-align: center;">
                                            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                                <tr>
                                                    <td align="center" style="padding-bottom: 20px;">
                                                        <h3 style="margin: 0 0 8px 0; color: #ffffff; font-size: 20px; font-weight: 700;">Finance Portal</h3>
                                                        <p style="margin: 0; color: #fdba74; font-size: 13px; font-weight: 500;">Professional Accounts Receivable Management</p>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 20px 0; border-top: 1px solid rgba(253, 186, 116, 0.2); border-bottom: 1px solid rgba(253, 186, 116, 0.2);">
                                                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                                            <tr>
                                                                <td align="center" style="padding: 4px 0;">
                                                                    <p style="margin: 0; color: #fed7aa; font-size: 13px; font-weight: 500;">
                                                                        📧 <a href="mailto:accounts@yourcompany.com" style="color: #ffedd5; text-decoration: none; font-weight: 600;">accounts@yourcompany.com</a>
                                                                    </p>
                                                                </td>
                                                            </tr>
                                                            <tr>
                                                                <td align="center" style="padding: 4px 0;">
                                                                    <p style="margin: 0; color: #fed7aa; font-size: 13px; font-weight: 500;">
                                                                        📞 +91 XXXX XXXXXX | 🌐 www.yourcompany.com
                                                                    </p>
                                                                </td>
                                                            </tr>
                                                        </table>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td align="center" style="padding-top: 20px;">
                                                        <p style="margin: 0 0 8px 0; color: #fdba74; font-size: 12px; line-height: 1.6;">
                                                            This is an automated partial payment reminder sent by Finance Portal.<br>
                                                            Please do not reply directly to this email.
                                                        </p>
                                                        <p style="margin: 0; color: #ea580c; font-size: 11px; font-weight: 500; background-color: #ffedd5; padding: 8px 12px; border-radius: 6px; display: inline-block;">
                                                            © ${new Date().getFullYear()} Finance Portal. All Rights Reserved.
                                                        </p>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
`;
};

// Smart email sender with CC fallback - Universal function for all email types
export const sendSmartEmail = async (to, ccEmails = [], subject, htmlContent) => {
    try {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`📧 SMART EMAIL SENDER`);
        console.log(`${'='.repeat(80)}`);
        console.log(`To: ${to}`);
        console.log(`CC: ${ccEmails.length > 0 ? ccEmails.join(', ') : 'None'}`);
        console.log(`Subject: ${subject}`);
        console.log(`${'='.repeat(80)}\n`);
        
        // PRIORITIZE GMAIL SMTP - Better deliverability to corporate emails
        console.log('🎯 Trying Gmail SMTP first for better deliverability...');
        const gmailTransporter = getGmailTransporter();
        
        if (gmailTransporter) {
            try {
                const mailOptions = {
                    from: `"${process.env.BREVO_SENDER_NAME || 'AR System'}" <${process.env.EMAIL_USER}>`,
                    to: to,
                    subject: subject,
                    html: htmlContent
                };
                
                // Add CC if provided
                if (ccEmails.length > 0) {
                    mailOptions.cc = ccEmails.join(', ');
                    console.log(`   Adding ${ccEmails.length} CC recipients`);
                }
                
                console.log(`📧 Sending via Gmail SMTP...`);
                const info = await gmailTransporter.sendMail(mailOptions);
                
                console.log('✅ Email sent via Gmail SMTP successfully!');
                console.log(`   Message ID: ${info.messageId}`);
                console.log(`   To: ${to}`);
                console.log(`   CC: ${ccEmails.join(', ') || 'None'}`);
                
                return {
                    success: true,
                    messageId: info.messageId,
                    service: 'Gmail SMTP',
                    ccCount: ccEmails.length,
                    accepted: info.accepted,
                    rejected: info.rejected
                };
            } catch (gmailError) {
                console.error('❌ Gmail SMTP failed:', gmailError.message);
                console.log('⚠️ Falling back to Brevo API...');
            }
        }
        
        // Fallback: Brevo API with CC
        const result = await sendViaBrevoAPI(to, ccEmails, subject, htmlContent);

        if (result && result.success) {
            if (result.needsIndividualSending && ccEmails.length > 0) {
                console.warn('⚠️ CC may not be supported on current Brevo plan. Falling back to individual sends...');
                
                const ccResults = [];
                // Send individually to each CC recipient
                for (let i = 0; i < ccEmails.length; i++) {
                    const cc = ccEmails[i];
                    try {
                        console.log(`   📧 [${i + 1}/${ccEmails.length}] Sending CC to: ${cc} (${getEmailProvider(cc)})`);
                        
                        // Modify subject to indicate this is a CC copy
                        const ccSubject = `[CC] ${subject}`;
                        
                        // Add a note at the top indicating it's a CC
                        const ccTemplate = `
                            <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 16px; margin-bottom: 24px; font-family: Arial, sans-serif;">
                                <p style="margin: 0; font-size: 14px; color: #1e40af;">
                                    <strong>ℹ️ Note:</strong> You are receiving this as a CC recipient. 
                                    Primary recipient: <strong>${to}</strong>
                                </p>
                            </div>
                            ${htmlContent}
                        `;
                        
                        const ccResult = await sendViaBrevoAPI(cc, [], ccSubject, ccTemplate);
                        
                        if (ccResult && ccResult.success) {
                            console.log(`      ✅ Sent successfully (Message ID: ${ccResult.messageId})`);
                            ccResults.push({ email: cc, success: true, messageId: ccResult.messageId });
                        } else {
                            console.error(`      ❌ Failed to send to ${cc}`);
                            ccResults.push({ email: cc, success: false, error: 'Brevo API failed' });
                        }
                        
                        // Small delay between sends to avoid rate limiting
                        if (i < ccEmails.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }
                    } catch (error) {
                        console.error(`      ❌ Error sending to ${cc}:`, error.message);
                        ccResults.push({ email: cc, success: false, error: error.message });
                    }
                }
                
                const successCount = ccResults.filter(r => r.success).length;
                const failedCount = ccResults.filter(r => !r.success).length;
                
                console.log(`\n📊 CC Email Results:`);
                console.log(`   ✅ Successful: ${successCount}/${ccEmails.length}`);
                console.log(`   ❌ Failed: ${failedCount}/${ccEmails.length}`);
                
                return {
                    success: true,
                    messageId: result.messageId,
                    service: 'Brevo API with Individual CC Sending',
                    ccCount: ccEmails.length,
                    ccResults: ccResults,
                    ccSuccessCount: successCount,
                    ccFailedCount: failedCount
                };
            }
            
            console.log('✅ Email sent via Brevo API successfully (standard mode)');
            return { 
                ...result, 
                service: 'Brevo API' 
            };
        }

        // If Brevo API fails entirely, fallback to SMTP
        console.warn('⚠️ Brevo API failed. Trying SMTP fallback...');
        const transporter = getBrevoTransporter() || getGmailTransporter();

        if (!transporter) {
            throw new Error('No available transporter (Brevo/Gmail).');
        }

        const mailOptions = {
            from: process.env.BREVO_SENDER_EMAIL || process.env.EMAIL_USER,
            to,
            subject,
            html: htmlContent
        };
        
        if (ccEmails.length > 0) {
            mailOptions.cc = ccEmails.join(', ');
        }
        
        const smtpResult = await transporter.sendMail(mailOptions);

        console.log('✅ Email sent via SMTP fallback with CC support.');
        console.log(`   Message ID: ${smtpResult.messageId}`);
        console.log(`   Accepted: ${JSON.stringify(smtpResult.accepted)}`);
        console.log(`   Rejected: ${JSON.stringify(smtpResult.rejected)}`);
        
        return { 
            success: true, 
            messageId: smtpResult.messageId,
            service: 'SMTP Fallback', 
            ccCount: ccEmails.length,
            accepted: smtpResult.accepted,
            rejected: smtpResult.rejected
        };
    } catch (error) {
        console.error('❌ sendSmartEmail failed:', error.message);
        return { 
            success: false, 
            error: error.message 
        };
    }
};

// Main email sending function with status-based templates (Using Brevo for all email types)
export const sendInvoiceEmail = async (invoice, recipientInfo) => {
    try {
        const status = getPaymentStatus(invoice);
        
        // Select template based on payment status
        let emailTemplate;
        let emailSubject;
        
        switch (status) {
            case 'Overdue':
                emailTemplate = getOverdueTemplate(invoice, recipientInfo);
                emailSubject = `🚨 URGENT: Invoice ${invoice.invoiceNumber} - Payment Overdue`;
                break;
            case 'Paid':
                emailTemplate = getPaidTemplate(invoice, recipientInfo);
                emailSubject = `✓ Payment Confirmation - Invoice ${invoice.invoiceNumber}`;
                break;
            case 'PartiallyPaid':
                emailTemplate = getPartiallyPaidTemplate(invoice, recipientInfo);
                emailSubject = `Partial Payment Received - Invoice ${invoice.invoiceNumber} - Balance Pending`;
                break;
            case 'Due':
            default:
                emailTemplate = getDueTemplate(invoice, recipientInfo);
                emailSubject = `Payment Reminder - Invoice ${invoice.invoiceNumber}`;
                break;
        }
        
        // Prepare CC emails with robust validation for ALL domains
        const ccEmails = [];
        console.log(`🔍 DEBUG: recipientInfo.ccEmails:`, {
            value: recipientInfo.ccEmails,
            type: typeof recipientInfo.ccEmails,
            isArray: Array.isArray(recipientInfo.ccEmails),
            length: recipientInfo.ccEmails?.length
        });
        
        // Comprehensive email validation regex (supports all domains, subdomains, TLDs)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (recipientInfo.ccEmails && recipientInfo.ccEmails.length > 0) {
            // Clean and validate CC emails - supports ALL domains
            const validCcEmails = recipientInfo.ccEmails
                .map(email => {
                    // Extract email from formats like "Name <email@domain.com>"
                    const trimmed = email.trim();
                    const match = trimmed.match(/<([^>]+)>/) || [null, trimmed];
                    return match[1].trim();
                })
                .filter(email => {
                    const isValid = email && emailRegex.test(email);
                    if (!isValid && email) {
                        console.warn(`⚠️ Invalid email format filtered out: "${email}"`);
                    }
                    return isValid;
                });
            
            if (validCcEmails.length > 0) {
                ccEmails.push(...validCcEmails);
                
                // Log CC recipients with their email providers
                console.log(`📧 ✅ Sending email with CC recipients (ALL DOMAINS SUPPORTED):`);
                console.log(`   Primary TO: ${recipientInfo.email} (${getEmailProvider(recipientInfo.email)})`);
                console.log(`   CC Recipients (${ccEmails.length}):`);
                ccEmails.forEach((email, idx) => {
                    console.log(`      ${idx + 1}. ${email} → ${getEmailProvider(email)}`);
                });
            } else {
                console.log(`⚠️ No valid CC emails found after filtering:`, {
                    original: recipientInfo.ccEmails,
                    filtered: validCcEmails
                });
            }
        } else {
            console.log(`📧 ⚠️ Sending email WITHOUT CC (no CC emails found):`, {
                to: recipientInfo.email,
                ccEmailsValue: recipientInfo.ccEmails
            });
        }
        
        console.log(`📤 Preparing to send invoice email:`, {
            to: recipientInfo.email,
            cc: ccEmails.length > 0 ? ccEmails : 'none',
            subject: emailSubject,
            invoiceNumber: invoice.invoiceNumber,
            status: status
        });
        
        // USE SMART EMAIL SENDER (Gmail SMTP Priority) - This is what works!
        const result = await sendSmartEmail(recipientInfo.email, ccEmails, emailSubject, emailTemplate);
        
        if (result.success) {
            console.log(`✅ Invoice email sent successfully!`);
            console.log(`   Invoice: ${invoice.invoiceNumber}`);
            console.log(`   Service: ${result.service}`);
            console.log(`   Message ID: ${result.messageId}`);
            console.log(`   To: ${recipientInfo.email}`);
            console.log(`   CC: ${ccEmails.join(', ') || 'NONE'}`);
            
            return {
                success: true,
                messageId: result.messageId,
                status,
                sentTo: recipientInfo.email,
                ccSent: ccEmails,
                service: result.service,
                ccCount: ccEmails.length,
                ...result
            };
        }
        
        throw new Error(result.error || 'Failed to send email');
    } catch (error) {
        console.error('❌ Error sending email:', error);
        return { success: false, error: error.message };
    }
};
