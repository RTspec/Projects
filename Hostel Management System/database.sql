-- Create the database
CREATE DATABASE IF NOT EXISTS hostel_management;

-- Use the database
USE hostel_management;

-- =================== Users Table ===================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert demo users
INSERT INTO users (username, password) VALUES 
('admin', '12345'),
('user1', '$2b$10$XqKvVwT5pJY8ZQdN2KJI3OqGwW8ZPEY4JqNFZVL3YiKZWpMKY6zNq'),
('hostel_admin', '$2b$10$8K7jG3pEqQxN9mZYxHvH4eqF0YvNtPsHqCzVxWZJYLKZR5JqMvNqK');

-- =================== Rooms Table ===================
CREATE TABLE IF NOT EXISTS rooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_number VARCHAR(20) UNIQUE NOT NULL,
    capacity INT NOT NULL,
    occupied INT DEFAULT 0,
    status ENUM('available', 'full', 'maintenance') DEFAULT 'available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert demo rooms
INSERT INTO rooms (room_number, capacity, occupied, status) VALUES 
('101', 2, 0, 'available'),
('102', 3, 0, 'available'),
('103', 2, 0, 'available'),
('104', 4, 0, 'available'),
('201', 2, 0, 'available'),
('202', 3, 0, 'available'),
('203', 2, 0, 'maintenance'),
('204', 4, 0, 'available'),
('301', 2, 0, 'available'),
('302', 3, 0, 'available');

-- =================== Students Table ===================
CREATE TABLE IF NOT EXISTS students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    roll_number VARCHAR(50) UNIQUE NOT NULL,
    room_number VARCHAR(20),
    phone VARCHAR(15),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_number) REFERENCES rooms(room_number) ON UPDATE CASCADE
);

-- Insert demo students
INSERT INTO students (name, email, roll_number, room_number, phone) VALUES 
('Rahul Kumar', 'rahul.kumar@example.com', 'ST001', '101', '9876543210'),
('Priya Sharma', 'priya.sharma@example.com', 'ST002', '101', '9876543211'),
('Amit Patel', 'amit.patel@example.com', 'ST003', '102', '9876543212'),
('Sneha Reddy', 'sneha.reddy@example.com', 'ST004', '102', '9876543213'),
('Vikram Singh', 'vikram.singh@example.com', 'ST005', '104', '9876543214');

-- Update room occupancy based on students
UPDATE rooms r 
SET occupied = (
    SELECT COUNT(*) 
    FROM students s 
    WHERE s.room_number = r.room_number
);

-- =================== Payments Table ===================
CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT,
    amount DECIMAL(10, 2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_type ENUM('rent', 'deposit', 'maintenance') NOT NULL,
    status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- Insert demo payments
INSERT INTO payments (student_id, amount, payment_date, payment_type, status) VALUES 
(1, 5000.00, '2025-10-01', 'rent', 'completed'),
(2, 5000.00, '2025-10-01', 'rent', 'completed'),
(3, 5000.00, '2025-10-01', 'rent', 'pending'),
(4, 5000.00, '2025-10-01', 'rent', 'pending'),
(5, 5000.00, '2025-10-01', 'rent', 'completed'),
(1, 10000.00, '2025-09-01', 'deposit', 'completed'),
(2, 10000.00, '2025-09-01', 'deposit', 'completed'),
(3, 10000.00, '2025-09-01', 'deposit', 'completed'),
(4, 10000.00, '2025-09-01', 'deposit', 'completed'),
(5, 10000.00, '2025-09-01', 'deposit', 'completed');

-- =================== Useful Views ===================

-- View for student details with room info
CREATE OR REPLACE VIEW student_details AS
SELECT 
    s.id,
    s.name,
    s.email,
    s.roll_number,
    s.phone,
    s.room_number,
    r.capacity as room_capacity,
    r.status as room_status,
    s.created_at
FROM students s
LEFT JOIN rooms r ON s.room_number = r.room_number;

-- View for payment summary by student
CREATE OR REPLACE VIEW payment_summary AS
SELECT 
    s.id as student_id,
    s.name as student_name,
    s.roll_number,
    COUNT(p.id) as total_payments,
    SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END) as total_paid,
    SUM(CASE WHEN p.status = 'pending' THEN p.amount ELSE 0 END) as total_pending
FROM students s
LEFT JOIN payments p ON s.id = p.student_id
GROUP BY s.id, s.name, s.roll_number;

-- View for room occupancy details
CREATE OR REPLACE VIEW room_occupancy AS
SELECT 
    r.room_number,
    r.capacity,
    r.occupied,
    (r.capacity - r.occupied) as available_beds,
    r.status,
    GROUP_CONCAT(s.name SEPARATOR ', ') as occupants
FROM rooms r
LEFT JOIN students s ON r.room_number = s.room_number
GROUP BY r.id, r.room_number, r.capacity, r.occupied, r.status;

-- =================== Triggers ===================

-- Trigger to auto-update room status when capacity is reached
DELIMITER $$
CREATE TRIGGER update_room_status_after_student_insert
AFTER INSERT ON students
FOR EACH ROW
BEGIN
    UPDATE rooms 
    SET status = CASE 
        WHEN occupied >= capacity THEN 'full'
        ELSE 'available'
    END
    WHERE room_number = NEW.room_number;
END$$

CREATE TRIGGER update_room_status_after_student_delete
AFTER DELETE ON students
FOR EACH ROW
BEGIN
    UPDATE rooms 
    SET status = CASE 
        WHEN occupied >= capacity THEN 'full'
        WHEN status != 'maintenance' THEN 'available'
        ELSE status
    END
    WHERE room_number = OLD.room_number;
END$$
DELIMITER ;

-- =================== Sample Queries ===================

-- Get all available rooms with capacity
-- SELECT * FROM rooms WHERE status = 'available' AND occupied < capacity;

-- Get students with pending payments
-- SELECT s.name, s.roll_number, SUM(p.amount) as pending_amount
-- FROM students s
-- JOIN payments p ON s.id = p.student_id
-- WHERE p.status = 'pending'
-- GROUP BY s.id;

-- Get room occupancy report
-- SELECT * FROM room_occupancy ORDER BY room_number;

-- Get monthly revenue
-- SELECT 
--     DATE_FORMAT(payment_date, '%Y-%m') as month,
--     SUM(amount) as total_revenue
-- FROM payments
-- WHERE status = 'completed'
-- GROUP BY month
-- ORDER BY month DESC;