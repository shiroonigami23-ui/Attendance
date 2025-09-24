const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const path = require('path');

// Import schemas
const { User, Admin, Class, Attendance, AttendanceWindow, Notification } = require('./schemas');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Strict login rate limiting
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 login attempts per windowMs
    message: {
        success: false,
        message: 'Too many login attempts, please try again later.'
    }
});

// MongoDB connection
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/attendance_system', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error('Database connection error:', error);
        process.exit(1);
    }
};

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-super-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/attendance_system',
        collectionName: 'sessions'
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Utility functions
const hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(password, salt);
};

const comparePassword = async (password, hashedPassword) => {
    return bcrypt.compare(password, hashedPassword);
};

const generateDeviceFingerprint = (req) => {
    const userAgent = req.get('User-Agent') || '';
    const acceptLanguage = req.get('Accept-Language') || '';
    const acceptEncoding = req.get('Accept-Encoding') || '';
    const ip = req.ip;
    
    const fingerprintData = `${userAgent}|${acceptLanguage}|${acceptEncoding}|${ip}`;
    return crypto.createHash('sha256').update(fingerprintData).digest('hex');
};

// Authentication middleware
const requireAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    next();
};

const requireAdmin = async (req, res, next) => {
    if (!req.session.userId || req.session.userRole !== 'admin') {
        return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    next();
};

// Device fingerprint middleware
const validateDeviceFingerprint = async (req, res, next) => {
    const { deviceFingerprint } = req.body;
    const serverFingerprint = generateDeviceFingerprint(req);
    
    // For production, you might want to be more strict about fingerprint matching
    // For demo purposes, we'll allow some flexibility
    if (deviceFingerprint && serverFingerprint) {
        req.validatedFingerprint = deviceFingerprint;
        next();
    } else {
        return res.status(400).json({ 
            success: false, 
            message: 'Invalid device fingerprint' 
        });
    }
};

// Check if attendance window is open (10 min before to 5 min after class start)
const isAttendanceWindowOpen = (classStartTime) => {
    const now = new Date();
    const [hours, minutes] = classStartTime.split(':').map(Number);
    
    const classTime = new Date();
    classTime.setHours(hours, minutes, 0, 0);
    
    const windowStart = new Date(classTime.getTime() - 10 * 60 * 1000); // 10 minutes before
    const windowEnd = new Date(classTime.getTime() + 5 * 60 * 1000);   // 5 minutes after
    
    return now >= windowStart && now <= windowEnd;
};

// Routes

// Health check
app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'Server is running', timestamp: new Date().toISOString() });
});

// Authentication Routes

// Student Registration
app.post('/api/auth/register', authLimiter, validateDeviceFingerprint, async (req, res) => {
    try {
        const { studentId, fullName, email, department, semester, password } = req.body;
        const deviceFingerprint = req.validatedFingerprint;
        
        // Validation
        if (!studentId || !fullName || !email || !department || !semester || !password) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
        }
        
        // Check if student already exists
        const existingStudent = await User.findOne({ 
            $or: [{ studentId }, { email }] 
        });
        
        if (existingStudent) {
            return res.status(400).json({ 
                success: false, 
                message: 'Student ID or email already registered' 
            });
        }
        
        // Check if device is already registered to another student
        const existingDevice = await User.findOne({ 
            deviceFingerprint,
            studentId: { $ne: studentId }
        });
        
        if (existingDevice) {
            return res.status(400).json({ 
                success: false, 
                message: 'This device is already registered to another student' 
            });
        }
        
        // Hash password and create user
        const hashedPassword = await hashPassword(password);
        
        const newUser = new User({
            studentId,
            fullName,
            email,
            department,
            semester: parseInt(semester),
            password: hashedPassword,
            deviceFingerprint,
            registrationDate: new Date(),
            lastLogin: new Date(),
            isActive: true
        });
        
        await newUser.save();
        
        // Create session
        req.session.userId = newUser._id;
        req.session.userRole = 'student';
        req.session.deviceFingerprint = deviceFingerprint;
        
        const userResponse = {
            id: newUser._id,
            studentId: newUser.studentId,
            fullName: newUser.fullName,
            email: newUser.email,
            department: newUser.department,
            semester: newUser.semester,
            role: 'student'
        };
        
        res.status(201).json({ 
            success: true, 
            message: 'Registration successful', 
            user: userResponse 
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Registration failed' });
    }
});

// Student Login
app.post('/api/auth/student', authLimiter, validateDeviceFingerprint, async (req, res) => {
    try {
        const { studentId, password } = req.body;
        const deviceFingerprint = req.validatedFingerprint;
        
        if (!studentId || !password) {
            return res.status(400).json({ success: false, message: 'Student ID and password are required' });
        }
        
        // Find student
        const student = await User.findOne({ studentId });
        
        if (!student || !student.isActive) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        
        // Check password
        const isValidPassword = await comparePassword(password, student.password);
        if (!isValidPassword) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        
        // Check device fingerprint for security
        if (student.deviceFingerprint && student.deviceFingerprint !== deviceFingerprint) {
            return res.status(403).json({ 
                success: false, 
                message: 'Device fingerprint mismatch. Please contact administrator for device reset.' 
            });
        }
        
        // Update device fingerprint if not set
        if (!student.deviceFingerprint) {
            student.deviceFingerprint = deviceFingerprint;
        }
        
        // Update last login
        student.lastLogin = new Date();
        await student.save();
        
        // Create session
        req.session.userId = student._id;
        req.session.userRole = 'student';
        req.session.deviceFingerprint = deviceFingerprint;
        
        const userResponse = {
            id: student._id,
            studentId: student.studentId,
            fullName: student.fullName,
            email: student.email,
            department: student.department,
            semester: student.semester,
            role: 'student'
        };
        
        res.json({ 
            success: true, 
            message: 'Login successful', 
            user: userResponse 
        });
        
    } catch (error) {
        console.error('Student login error:', error);
        res.status(500).json({ success: false, message: 'Login failed' });
    }
});

// Admin Login
app.post('/api/auth/admin', authLimiter, validateDeviceFingerprint, async (req, res) => {
    try {
        const { username, password } = req.body;
        const deviceFingerprint = req.validatedFingerprint;
        
        if (!username || !password) {
            return res.status(400).json({ success: false, message: 'Username and password are required' });
        }
        
        // Find admin
        const admin = await Admin.findOne({ username, isActive: true });
        
        if (!admin) {
            return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
        }
        
        // Check password
        const isValidPassword = await comparePassword(password, admin.password);
        if (!isValidPassword) {
            return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
        }
        
        // Update last login and device fingerprint
        admin.lastLogin = new Date();
        admin.deviceFingerprint = deviceFingerprint;
        await admin.save();
        
        // Create session
        req.session.userId = admin._id;
        req.session.userRole = 'admin';
        req.session.deviceFingerprint = deviceFingerprint;
        
        const userResponse = {
            id: admin._id,
            username: admin.username,
            fullName: admin.fullName,
            role: 'admin'
        };
        
        res.json({ 
            success: true, 
            message: 'Admin login successful', 
            user: userResponse 
        });
        
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ success: false, message: 'Login failed' });
    }
});

// Verify session
app.get('/api/auth/verify', async (req, res) => {
    try {
        if (!req.session.userId) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }
        
        let user;
        if (req.session.userRole === 'admin') {
            user = await Admin.findById(req.session.userId).select('-password');
        } else {
            user = await User.findById(req.session.userId).select('-password');
        }
        
        if (!user) {
            req.session.destroy();
            return res.status(401).json({ success: false, message: 'User not found' });
        }
        
        const userResponse = {
            id: user._id,
            ...(user.studentId && { studentId: user.studentId }),
            ...(user.username && { username: user.username }),
            fullName: user.fullName,
            ...(user.email && { email: user.email }),
            ...(user.department && { department: user.department }),
            ...(user.semester && { semester: user.semester }),
            role: req.session.userRole
        };
        
        res.json({ success: true, user: userResponse });
        
    } catch (error) {
        console.error('Session verification error:', error);
        res.status(500).json({ success: false, message: 'Verification failed' });
    }
});

// Logout (Admin only)
app.post('/api/auth/logout', requireAuth, async (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({ success: false, message: 'Logout failed' });
            }
            res.clearCookie('connect.sid');
            res.json({ success: true, message: 'Logged out successfully' });
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ success: false, message: 'Logout failed' });
    }
});

// Attendance Routes

// Mark Attendance
app.post('/api/attendance/mark', requireAuth, validateDeviceFingerprint, async (req, res) => {
    try {
        const { studentId, classId } = req.body;
        const deviceFingerprint = req.validatedFingerprint;
        
        // Verify student is marking their own attendance
        const student = await User.findById(req.session.userId);
        if (student.studentId !== studentId) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }
        
        // Verify device fingerprint
        if (student.deviceFingerprint !== deviceFingerprint) {
            return res.status(403).json({ 
                success: false, 
                message: 'Device fingerprint mismatch. Attendance can only be marked from registered device.' 
            });
        }
        
        // Get class details
        const classData = await Class.findById(classId);
        if (!classData) {
            return res.status(404).json({ success: false, message: 'Class not found' });
        }
        
        // Check if attendance window is open
        if (!isAttendanceWindowOpen(classData.startTime)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Attendance window is closed. You can mark attendance 10 minutes before to 5 minutes after class start.' 
            });
        }
        
        // Check if already marked for today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const existingAttendance = await Attendance.findOne({
            studentId,
            classId,
            attendanceDate: {
                $gte: today,
                $lt: tomorrow
            }
        });
        
        if (existingAttendance) {
            return res.status(400).json({ 
                success: false, 
                message: 'Attendance already marked for this class today' 
            });
        }
        
        // Determine status based on timing
        const now = new Date();
        const [hours, minutes] = classData.startTime.split(':').map(Number);
        const classTime = new Date();
        classTime.setHours(hours, minutes, 0, 0);
        
        let status = 'present';
        if (now > classTime) {
            status = 'late';
        }
        
        // Create attendance record
        const attendance = new Attendance({
            studentId,
            classId,
            attendanceDate: now,
            status,
            markedAt: now,
            deviceFingerprint,
            isValidated: true
        });
        
        await attendance.save();
        
        res.json({ 
            success: true, 
            message: `Attendance marked as ${status}`,
            attendance: {
                id: attendance._id,
                status,
                markedAt: attendance.markedAt
            }
        });
        
    } catch (error) {
        console.error('Mark attendance error:', error);
        res.status(500).json({ success: false, message: 'Failed to mark attendance' });
    }
});

// Get student attendance
app.get('/api/attendance/student/:studentId', requireAuth, async (req, res) => {
    try {
        const { studentId } = req.params;
        
        // Check authorization
        if (req.session.userRole !== 'admin') {
            const student = await User.findById(req.session.userId);
            if (student.studentId !== studentId) {
                return res.status(403).json({ success: false, message: 'Unauthorized' });
            }
        }
        
        const attendanceRecords = await Attendance.find({ studentId })
            .populate('classId', 'subjectCode subjectName')
            .sort({ attendanceDate: -1 });
        
        // Calculate statistics
        const total = attendanceRecords.length;
        const present = attendanceRecords.filter(r => r.status === 'present').length;
        const absent = attendanceRecords.filter(r => r.status === 'absent').length;
        const late = attendanceRecords.filter(r => r.status === 'late').length;
        const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
        
        const stats = {
            total,
            present,
            absent,
            late,
            percentage
        };
        
        res.json({ 
            success: true, 
            attendance: attendanceRecords,
            stats 
        });
        
    } catch (error) {
        console.error('Get attendance error:', error);
        res.status(500).json({ success: false, message: 'Failed to get attendance' });
    }
});

// Get active classes for current time
app.get('/api/classes/active', requireAuth, async (req, res) => {
    try {
        const now = new Date();
        const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
        
        const classes = await Class.find({
            dayOfWeek: currentDay,
            isActive: true
        });
        
        const activeClasses = classes.filter(cls => {
            return isAttendanceWindowOpen(cls.startTime);
        });
        
        res.json({ success: true, data: activeClasses });
        
    } catch (error) {
        console.error('Get active classes error:', error);
        res.status(500).json({ success: false, message: 'Failed to get active classes' });
    }
});

// Get upcoming classes
app.get('/api/classes/upcoming', requireAuth, async (req, res) => {
    try {
        const now = new Date();
        const currentDay = now.getDay();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        
        const classes = await Class.find({
            dayOfWeek: currentDay,
            isActive: true
        });
        
        const upcomingClasses = classes.filter(cls => {
            const [hours, minutes] = cls.startTime.split(':').map(Number);
            const classTime = hours * 60 + minutes;
            const timeToClass = classTime - currentTime;
            
            return timeToClass > 0 && timeToClass <= 60; // Next hour
        });
        
        res.json({ success: true, data: upcomingClasses });
        
    } catch (error) {
        console.error('Get upcoming classes error:', error);
        res.status(500).json({ success: false, message: 'Failed to get upcoming classes' });
    }
});

// Admin Routes

// Get admin statistics
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
    try {
        const totalStudents = await User.countDocuments({ isActive: true });
        const totalClasses = await Class.countDocuments({ isActive: true });
        
        // Get today's attendance
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const todayAttendance = await Attendance.countDocuments({
            attendanceDate: {
                $gte: today,
                $lt: tomorrow
            }
        });
        
        // Calculate average attendance
        const totalAttendanceRecords = await Attendance.countDocuments();
        const presentRecords = await Attendance.countDocuments({ status: 'present' });
        const avgAttendance = totalAttendanceRecords > 0 ? Math.round((presentRecords / totalAttendanceRecords) * 100) : 0;
        
        const stats = {
            totalStudents,
            activeStudents: todayAttendance,
            totalClasses,
            avgAttendance
        };
        
        res.json({ success: true, data: stats });
        
    } catch (error) {
        console.error('Get admin stats error:', error);
        res.status(500).json({ success: false, message: 'Failed to get statistics' });
    }
});

// Get all students (Admin only)
app.get('/api/admin/students', requireAdmin, async (req, res) => {
    try {
        const students = await User.find({ isActive: true })
            .select('-password')
            .sort({ studentId: 1 });
        
        res.json({ success: true, data: students });
        
    } catch (error) {
        console.error('Get students error:', error);
        res.status(500).json({ success: false, message: 'Failed to get students' });
    }
});

// Reset student device fingerprint (Admin only)
app.post('/api/admin/students/:id/reset-device', requireAdmin, async (req, res) => {
    try {
        const student = await User.findByIdAndUpdate(
            req.params.id,
            { $unset: { deviceFingerprint: 1 } },
            { new: true }
        ).select('-password');
        
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }
        
        res.json({ success: true, message: 'Device fingerprint reset successfully', student });
        
    } catch (error) {
        console.error('Reset device error:', error);
        res.status(500).json({ success: false, message: 'Failed to reset device fingerprint' });
    }
});

// Force logout student (Admin only)
app.post('/api/admin/students/:id/logout', requireAdmin, async (req, res) => {
    try {
        const student = await User.findById(req.params.id);
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }
        
        // Here you would typically invalidate the student's session
        // For simplicity, we'll just clear their device fingerprint
        student.deviceFingerprint = undefined;
        await student.save();
        
        res.json({ success: true, message: 'Student logged out successfully' });
        
    } catch (error) {
        console.error('Force logout error:', error);
        res.status(500).json({ success: false, message: 'Failed to logout student' });
    }
});

// Class Management Routes (Admin only)

// Get all classes
app.get('/api/classes', requireAuth, async (req, res) => {
    try {
        const classes = await Class.find({ isActive: true }).sort({ dayOfWeek: 1, startTime: 1 });
        res.json({ success: true, data: classes });
    } catch (error) {
        console.error('Get classes error:', error);
        res.status(500).json({ success: false, message: 'Failed to get classes' });
    }
});

// Create class (Admin only)
app.post('/api/classes', requireAdmin, async (req, res) => {
    try {
        const classData = new Class(req.body);
        await classData.save();
        res.status(201).json({ success: true, data: classData });
    } catch (error) {
        console.error('Create class error:', error);
        res.status(500).json({ success: false, message: 'Failed to create class' });
    }
});

// Update class (Admin only)
app.put('/api/classes/:id', requireAdmin, async (req, res) => {
    try {
        const classData = await Class.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!classData) {
            return res.status(404).json({ success: false, message: 'Class not found' });
        }
        res.json({ success: true, data: classData });
    } catch (error) {
        console.error('Update class error:', error);
        res.status(500).json({ success: false, message: 'Failed to update class' });
    }
});

// Delete class (Admin only)
app.delete('/api/classes/:id', requireAdmin, async (req, res) => {
    try {
        const classData = await Class.findByIdAndUpdate(
            req.params.id, 
            { isActive: false }, 
            { new: true }
        );
        if (!classData) {
            return res.status(404).json({ success: false, message: 'Class not found' });
        }
        res.json({ success: true, message: 'Class deleted successfully' });
    } catch (error) {
        console.error('Delete class error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete class' });
    }
});

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Catch all route for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Global error handler:', error);
    res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
    });
});

// Initialize default admin accounts
const initializeDefaultAdmins = async () => {
    try {
        const adminCount = await Admin.countDocuments();
        if (adminCount === 0) {
            const defaultAdmins = [
                {
                    username: 'admin1',
                    password: await hashPassword('admin123'),
                    fullName: 'System Administrator',
                    email: 'admin1@rjit.ac.in',
                    role: 'admin',
                    isActive: true,
                    createdAt: new Date()
                },
                {
                    username: 'admin2',
                    password: await hashPassword('admin456'),
                    fullName: 'Assistant Administrator',
                    email: 'admin2@rjit.ac.in',
                    role: 'admin',
                    isActive: true,
                    createdAt: new Date()
                }
            ];
            
            await Admin.insertMany(defaultAdmins);
            console.log('Default admin accounts created');
        }
    } catch (error) {
        console.error('Error initializing default admins:', error);
    }
};

// Initialize default classes
const initializeDefaultClasses = async () => {
    try {
        const classCount = await Class.countDocuments();
        if (classCount === 0) {
            const defaultClasses = [
                {
                    subjectCode: 'CS501',
                    subjectName: 'Data Structures and Algorithms',
                    faculty: 'Dr. Smith',
                    room: 'Room 201',
                    department: 'Computer Science',
                    semester: 5,
                    dayOfWeek: 1, // Monday
                    startTime: '10:00',
                    endTime: '11:00',
                    isActive: true
                },
                {
                    subjectCode: 'CS502',
                    subjectName: 'Database Management Systems',
                    faculty: 'Prof. Johnson',
                    room: 'Room 203',
                    department: 'Computer Science',
                    semester: 5,
                    dayOfWeek: 1,
                    startTime: '12:00',
                    endTime: '13:00',
                    isActive: true
                },
                {
                    subjectCode: 'CS503',
                    subjectName: 'Computer Networks',
                    faculty: 'Dr. Williams',
                    room: 'Room 205',
                    department: 'Computer Science',
                    semester: 5,
                    dayOfWeek: 3, // Wednesday
                    startTime: '14:00',
                    endTime: '15:00',
                    isActive: true
                },
                {
                    subjectCode: 'CS504',
                    subjectName: 'Software Engineering',
                    faculty: 'Dr. Brown',
                    room: 'Room 207',
                    department: 'Computer Science',
                    semester: 5,
                    dayOfWeek: 2, // Tuesday
                    startTime: '09:00',
                    endTime: '10:00',
                    isActive: true
                },
                {
                    subjectCode: 'CS505',
                    subjectName: 'Operating Systems',
                    faculty: 'Prof. Davis',
                    room: 'Room 209',
                    department: 'Computer Science',
                    semester: 5,
                    dayOfWeek: 4, // Thursday
                    startTime: '11:00',
                    endTime: '12:00',
                    isActive: true
                }
            ];
            
            await Class.insertMany(defaultClasses);
            console.log('Default classes created');
        }
    } catch (error) {
        console.error('Error initializing default classes:', error);
    }
};

// Start server
const startServer = async () => {
    try {
        await connectDB();
        await initializeDefaultAdmins();
        await initializeDefaultClasses();
        
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Advanced Attendance System server running on port ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        mongoose.connection.close(false, () => {
            console.log('MongoDB connection closed.');
            process.exit(0);
        });
    });
});

startServer();

module.exports = app;