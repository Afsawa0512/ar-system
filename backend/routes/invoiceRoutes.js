import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import Invoice from '../models/Invoice.js';
import { getCompanyEmail, sendInvoiceEmail } from '../utils/emailService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Multer storage config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '..', 'uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowed = ['.pdf', '.png', '.jpg', '.jpeg', '.xlsx', '.xls', '.csv'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Unsupported file type'));
        }
    }
});


const router = express.Router();


// GET all invoices (with pagination, search, and filter)
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';
        const status = req.query.status || 'All';

        // Build query
        let query = {};
        const conditions = [];

        if (search) {
            conditions.push({
                $or: [
                    { invoiceNumber: { $regex: search, $options: 'i' } },
                    { companyName: { $regex: search, $options: 'i' } },
                    { sellerName: { $regex: search, $options: 'i' } },
                    { buyerGSTIN: { $regex: search, $options: 'i' } },
                    { subject: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
                ]
            });
        }

        if (status !== 'All') {
            const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

            if (status === 'Overdue') {
                // Overdue = balance_due > 0 AND dueDate < today
                conditions.push({ balance_due: { $gt: 0 } });
                conditions.push({ dueDate: { $lt: todayStr } });
            } else if (status === 'Due') {
                // Due = balance_due > 0 AND dueDate >= today (not yet overdue)
                conditions.push({ balance_due: { $gt: 0 } });
                conditions.push({ dueDate: { $gte: todayStr } });
                conditions.push({ paymentStatus: { $nin: ['Paid', 'PartiallyPaid'] } });
            } else if (status === 'PartiallyPaid') {
                conditions.push({ paymentStatus: 'PartiallyPaid' });
                conditions.push({ balance_due: { $gt: 0 } });
            } else if (status === 'Paid') {
                conditions.push({
                    $or: [
                        { balance_due: { $lte: 0 } },
                        { paymentStatus: 'Paid' }
                    ]
                });
            } else {
                conditions.push({ paymentStatus: status });
            }
        }

        if (conditions.length > 0) {
            query.$and = conditions;
        }

        const invoices = await Invoice.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Invoice.countDocuments(query);

        // Compute status counts for filter tabs (based on search but not status filter)
        const searchConditions = search ? [{
            $or: [
                { invoiceNumber: { $regex: search, $options: 'i' } },
                { companyName: { $regex: search, $options: 'i' } },
                { sellerName: { $regex: search, $options: 'i' } },
                { buyerGSTIN: { $regex: search, $options: 'i' } },
                { subject: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ]
        }] : [];

        const todayForCounts = new Date().toISOString().split('T')[0];

        const buildCountQuery = (...extras) => {
            const all = [...searchConditions, ...extras];
            return all.length > 0 ? { $and: all } : {};
        };

        const [allCount, paidCount, dueCount, overdueCount, partialCount] = await Promise.all([
            Invoice.countDocuments(buildCountQuery()),
            Invoice.countDocuments(buildCountQuery({ $or: [{ balance_due: { $lte: 0 } }, { paymentStatus: 'Paid' }] })),
            Invoice.countDocuments(buildCountQuery({ balance_due: { $gt: 0 } }, { dueDate: { $gte: todayForCounts } }, { paymentStatus: { $nin: ['Paid', 'PartiallyPaid'] } })),
            Invoice.countDocuments(buildCountQuery({ balance_due: { $gt: 0 } }, { dueDate: { $lt: todayForCounts } })),
            Invoice.countDocuments(buildCountQuery({ paymentStatus: 'PartiallyPaid' }, { balance_due: { $gt: 0 } })),
        ]);

        res.json({
            invoices,
            total,
            pages: Math.ceil(total / limit),
            currentPage: page,
            statusCounts: {
                All: allCount,
                Paid: paidCount,
                Due: dueCount,
                Overdue: overdueCount,
                PartiallyPaid: partialCount,
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET financial statistics (Optimized)
router.get('/stats', async (req, res) => {
    try {
        const stats = await Invoice.aggregate([
            {
                $group: {
                    _id: null,
                    totalInvoices: { $sum: 1 },
                    totalAmount: { $sum: "$total_Amount" },
                    balanceDue: { $sum: "$balance_due" },
                    paidCount: {
                        $sum: { $cond: [{ $or: [{ $lte: ["$balance_due", 0] }, { $eq: ["$paymentStatus", "Paid"] }] }, 1, 0] }
                    },
                    paidAmount: {
                        $sum: { $cond: [{ $or: [{ $lte: ["$balance_due", 0] }, { $eq: ["$paymentStatus", "Paid"] }] }, "$total_Amount", 0] }
                    },
                    pendingCount: {
                        $sum: { $cond: [{ $and: [{ $gt: ["$balance_due", 0] }, { $ne: ["$paymentStatus", "Paid"] }] }, 1, 0] }
                    },
                    pendingAmount: {
                        $sum: { $cond: [{ $and: [{ $gt: ["$balance_due", 0] }, { $ne: ["$paymentStatus", "Paid"] }] }, "$balance_due", 0] }
                    }
                }
            }
        ]);

        // Calculate Overdue (Simplified for now - can be refined with date logic)
        const todayStr = new Date().toISOString().split('T')[0];
        const overdue = await Invoice.aggregate([
            {
                $match: {
                    balance_due: { $gt: 0 },
                    dueDate: { $lt: todayStr }
                }
            },
            {
                $group: {
                    _id: null,
                    amount: { $sum: "$balance_due" },
                    count: { $sum: 1 }
                }
            }
        ]);

        const result = stats[0] || { totalInvoices: 0, totalAmount: 0, balanceDue: 0, paidCount: 0, paidAmount: 0, pendingCount: 0, pendingAmount: 0 };
        const overdueResult = overdue[0] || { amount: 0, count: 0 };

        res.json({
            ...result,
            overdueAmount: overdueResult.amount,
            overdueCount: overdueResult.count
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET latest invoice
router.get('/latest', async (req, res) => {
    try {
        const latestInvoice = await Invoice.findOne().sort({ createdAt: -1 });
        res.json(latestInvoice);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET single invoice
router.get('/:id', async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id);
        if (invoice) {
            res.json(invoice);
        } else {
            res.status(404).json({ message: 'Invoice not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST new invoice
router.post('/', async (req, res) => {
    try {
        const invoice = new Invoice(req.body);
        const newInvoice = await invoice.save();

        res.status(201).json(newInvoice);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// PUT update invoice
router.put('/:id', async (req, res) => {
    try {
        const updatedInvoice = await Invoice.findByIdAndUpdate(
            req.params.id,
            req.body,
            { returnDocument: 'after' }
        );

        res.json(updatedInvoice);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// DELETE invoice
router.delete('/:id', async (req, res) => {
    try {
        await Invoice.findByIdAndDelete(req.params.id);



        res.json({ message: 'Invoice deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST upload invoice file
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const file = req.file;
        const b = req.body; // shorthand

        // Use invoice number from frontend or auto-generate
        let invoiceNumber = b.invoiceNumber;
        if (!invoiceNumber) {
            invoiceNumber = '1';
            const latestInvoice = await Invoice.findOne().sort({ createdAt: -1 });
            if (latestInvoice?.invoiceNumber) {
                // Try to parse as number (new format) or extract from INV-XXX (old format)
                const num = parseInt(latestInvoice.invoiceNumber, 10);
                if (!isNaN(num)) {
                    invoiceNumber = (num + 1).toString();
                } else if (latestInvoice.invoiceNumber.includes('-')) {
                    const parts = latestInvoice.invoiceNumber.split('-');
                    invoiceNumber = (parseInt(parts[1], 10) + 1).toString();
                }
            }
        }

        const today = new Date().toISOString().split('T')[0];

        const invoiceData = {
            invoiceNumber,
            invoiceDate: b.invoiceDate || today,
            dueDate: b.dueDate || today,
            Terms: b.Terms || '30',

            // Seller
            sellerName: b.sellerName || '',
            sellerAddress: b.sellerAddress || '',
            sellerGSTIN: b.sellerGSTIN || '',

            // Buyer
            companyName: b.companyName || file.originalname.replace(/\.[^/.]+$/, ''),
            buyerAddress: b.buyerAddress || '',
            buyerGSTIN: b.buyerGSTIN || '',
            State: b.State || '',
            placeOfSupply: b.placeOfSupply || '',

            // Item
            subject: b.subject || '',
            description: b.description || `Uploaded from file: ${file.originalname}`,
            hsnSac: b.hsnSac || '',
            quantity: parseFloat(b.quantity) || 1,
            total_price: parseFloat(b.total_price) || 0,

            // Financials
            subtotal: parseFloat(b.subtotal) || 0,
            GST: parseFloat(b.GST) || 18,
            GST_Amount: parseFloat(b.GST_Amount) || 0,
            total_Amount: parseFloat(b.total_Amount) || 0,
            creditsApplied: parseFloat(b.creditsApplied) || 0,
            balance_due: parseFloat(b.balance_due) || 0,
            totalInWords: b.totalInWords || '',

            // Payment
            paymentStatus: b.paymentStatus || 'Due',

            // Bank
            bankAccountName: b.bankAccountName || '',
            bankAccountNo: b.bankAccountNo || '',
            bankName: b.bankName || '',
            bankAddress: b.bankAddress || '',
            bankIFSC: b.bankIFSC || '',
            bankSWIFT: b.bankSWIFT || '',

            // File
            fileName: file.originalname,
            filePath: file.path
        };

        const invoice = new Invoice(invoiceData);
        const savedInvoice = await invoice.save();

        res.status(201).json({
            message: 'File uploaded successfully',
            invoice: savedInvoice,
            file: {
                originalName: file.originalname,
                size: file.size,
                path: file.path
            }
        });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ message: 'Failed to upload and process file' });
    }
});

// POST extract data from file using Python, then save to DB
router.post('/extract', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const file = req.file;
        const scriptPath = path.join(__dirname, '..', 'utils', 'extract_invoice.py');
        const filePath = path.resolve(file.path);

        // Run Python extraction script
        const extractedData = await new Promise((resolve, reject) => {
            execFile('python', [scriptPath, filePath], { timeout: 30000 }, (error, stdout, stderr) => {
                if (error) {
                    console.error('Python script error:', stderr);
                    reject(new Error(`Extraction failed: ${stderr || error.message}`));
                    return;
                }
                try {
                    const data = JSON.parse(stdout);
                    resolve(data);
                } catch (e) {
                    reject(new Error('Failed to parse extraction output'));
                }
            });
        });

        if (extractedData.error) {
            return res.status(422).json({
                message: extractedData.error,
                rawText: extractedData.rawText || ''
            });
        }

        // Auto-generate invoice number (simple numeric: 1, 2, 3...)
        let invoiceNumber = extractedData.invoiceNumber;
        if (!invoiceNumber) {
            const latestInvoice = await Invoice.findOne().sort({ createdAt: -1 });
            if (latestInvoice?.invoiceNumber) {
                // Try parsing as number (new format) or extract from INV-XXX (old format)
                const num = parseInt(latestInvoice.invoiceNumber, 10);
                if (!isNaN(num)) {
                    invoiceNumber = (num + 1).toString();
                } else if (latestInvoice.invoiceNumber.includes('-')) {
                    invoiceNumber = (parseInt(latestInvoice.invoiceNumber.split('-')[1], 10) + 1).toString();
                } else {
                    invoiceNumber = '1';
                }
            } else {
                invoiceNumber = '1'; // Start from 1 if no invoices exist
            }
        }

        const today = new Date().toISOString().split('T')[0];
        const d = extractedData;

        const invoiceData = {
            invoiceNumber,
            invoiceDate: d.invoiceDate || today,
            dueDate: d.dueDate || today,
            Terms: d.Terms || '30',

            sellerName: d.sellerName || '',
            sellerAddress: d.sellerAddress || '',
            sellerGSTIN: d.sellerGSTIN || '',

            companyName: d.companyName || file.originalname.replace(/\.[^/.]+$/, ''),
            buyerAddress: d.buyerAddress || '',
            buyerGSTIN: d.buyerGSTIN || '',
            State: d.State || '',
            placeOfSupply: d.placeOfSupply || '',

            subject: d.subject || '',
            description: d.description || `Extracted from: ${file.originalname}`,
            hsnSac: d.hsnSac || '',
            quantity: parseFloat(d.quantity) || 1,
            total_price: parseFloat(d.total_price) || 0,

            subtotal: parseFloat(d.subtotal) || 0,
            GST: parseFloat(d.GST) || 18,
            GST_Amount: parseFloat(d.GST_Amount) || 0,
            total_Amount: parseFloat(d.total_Amount) || 0,
            creditsApplied: parseFloat(d.creditsApplied) || 0,
            balance_due: parseFloat(d.balance_due) || 0,
            totalInWords: d.totalInWords || '',

            paymentStatus: d.paymentStatus || 'Due',

            bankAccountName: d.bankAccountName || '',
            bankAccountNo: d.bankAccountNo || '',
            bankName: d.bankName || '',
            bankAddress: d.bankAddress || '',
            bankIFSC: d.bankIFSC || '',
            bankSWIFT: d.bankSWIFT || '',

            fileName: file.originalname,
            filePath: file.path
        };

        const invoice = new Invoice(invoiceData);
        const savedInvoice = await invoice.save();

        res.status(201).json({
            message: 'Invoice extracted and saved successfully',
            invoice: savedInvoice,
            extractedData: d,
            file: {
                originalName: file.originalname,
                size: file.size,
                path: file.path
            }
        });
    } catch (error) {
        console.error('Error extracting invoice:', error);
        res.status(500).json({ message: error.message || 'Failed to extract invoice data' });
    }
});

// POST send email for invoice
router.post('/:id/send-email', async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id);
        
        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        // Check if email can be sent (cooldown period)
        if (invoice.nextEmailAvailable && new Date() < invoice.nextEmailAvailable) {
            const daysRemaining = Math.ceil((invoice.nextEmailAvailable - new Date()) / (1000 * 60 * 60 * 24));
            return res.status(429).json({ 
                message: `Email cooldown active. You can send the next email in ${daysRemaining} day(s).`,
                nextEmailAvailable: invoice.nextEmailAvailable,
                daysRemaining
            });
        }

        // Get company email from DATABASE
        const recipientInfo = await getCompanyEmail(invoice.companyName);
        
        if (!recipientInfo) {
            return res.status(404).json({ 
                message: `No email found for company: ${invoice.companyName}. Please add it via the Companies page or upload a CSV file.`,
                companyName: invoice.companyName,
                hint: 'Go to Companies page to add or upload company contact details'
            });
        }

        // Update invoice immediately (optimistic update)
        const cooldownDays = invoice.emailCooldownDays || 7;
        const nextAvailable = new Date();
        nextAvailable.setDate(nextAvailable.getDate() + cooldownDays);

        invoice.lastEmailSent = new Date();
        invoice.emailSentCount = (invoice.emailSentCount || 0) + 1;
        invoice.nextEmailAvailable = nextAvailable;
        
        await invoice.save();

        // Respond immediately to client
        res.json({ 
            message: 'Email is being sent',
            sentTo: recipientInfo.email,
            ccCount: recipientInfo.ccEmails?.length || 0,
            contactPerson: recipientInfo.contactPerson,
            lastEmailSent: invoice.lastEmailSent,
            nextEmailAvailable: invoice.nextEmailAvailable,
            emailSentCount: invoice.emailSentCount,
            status: 'sending'
        });

        // Send email in background (don't await)
        sendInvoiceEmail(invoice, recipientInfo)
            .then(emailResult => {
                if (emailResult.success) {
                    console.log(`✓ Email sent successfully to ${recipientInfo.email}`, {
                        invoiceNumber: invoice.invoiceNumber,
                        messageId: emailResult.messageId,
                        ccCount: recipientInfo.ccEmails?.length || 0
                    });
                } else {
                    console.error(`✗ Failed to send email to ${recipientInfo.email}:`, emailResult.error);
                    // Could implement retry logic here
                }
            })
            .catch(error => {
                console.error('Email sending error:', error);
            });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ message: error.message || 'Failed to send email' });
    }
});

// POST send emails to multiple invoices
router.post('/bulk/send-emails', async (req, res) => {
    try {
        const { invoiceIds } = req.body;
        
        if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
            return res.status(400).json({ message: 'Please provide an array of invoice IDs' });
        }

        const results = {
            total: invoiceIds.length,
            success: 0,
            failed: 0,
            skipped: 0,
            details: []
        };

        // Process each invoice
        for (const invoiceId of invoiceIds) {
            try {
                const invoice = await Invoice.findById(invoiceId);
                
                if (!invoice) {
                    results.failed++;
                    results.details.push({
                        invoiceId,
                        status: 'failed',
                        reason: 'Invoice not found'
                    });
                    continue;
                }

                // Check if email can be sent (cooldown period)
                if (invoice.nextEmailAvailable && new Date() < invoice.nextEmailAvailable) {
                    results.skipped++;
                    results.details.push({
                        invoiceId,
                        invoiceNumber: invoice.invoiceNumber,
                        companyName: invoice.companyName,
                        status: 'skipped',
                        reason: 'Cooldown active',
                        nextEmailAvailable: invoice.nextEmailAvailable
                    });
                    continue;
                }

                // Get company email from DATABASE
                const recipientInfo = await getCompanyEmail(invoice.companyName);
                
                if (!recipientInfo) {
                    results.failed++;
                    results.details.push({
                        invoiceId,
                        invoiceNumber: invoice.invoiceNumber,
                        companyName: invoice.companyName,
                        status: 'failed',
                        reason: `No email found for company: ${invoice.companyName}`
                    });
                    continue;
                }

                // Update invoice immediately
                const cooldownDays = invoice.emailCooldownDays || 7;
                const nextAvailable = new Date();
                nextAvailable.setDate(nextAvailable.getDate() + cooldownDays);

                invoice.lastEmailSent = new Date();
                invoice.emailSentCount = (invoice.emailSentCount || 0) + 1;
                invoice.nextEmailAvailable = nextAvailable;
                
                await invoice.save();

                results.success++;
                results.details.push({
                    invoiceId,
                    invoiceNumber: invoice.invoiceNumber,
                    companyName: invoice.companyName,
                    status: 'queued',
                    sentTo: recipientInfo.email,
                    ccCount: recipientInfo.ccEmails?.length || 0
                });

                // Send email in background (don't await)
                sendInvoiceEmail(invoice, recipientInfo)
                    .then(emailResult => {
                        if (emailResult.success) {
                            console.log(`✓ Bulk email sent successfully to ${recipientInfo.email}`, {
                                invoiceNumber: invoice.invoiceNumber,
                                messageId: emailResult.messageId
                            });
                        } else {
                            console.error(`✗ Bulk email failed for ${recipientInfo.email}:`, emailResult.error);
                        }
                    })
                    .catch(error => {
                        console.error('Bulk email sending error:', error);
                    });

            } catch (error) {
                results.failed++;
                results.details.push({
                    invoiceId,
                    status: 'failed',
                    reason: error.message
                });
            }
        }

        res.json({
            message: `Bulk email processing completed: ${results.success} queued, ${results.failed} failed, ${results.skipped} skipped`,
            results
        });
    } catch (error) {
        console.error('Error in bulk email sending:', error);
        res.status(500).json({ message: error.message || 'Failed to process bulk emails' });
    }
});

// POST test CC email - for debugging CC email issues
router.post('/test-cc-email', async (req, res) => {
    try {
        const { to, ccEmails, testSubject } = req.body;
        
        if (!to || !ccEmails || !Array.isArray(ccEmails) || ccEmails.length === 0) {
            return res.status(400).json({ 
                message: 'Please provide "to" (string) and "ccEmails" (array) in request body',
                example: {
                    to: "recipient@example.com",
                    ccEmails: ["cc1@example.com", "cc2@example.com"],
                    testSubject: "Test Subject (optional)"
                }
            });
        }
        
        console.log('\n🧪 ========== CC EMAIL TEST ==========');
        console.log('To:', to);
        console.log('CC:', ccEmails);
        console.log('CC Count:', ccEmails.length);
        
        const subject = testSubject || 'Test Email - CC Functionality';
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head><meta charset="UTF-8"></head>
            <body style="font-family: Arial, sans-serif; padding: 40px; background-color: #f5f5f5;">
                <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <h1 style="color: #2563eb; margin-bottom: 20px;">🧪 CC Email Test</h1>
                    <p style="font-size: 16px; line-height: 1.6; color: #333;">
                        This is a <strong>test email</strong> to verify CC (Carbon Copy) functionality.
                    </p>
                    <div style="background: #eff6ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 0; font-size: 14px; color: #1e40af;">
                            <strong>Primary Recipient (TO):</strong> ${to}
                        </p>
                        <p style="margin: 10px 0 0 0; font-size: 14px; color: #1e40af;">
                            <strong>CC Recipients (${ccEmails.length}):</strong>
                        </p>
                        <ul style="margin: 5px 0 0 0; padding-left: 20px;">
                            ${ccEmails.map(email => `<li style="color: #1e40af; font-size: 14px;">${email}</li>`).join('')}
                        </ul>
                    </div>
                    <p style="font-size: 14px; color: #666; margin-top: 20px;">
                        <strong>✅ If you received this email:</strong><br>
                        The CC functionality is working correctly!
                    </p>
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
                    <p style="font-size: 12px; color: #999; margin: 0;">
                        Sent from AR Email System - ${new Date().toLocaleString()}
                    </p>
                </div>
            </body>
            </html>
        `;
        
        // Import the API function
        const { sendInvoiceEmail } = await import('../utils/emailService.js');
        
        // Create a mock recipient info object
        const recipientInfo = {
            email: to,
            ccEmails: ccEmails,
            contactPerson: 'Test User',
            companyName: 'Test Company'
        };
        
        // Create a mock invoice object
        const mockInvoice = {
            invoiceNumber: 'TEST-001',
            invoiceDate: new Date().toISOString().split('T')[0],
            dueDate: new Date().toISOString().split('T')[0],
            companyName: 'Test Company',
            balance_due: 0,
            total_Amount: 0
        };
        
        // Send test email using the Brevo API directly
        const nodemailer = await import('nodemailer');
        const apiKey = process.env.BREVO_API_KEY;
        const senderEmail = process.env.BREVO_SENDER_EMAIL;
        const senderName = process.env.BREVO_SENDER_NAME || 'AR System Test';
        
        if (!apiKey || !senderEmail) {
            return res.status(500).json({ 
                message: 'Brevo email service not configured. Check BREVO_API_KEY and BREVO_SENDER_EMAIL in .env'
            });
        }
        
        // Format CC recipients
        const ccRecipients = ccEmails.map(emailStr => {
            const emailMatch = emailStr.match(/<(.+?)>/) || emailStr.match(/(\S+@\S+)/);
            const email = emailMatch ? emailMatch[1] : emailStr.trim();
            return { email: email };
        });
        
        const payload = {
            sender: { email: senderEmail, name: senderName },
            to: [{ email: to }],
            cc: ccRecipients,
            subject: subject,
            htmlContent: htmlContent
        };
        
        console.log('📤 Sending test email via Brevo API...');
        console.log('Payload:', JSON.stringify(payload, null, 2));
        
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
            console.error('❌ Brevo API Error:', response.status, responseText);
            return res.status(500).json({
                success: false,
                message: 'Failed to send test email',
                error: responseText,
                statusCode: response.status
            });
        }
        
        const result = JSON.parse(responseText);
        console.log('✅ Test email sent successfully!');
        console.log('Result:', result);
        console.log('========================================\n');
        
        res.json({
            success: true,
            message: 'Test email sent successfully! Check all inboxes (TO and CC recipients)',
            details: {
                messageId: result.messageId,
                to: to,
                cc: ccEmails,
                ccCount: ccEmails.length,
                brevoResponse: result
            }
        });
        
    } catch (error) {
        console.error('❌ Test email error:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to send test email',
            error: error.message 
        });
    }
});

// GET bank details by IFSC code
router.get('/ifsc/:code', async (req, res) => {
    try {
        const ifscCode = req.params.code.toUpperCase();
        
        // Validate IFSC code format (11 characters: first 4 alpha, 5th is 0, last 6 alphanumeric)
        const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
        if (!ifscRegex.test(ifscCode)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid IFSC code format' 
            });
        }

        // Fetch from Razorpay IFSC API
        const response = await fetch(`https://ifsc.razorpay.com/${ifscCode}`);
        
        if (!response.ok) {
            return res.status(404).json({ 
                success: false, 
                message: 'IFSC code not found' 
            });
        }

        const data = await response.json();
        
        res.json({
            success: true,
            data: {
                bankName: data.BANK || '',
                bankAddress: `${data.BRANCH || ''}, ${data.CITY || ''}, ${data.DISTRICT || ''}, ${data.STATE || ''}`.replace(/, ,/g, ',').replace(/^, |, $/g, ''),
                bankIFSC: data.IFSC || ifscCode,
                bankSWIFT: data.SWIFT || '',
                branch: data.BRANCH || '',
                city: data.CITY || '',
                district: data.DISTRICT || '',
                state: data.STATE || ''
            }
        });
    } catch (error) {
        console.error('IFSC lookup error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch bank details',
            error: error.message 
        });
    }
});

export default router;
