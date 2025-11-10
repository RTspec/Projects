const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = 5500;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Session middleware
app.use(session({
    secret: 'hostel_management_secret_key_2025',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// MySQL Database Connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'hostel_management'
});

db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// Authentication Middleware
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        res.redirect('/login');
    }
}

// =================== ROUTES ===================

// GET / - Redirect to login or dashboard
app.get('/', (req, res) => {
    if (req.session.user) {
        res.redirect('/dashboard');
    } else {
        res.redirect('/login');
    }
});

// GET /login - Serve login page
app.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// POST /login - Handle authentication
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.redirect('/login?error=' + encodeURIComponent('Please enter both username and password'));
    }

    const query = 'SELECT * FROM users WHERE username = ?';
    
    db.query(query, [username], async (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.redirect('/login?error=' + encodeURIComponent('An error occurred. Please try again.'));
        }

        if (results.length === 0) {
            return res.redirect('/login?error=' + encodeURIComponent('Invalid username or password'));
        }

        const user = results[0];
        let passwordMatch = false;
        
        if (user.password.startsWith('$2b$')) {
            passwordMatch = await bcrypt.compare(password, user.password);
        } else {
            passwordMatch = password === user.password;
        }

        if (passwordMatch) {
            req.session.user = {
                id: user.id,
                username: user.username
            };
            console.log(`User ${username} logged in successfully`);
            res.redirect('/dashboard');
        } else {
            res.redirect('/login?error=' + encodeURIComponent('Invalid username or password'));
        }
    });
});

// GET /logout - Handle logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// GET /dashboard - Dashboard page
app.get('/dashboard', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// GET /students - Students page
app.get('/students', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'students.html'));
});

// GET /rooms - Rooms page
app.get('/rooms', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'rooms.html'));
});

// GET /fees - Fees page
app.get('/fees', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'fees.html'));
});

// =================== API ENDPOINTS ===================

// Dashboard Stats
app.get('/api/stats', isAuthenticated, (req, res) => {
    const queries = {
        totalStudents: 'SELECT COUNT(*) as count FROM students',
        totalRooms: 'SELECT COUNT(*) as count FROM rooms',
        availableRooms: 'SELECT COUNT(*) as count FROM rooms WHERE status = "available"',
        pendingFees: 'SELECT SUM(amount) as total FROM payments WHERE status = "pending"'
    };

    const stats = {};
    let completed = 0;

    Object.keys(queries).forEach(key => {
        db.query(queries[key], (err, results) => {
            if (!err) {
                stats[key] = results[0].count || results[0].total || 0;
            }
            completed++;
            if (completed === Object.keys(queries).length) {
                res.json(stats);
            }
        });
    });
});

// =================== STUDENTS API ===================

// Get all students
app.get('/api/students', isAuthenticated, (req, res) => {
    const query = 'SELECT * FROM students ORDER BY created_at DESC';
    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// Add student
app.post('/api/students', isAuthenticated, (req, res) => {
    const { name, email, roll_number, room_number, phone } = req.body;
    
    if (!name || !email || !roll_number || !room_number) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if room exists and has capacity
    const checkRoom = 'SELECT * FROM rooms WHERE room_number = ?';
    db.query(checkRoom, [room_number], (err, roomResults) => {
        if (err || roomResults.length === 0) {
            return res.status(400).json({ error: 'Invalid room number' });
        }

        const room = roomResults[0];
        if (room.occupied >= room.capacity) {
            return res.status(400).json({ error: 'Room is full' });
        }

        // Insert student
        const insertQuery = 'INSERT INTO students (name, email, roll_number, room_number, phone) VALUES (?, ?, ?, ?, ?)';
        db.query(insertQuery, [name, email, roll_number, room_number, phone], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ error: 'Student with this email or roll number already exists' });
                }
                return res.status(500).json({ error: 'Database error' });
            }

            // Update room occupancy
            const updateRoom = 'UPDATE rooms SET occupied = occupied + 1 WHERE room_number = ?';
            db.query(updateRoom, [room_number], (err) => {
                if (err) console.error('Failed to update room occupancy');
            });

            res.json({ message: 'Student added successfully', id: result.insertId });
        });
    });
});

// Delete student
app.delete('/api/students/:id', isAuthenticated, (req, res) => {
    const studentId = req.params.id;

    // Get student's room before deletion
    const getStudent = 'SELECT room_number FROM students WHERE id = ?';
    db.query(getStudent, [studentId], (err, results) => {
        if (err || results.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const roomNumber = results[0].room_number;

        // Delete student
        const deleteQuery = 'DELETE FROM students WHERE id = ?';
        db.query(deleteQuery, [studentId], (err) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            // Update room occupancy
            const updateRoom = 'UPDATE rooms SET occupied = occupied - 1 WHERE room_number = ?';
            db.query(updateRoom, [roomNumber], (err) => {
                if (err) console.error('Failed to update room occupancy');
            });

            res.json({ message: 'Student deleted successfully' });
        });
    });
});

// =================== ROOMS API ===================

// Get all rooms
app.get('/api/rooms', isAuthenticated, (req, res) => {
    const query = 'SELECT * FROM rooms ORDER BY room_number';
    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// Add room
app.post('/api/rooms', isAuthenticated, (req, res) => {
    const { room_number, capacity } = req.body;
    
    if (!room_number || !capacity) {
        return res.status(400).json({ error: 'Room number and capacity are required' });
    }

    const query = 'INSERT INTO rooms (room_number, capacity, occupied, status) VALUES (?, ?, 0, "available")';
    db.query(query, [room_number, capacity], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ error: 'Room number already exists' });
            }
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ message: 'Room added successfully', id: result.insertId });
    });
});

// Update room status
app.put('/api/rooms/:id', isAuthenticated, (req, res) => {
    const roomId = req.params.id;
    const { status } = req.body;

    if (!['available', 'full', 'maintenance'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    const query = 'UPDATE rooms SET status = ? WHERE id = ?';
    db.query(query, [status, roomId], (err) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ message: 'Room status updated successfully' });
    });
});

// Delete room
app.delete('/api/rooms/:id', isAuthenticated, (req, res) => {
    const roomId = req.params.id;

    // Check if room has students
    const checkStudents = 'SELECT COUNT(*) as count FROM students WHERE room_number = (SELECT room_number FROM rooms WHERE id = ?)';
    db.query(checkStudents, [roomId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        if (results[0].count > 0) {
            return res.status(400).json({ error: 'Cannot delete room with students assigned' });
        }

        const deleteQuery = 'DELETE FROM rooms WHERE id = ?';
        db.query(deleteQuery, [roomId], (err) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ message: 'Room deleted successfully' });
        });
    });
});

// =================== FEES API ===================

// Get all payments
app.get('/api/payments', isAuthenticated, (req, res) => {
    const query = `
        SELECT p.*, s.name as student_name, s.roll_number 
        FROM payments p 
        LEFT JOIN students s ON p.student_id = s.id 
        ORDER BY p.created_at DESC
    `;
    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// Add payment
app.post('/api/payments', isAuthenticated, (req, res) => {
    const { student_id, amount, payment_type } = req.body;
    
    if (!student_id || !amount || !payment_type) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const query = 'INSERT INTO payments (student_id, amount, payment_date, payment_type, status) VALUES (?, ?, CURDATE(), ?, "pending")';
    db.query(query, [student_id, amount, payment_type], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ message: 'Payment recorded successfully', id: result.insertId });
    });
});

// Update payment status
app.put('/api/payments/:id', isAuthenticated, (req, res) => {
    const paymentId = req.params.id;
    const { status } = req.body;

    const query = 'UPDATE payments SET status = ? WHERE id = ?';
    db.query(query, [status, paymentId], (err) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ message: 'Payment status updated successfully' });
    });
});

// Delete payment
app.delete('/api/payments/:id', isAuthenticated, (req, res) => {
    const paymentId = req.params.id;

    const query = 'DELETE FROM payments WHERE id = ?';
    db.query(query, [paymentId], (err) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ message: 'Payment deleted successfully' });
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Login page: http://localhost:${PORT}/login`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    db.end((err) => {
        console.log('\nDatabase connection closed');
        process.exit(err ? 1 : 0);
    });
});