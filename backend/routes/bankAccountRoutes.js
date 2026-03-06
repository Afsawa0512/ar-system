import express from 'express';
import BankAccount from '../models/BankAccount.js';

const router = express.Router();

// GET all bank accounts
router.get('/', async (req, res) => {
    try {
        const accounts = await BankAccount.find().sort({ isDefault: -1, createdAt: -1 });
        res.json(accounts);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// GET single bank account
router.get('/:id', async (req, res) => {
    try {
        const account = await BankAccount.findById(req.params.id);
        if (!account) {
            return res.status(404).json({ message: 'Bank account not found' });
        }
        res.json(account);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST new bank account
router.post('/', async (req, res) => {
    try {
        // If this account is set as default, unset all other defaults
        if (req.body.isDefault) {
            await BankAccount.updateMany({}, { isDefault: false });
        }

        const account = new BankAccount(req.body);
        const newAccount = await account.save();
        res.status(201).json(newAccount);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// PUT update bank account
router.put('/:id', async (req, res) => {
    try {
        // If this account is being set as default, unset all other defaults
        if (req.body.isDefault) {
            await BankAccount.updateMany({ _id: { $ne: req.params.id } }, { isDefault: false });
        }

        const updatedAccount = await BankAccount.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!updatedAccount) {
            return res.status(404).json({ message: 'Bank account not found' });
        }

        res.json(updatedAccount);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// DELETE bank account
router.delete('/:id', async (req, res) => {
    try {
        const account = await BankAccount.findByIdAndDelete(req.params.id);
        if (!account) {
            return res.status(404).json({ message: 'Bank account not found' });
        }
        res.json({ message: 'Bank account deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST set default bank account
router.post('/:id/set-default', async (req, res) => {
    try {
        // Unset all defaults
        await BankAccount.updateMany({}, { isDefault: false });
        
        // Set this one as default
        const account = await BankAccount.findByIdAndUpdate(
            req.params.id,
            { isDefault: true },
            { new: true }
        );

        if (!account) {
            return res.status(404).json({ message: 'Bank account not found' });
        }

        res.json(account);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

export default router;
