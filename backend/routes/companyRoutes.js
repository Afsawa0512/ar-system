import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import CompanyContact from '../models/CompanyContact.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '..', 'uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'contacts-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowed = ['.csv', '.xlsx', '.xls'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV and Excel files are allowed'));
        }
    }
});

// Helper function to parse CSV (improved to handle CC emails in quotes and semicolons)
const parseCSV = (filePath) => {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const lines = fileContent.split('\n').filter(line => line.trim());
    
    console.log('\n📄 Parsing CSV file:', filePath);
    console.log('📊 Total lines:', lines.length);
    
    if (lines.length === 0) {
        throw new Error('CSV file is empty');
    }
    
    // Parse header (simple split - headers shouldn't have commas)
    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    console.log('📋 CSV Headers:', header);
    
    // Find required column indices
    const companyNameIdx = header.findIndex(h => h.includes('company') || h === 'name');
    const emailIdx = header.findIndex(h => h === 'email' || h.includes('mail'));
    const contactPersonIdx = header.findIndex(h => h.includes('contact') || h.includes('person'));
    const ccIdx = header.findIndex(h => h === 'cc' || h.includes('cc'));
    const phoneIdx = header.findIndex(h => h.includes('phone') || h.includes('mobile'));
    const deptIdx = header.findIndex(h => h.includes('department') || h.includes('dept'));
    
    console.log('📍 Column indices:', {
        companyName: companyNameIdx,
        email: emailIdx,
        contactPerson: contactPersonIdx,
        cc: ccIdx,
        phone: phoneIdx,
        department: deptIdx
    });
    
    if (companyNameIdx === -1 || emailIdx === -1) {
        throw new Error('CSV must have "companyName" and "email" columns');
    }
    
    // Parse data rows - handle quoted fields properly
    const contacts = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const values = [];
        let currentValue = '';
        let insideQuotes = false;
        
        // Parse CSV line character by character to handle quotes
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            
            if (char === '"') {
                insideQuotes = !insideQuotes;
            } else if (char === ',' && !insideQuotes) {
                values.push(currentValue.trim());
                currentValue = '';
            } else {
                currentValue += char;
            }
        }
        values.push(currentValue.trim()); // Push last value
        
        if (values.length < 2) {
            console.log(`⚠️ Skipping row ${i}: insufficient columns (${values.length} columns)`);
            continue;
        }
        
        const contact = {
            companyName: values[companyNameIdx] || '',
            email: values[emailIdx] || '',
            contactPerson: contactPersonIdx !== -1 ? values[contactPersonIdx] : '',
            phone: phoneIdx !== -1 ? values[phoneIdx] : '',
            department: deptIdx !== -1 ? values[deptIdx] : '',
            ccEmails: []
        };
        
        // Parse CC emails - handle BOTH semicolon-separated AND comma-separated (if in quotes)
        if (ccIdx !== -1 && values[ccIdx]) {
            const ccField = values[ccIdx].trim();
            console.log(`   CC field raw: "${ccField}"`);
            
            // Split by semicolon OR comma (for emails, both work)
            const ccEmails = ccField
                .split(/[;,\n]/) // Split by semicolon, comma, or newline
                .map(e => e.trim())
                .filter(e => e && e.includes('@') && e.length > 3); // Valid email check
            
            contact.ccEmails = ccEmails;
        }
        
        console.log(`\n✅ Parsed row ${i}:`, {
            companyName: contact.companyName,
            email: contact.email,
            ccEmails: contact.ccEmails,
            ccCount: contact.ccEmails.length
        });
        
        if (contact.companyName && contact.email && contact.email.includes('@')) {
            contacts.push(contact);
        } else {
            console.log(`⚠️ Skipping row ${i}: missing companyName or invalid email`);
        }
    }
    
    console.log(`\n📊 CSV Parsing Summary:`);
    console.log(`   Total rows processed: ${lines.length - 1}`);
    console.log(`   Valid contacts: ${contacts.length}`);
    console.log(`   Contacts with CC: ${contacts.filter(c => c.ccEmails.length > 0).length}`);
    console.log(`   Total CC emails: ${contacts.reduce((sum, c) => sum + c.ccEmails.length, 0)}\n`);
    
    return contacts;
};

// GET all company contacts (with search and pagination)
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';
        
        let query = { isActive: true };
        
        if (search) {
            query.$or = [
                { companyName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { contactPerson: { $regex: search, $options: 'i' } }
            ];
        }
        
        const contacts = await CompanyContact.find(query)
            .sort({ companyName: 1 })
            .skip(skip)
            .limit(limit);
        
        const total = await CompanyContact.countDocuments(query);
        
        res.json({
            contacts,
            total,
            pages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET single company contact by ID
router.get('/:id', async (req, res) => {
    try {
        const contact = await CompanyContact.findById(req.params.id);
        if (!contact) {
            return res.status(404).json({ message: 'Contact not found' });
        }
        res.json(contact);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST upload CSV/Excel file
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        
        const filePath = req.file.path;
        const ext = path.extname(req.file.originalname).toLowerCase();
        
        let contacts;
        
        if (ext === '.csv') {
            contacts = parseCSV(filePath);
        } else {
            // For Excel files (.xlsx, .xls), we'll need xlsx package
            return res.status(400).json({ 
                message: 'Excel support coming soon. Please use CSV for now.',
                hint: 'Convert your Excel file to CSV in Excel: File > Save As > CSV (Comma delimited)'
            });
        }
        
        if (contacts.length === 0) {
            return res.status(400).json({ message: 'No valid contacts found in file' });
        }
        
        // Option to replace all or merge
        const replaceAll = req.body.replaceAll === 'true';
        
        if (replaceAll) {
            // Delete all existing contacts
            await CompanyContact.deleteMany({});
        }
        
        // Insert or update contacts
        const results = {
            added: 0,
            updated: 0,
            failed: 0,
            errors: []
        };
        
        for (const contactData of contacts) {
            try {
                // Check if contact exists
                const existing = await CompanyContact.findOne({ 
                    companyName: { $regex: new RegExp(`^${contactData.companyName}$`, 'i') }
                });
                
                if (existing) {
                    // Update existing
                    console.log(`🔄 Updating existing company: ${contactData.companyName}`, {
                        oldCcEmails: existing.ccEmails,
                        newCcEmails: contactData.ccEmails,
                        ccCount: contactData.ccEmails.length
                    });
                    Object.assign(existing, contactData);
                    await existing.save();
                    results.updated++;
                } else {
                    // Create new
                    console.log(`➕ Creating new company: ${contactData.companyName}`, {
                        email: contactData.email,
                        ccEmails: contactData.ccEmails,
                        ccCount: contactData.ccEmails.length
                    });
                    const newContact = await CompanyContact.create(contactData);
                    console.log(`✅ Saved to database:`, {
                        id: newContact._id,
                        ccEmails: newContact.ccEmails,
                        ccCount: newContact.ccEmails.length
                    });
                    results.added++;
                }
            } catch (err) {
                results.failed++;
                results.errors.push({
                    company: contactData.companyName,
                    error: err.message
                });
            }
        }
        
        // Clean up uploaded file
        fs.unlinkSync(filePath);
        
        res.status(201).json({
            message: 'File processed successfully',
            results,
            totalProcessed: contacts.length
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ message: error.message });
    }
});

// POST create new company contact
router.post('/', async (req, res) => {
    try {
        console.log('📝 Creating new company contact:', {
            companyName: req.body.companyName,
            email: req.body.email,
            ccEmails: req.body.ccEmails,
            ccCount: req.body.ccEmails?.length || 0
        });
        
        const contact = new CompanyContact(req.body);
        const newContact = await contact.save();
        
        console.log('✅ Company created successfully:', {
            id: newContact._id,
            companyName: newContact.companyName,
            email: newContact.email,
            ccEmails: newContact.ccEmails,
            ccCount: newContact.ccEmails?.length || 0
        });
        
        res.status(201).json(newContact);
    } catch (error) {
        console.error('❌ Error creating company:', error);
        res.status(400).json({ message: error.message });
    }
});

// PUT update company contact
router.put('/:id', async (req, res) => {
    try {
        console.log('📝 Updating company contact:', {
            id: req.params.id,
            companyName: req.body.companyName,
            email: req.body.email,
            ccEmails: req.body.ccEmails,
            ccCount: req.body.ccEmails?.length || 0
        });
        
        const contact = await CompanyContact.findByIdAndUpdate(
            req.params.id,
            req.body,
            { returnDocument: 'after', runValidators: true }
        );
        
        if (!contact) {
            return res.status(404).json({ message: 'Contact not found' });
        }
        
        console.log('✅ Company updated successfully:', {
            id: contact._id,
            companyName: contact.companyName,
            email: contact.email,
            ccEmails: contact.ccEmails,
            ccCount: contact.ccEmails?.length || 0
        });
        
        res.json(contact);
    } catch (error) {
        console.error('❌ Error updating company:', error);
        res.status(400).json({ message: error.message });
    }
});

// DELETE company contact
router.delete('/:id', async (req, res) => {
    try {
        const contact = await CompanyContact.findByIdAndDelete(req.params.id);
        
        if (!contact) {
            return res.status(404).json({ message: 'Contact not found' });
        }
        
        res.json({ message: 'Contact deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST bulk delete
router.post('/bulk-delete', async (req, res) => {
    try {
        const { ids } = req.body;
        
        if (!ids || !Array.isArray(ids)) {
            return res.status(400).json({ message: 'Invalid request. Provide an array of IDs.' });
        }
        
        const result = await CompanyContact.deleteMany({ _id: { $in: ids } });
        
        res.json({ 
            message: `${result.deletedCount} contact(s) deleted successfully`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET download CSV template
router.get('/template/download', (req, res) => {
    const csvTemplate = `companyName,email,contactPerson,cc,phone,department
Example Corp,contact@example.com,John Doe,manager@example.com;ceo@example.com,+91-9876543210,Finance
ABC Industries,accounts@abc.com,Jane Smith,boss@abc.com,+91-9876543211,Accounts
XYZ Ltd,billing@xyz.com,Mike Johnson,,+91-9876543212,Billing`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=company_contacts_template.csv');
    res.send(csvTemplate);
});

export default router;
