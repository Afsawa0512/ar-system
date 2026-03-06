import mongoose from 'mongoose';

const bankAccountSchema = new mongoose.Schema({
    accountName: { type: String, required: true },
    accountNo: { type: String, required: true },
    bankName: { type: String, required: true },
    bankAddress: { type: String, default: '' },
    ifscCode: { type: String, required: true, uppercase: true },
    swiftCode: { type: String, default: '', uppercase: true },
    branch: { type: String, default: '' },
    isDefault: { type: Boolean, default: false },
    nickname: { type: String, default: '' } // e.g., "Primary Account", "USD Account"
}, { timestamps: true });

// Index for quick lookup
bankAccountSchema.index({ accountName: 1 });
bankAccountSchema.index({ ifscCode: 1 });

const BankAccount = mongoose.model('BankAccount', bankAccountSchema);
export default BankAccount;
