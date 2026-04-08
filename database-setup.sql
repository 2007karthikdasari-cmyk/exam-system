-- This file will be executed on Render database

-- Users Table
CREATE TABLE IF NOT EXISTS users (
                                     id SERIAL PRIMARY KEY,
                                     name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
    );

-- Admins Table
CREATE TABLE IF NOT EXISTS admins (
                                      id SERIAL PRIMARY KEY,
                                      name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
    );

-- Exams Table
CREATE TABLE IF NOT EXISTS exams (
                                     id SERIAL PRIMARY KEY,
                                     title VARCHAR(200) NOT NULL,
    description TEXT,
    duration INT NOT NULL,
    total_questions INT DEFAULT 0,
    attempt_limit INT DEFAULT 1,
    created_by INT REFERENCES admins(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
    );

-- Questions Table
CREATE TABLE IF NOT EXISTS questions (
                                         id SERIAL PRIMARY KEY,
                                         exam_id INT REFERENCES exams(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    option_a VARCHAR(500),
    option_b VARCHAR(500),
    option_c VARCHAR(500),
    option_d VARCHAR(500),
    correct_answer CHAR(1) CHECK (correct_answer IN ('A', 'B', 'C', 'D')),
    marks INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

-- User Answers Table
CREATE TABLE IF NOT EXISTS user_answers (
                                            id SERIAL PRIMARY KEY,
                                            user_id INT REFERENCES users(id),
    exam_id INT REFERENCES exams(id),
    question_id INT REFERENCES questions(id),
    selected_answer CHAR(1),
    is_correct BOOLEAN,
    answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

-- Results Table
CREATE TABLE IF NOT EXISTS results (
                                       id SERIAL PRIMARY KEY,
                                       user_id INT REFERENCES users(id),
    exam_id INT REFERENCES exams(id),
    score INT,
    total_marks INT,
    percentage DECIMAL(5,2),
    status VARCHAR(20),
    attempt_number INT DEFAULT 1,
    started_at TIMESTAMP,
    submitted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

-- Insert Admin (password: 10KarthiK@eya112007)
-- You'll need to update this with actual bcrypt hash
INSERT INTO admins (name, email, password, is_active)
SELECT 'Karthikeya', '2007karthikdasari@gmail.com', '$2a$10$N9qo8uLOickgx2ZMRZoMy.MrJqKqKqKqKqKqKqKqKqKqKqKqKqK', true
    WHERE NOT EXISTS (SELECT 1 FROM admins WHERE email = '2007karthikdasari@gmail.com');

-- Insert Sample Users
INSERT INTO users (name, email) VALUES
                                    ('Karthikeya Dasari', '24r11a62f3@gcet.edu.in'),
                                    ('Vanaja', '24r11a62e9@gcet.edu.in'),
                                    ('Nikhil Dutta', '24r11a62e7@gcet.edu.in'),
                                    ('Kedhar', '24r11a62e7@gcet.edu.in'),
                                    ('Suresh Raina', '24r11a62g0@gcet.edu.in'),
                                    ('Bhavesh', '24r11a62f1@gcet.edu.in')
    ON CONFLICT (email) DO NOTHING;