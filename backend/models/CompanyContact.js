import mongoose from 'mongoose';

const companyContactSchema = new mongoose.Schema({
    companyName: { 
        type: String, 
        required: true, 
        trim: true
    },
    email: { 
        type: String, 
        required: true,
        trim: true,
        lowercase: true
    },
    contactPerson: { 
        type: String, 
        default: '',
        trim: true
    },
    // CC recipients - array of email addresses
    ccEmails: [{ 
        type: String,
        lowercase: true,
        trim: true
    }],
    phone: { 
        type: String, 
        default: '',
        trim: true  
    },
    // Additional fields for better management
    department: { 
        type: String, 
        default: '',
        trim: true
    },
    notes: { 
        type: String, 
        default: ''
    },
    isActive: { 
        type: Boolean, 
        default: true 
    }
}, { 
    timestamps: true 
});

// Index for faster search
companyContactSchema.index({ companyName: 1 });
companyContactSchema.index({ email: 1 });

// Method to find by company name (case-insensitive)
companyContactSchema.statics.findByCompanyName = function(companyName) {
    return this.findOne({ 
        companyName: { $regex: new RegExp(`^${companyName}$`, 'i') },
        isActive: true 
    });
};

const CompanyContact = mongoose.model('CompanyContact', companyContactSchema);
export default CompanyContact;
