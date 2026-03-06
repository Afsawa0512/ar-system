import express from 'express';
import Member from '../models/member.js';

const router = express.Router();

// GET all members
router.get('/', async (req, res) => {
    try {
        const members = await Member.find().sort({ createdAt: -1 });
        res.json(members);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST new member
router.post('/', async (req, res) => {
    const member = new Member(req.body);
    try {
        const newMember = await member.save();
        res.status(201).json(newMember);
    } catch (error) {
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return res.status(400).json({
                message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists in the system.`
            });
        }
        res.status(400).json({ message: error.message });
    }
});

// POST member login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const member = await Member.findOne({ username, password });
        if (!member) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        if (member.status !== 'Active') {
            return res.status(403).json({ message: 'Your account is inactive. Please contact admin.' });
        }
        res.json({
            message: 'Login successful',
            user: {
                id: member._id,
                name: member.name,
                email: member.email,
                phone: member.phone,
                username: member.username,
                role: member.role
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// PUT update member
router.put('/:id', async (req, res) => {
    try {
        const updatedMember = await Member.findByIdAndUpdate(
            req.params.id,
            req.body,
            { returnDocument: 'after', runValidators: true }
        );
        if (!updatedMember) {
            return res.status(404).json({ message: 'Member not found' });
        }
        res.json(updatedMember);
    } catch (error) {
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return res.status(400).json({
                message: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists in the system.`
            });
        }
        res.status(400).json({ message: error.message });
    }
});

// DELETE member
router.delete('/:id', async (req, res) => {
    try {
        await Member.findByIdAndDelete(req.params.id);
        res.json({ message: 'Member deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

export default router;
