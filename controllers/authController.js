const User = require('../models/User');
const bcrypt = require('bcryptjs');

const showLogin = (req, res) => {
    res.render('login', { error: null });
};

const showRegister = (req, res) => {
    res.render('register', { error: null });
};

const register = async (req, res) => {
    try {
        const { name, email, password, confirmPassword } = req.body;

        if (password !== confirmPassword) {
            return res.render('register', { error: 'Passwords do not match' });
        }

        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.render('register', { error: 'Email already registered' });
        }

        const user = await User.create(name, email, password);
        req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
        res.redirect(user.role === 'admin' ? '/admin/dashboard' : '/user/dashboard');
    } catch (error) {
        console.error(error);
        res.render('register', { error: 'Registration failed' });
    }
};

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findByEmail(email);

        if (!user) {
            return res.render('login', { error: 'Invalid credentials' });
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.render('login', { error: 'Invalid credentials' });
        }

        if (!user.is_active) {
            return res.render('login', { error: 'Account is disabled' });
        }

        await User.updateLastLogin(user.id);
        req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };

        res.redirect(user.role === 'admin' ? '/admin/dashboard' : '/user/dashboard');
    } catch (error) {
        console.error(error);
        res.render('login', { error: 'Login failed' });
    }
};

const logout = (req, res) => {
    req.session.destroy();
    res.redirect('/');
};

module.exports = { showLogin, showRegister, register, login, logout };