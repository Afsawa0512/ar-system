
import mongoose from 'mongoose';

const invoiceSchema = new mongoose.Schema({
    invoiceNumber: { type: String, required: true, unique: true },
    invoiceDate: { type: String, required: true },
    dueDate: { type: String, required: true },
    Terms: { type: String, required: true },

    // Seller / "From" details
    sellerName: { type: String, default: '' },
    sellerAddress: { type: String, default: '' },
    sellerGSTIN: { type: String, default: '' },

    // Buyer / "Bill To" details
    companyName: { type: String },            // buyer company name
    buyerAddress: { type: String, default: '' },
    buyerGSTIN: { type: String, default: '' },
    State: { type: String },
    placeOfSupply: { type: String, default: '' },

    // Item / line-item details
    subject: { type: String, default: '' },
    description: { type: String },
    hsnSac: { type: String, default: '' },     // HSN / SAC code
    quantity: { type: Number, default: 1 },
    total_price: { type: Number },             // rate / unit price

    // Financials
    subtotal: { type: Number },
    GST: { type: Number, default: 18 },
    GST_Amount: { type: Number, default: 0 },
    total_Amount: { type: Number },
    creditsApplied: { type: Number, default: 0 },
    balance_due: { type: Number, default: 0 },
    totalInWords: { type: String, default: '' },

    // Payment
    paymentStatus: {
        type: String,
        enum: ['Due', 'Paid', 'PartiallyPaid', 'Overdue'],
        default: 'Due'
    },
    paidAmount: { type: Number, default: 0 },
    
    // Payment Tracking (when customer pays)
    paymentMethod: { 
        type: String, 
        enum: ['Bank Transfer', 'UPI', 'Card', 'Cash', 'Cheque', 'Other', ''],
        default: '' 
    },
    paidToBankAccountId: { type: String, default: '' }, // Reference to BankAccount _id
    paidToBankName: { type: String, default: '' }, // Store bank name for history
    paymentDate: { type: String, default: '' }, // Date when payment was received
    paymentReference: { type: String, default: '' }, // Transaction ID / Reference number
    paymentNotes: { type: String, default: '' }, // Additional payment notes

    // Bank / Remittance details
    bankAccountName: { type: String, default: '' },
    bankAccountNo: { type: String, default: '' },
    bankName: { type: String, default: '' },
    bankAddress: { type: String, default: '' },
    bankIFSC: { type: String, default: '' },
    bankSWIFT: { type: String, default: '' },

    // File reference (for uploaded invoices)
    fileName: { type: String, default: '' },
    filePath: { type: String, default: '' },

    // Email tracking
    lastEmailSent: { type: Date, default: null },
    emailSentCount: { type: Number, default: 0 },
    emailCooldownDays: { type: Number, default: 7 }, // configurable 5-10 days
    nextEmailAvailable: { type: Date, default: null }
}, { timestamps: true });

// Performance Indexes
invoiceSchema.index({ companyName: 1 });
invoiceSchema.index({ invoiceDate: -1 });
invoiceSchema.index({ paymentStatus: 1 });
invoiceSchema.index({ createdAt: -1 });
invoiceSchema.index({ sellerName: 1 });
invoiceSchema.index({ buyerGSTIN: 1 });

const Invoice = mongoose.model('Invoice', invoiceSchema);
export default Invoice;
