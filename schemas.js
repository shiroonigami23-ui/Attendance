const mongoose = require('mongoose');
const { Schema } = mongoose;

// User (Student) Schema
const userSchema = new Schema({
    studentId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        uppercase: true,
        index: true
    },
    fullName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    department: {
        type: String,
        required: true,
        enum: ['Computer Science', 'Electronics', 'Mechanical', 'Civil', 'Electrical'],
        index: true
    },
    semester: {
        type: Number,
        required: true,
        min: 1,
        max: 8,
        index: true
    },
    deviceFingerprint: {
        type: String,
        unique: true,
        sparse: true, // Allows multiple null values
        index: true
    },
    registrationDate: {
        type: Date,
        default: Date.now,
        index: true
    },
    lastLogin: {
        type: Date,
        default: Date.now
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    phoneNumber: {
        type: String,
        trim: true,
        match: [/^[6-9]\d{9}$/, 'Please provide a valid phone number']
    },
    address: {
        type: String,
        trim: true,
        maxlength: 500
    },
    parentName: {
        type: String,
        trim: true,
        maxlength: 100
    },
    parentPhone: {
        type: String,
        trim: true,
        match: [/^[6-9]\d{9}$/, 'Please provide a valid parent phone number']
    },
    emergencyContact: {
        name: {
            type: String,
            trim: true,
            maxlength: 100
        },
        phone: {
            type: String,
            trim: true,
            match: [/^[6-9]\d{9}$/, 'Please provide a valid emergency contact number']
        },
        relation: {
            type: String,
            trim: true,
            maxlength: 50
        }
    },
    academicYear: {
        type: String,
        default: () => {
            const year = new Date().getFullYear();
            return `${year}-${year + 1}`;
        }
    },
    profilePicture: {
        type: String, // URL or base64 string
        default: null
    },
    attendancePreferences: {
        notifications: {
            type: Boolean,
            default: true
        },
        emailReminders: {
            type: Boolean,
            default: true
        },
        smsAlerts: {
            type: Boolean,
            default: false
        }
    },
    lastDeviceUpdate: {
        type: Date,
        default: Date.now
    },
    loginAttempts: {
        type: Number,
        default: 0
    },
    lockedUntil: {
        type: Date
    }
}, {
    timestamps: true,
    toJSON: {
        transform: function(doc, ret) {
            delete ret.password;
            delete ret.__v;
            return ret;
        }
    }
});

// Add compound indexes for better query performance
userSchema.index({ department: 1, semester: 1 });
userSchema.index({ registrationDate: -1 });
userSchema.index({ lastLogin: -1 });

// Virtual for full identification
userSchema.virtual('fullId').get(function() {
    return `${this.studentId} - ${this.fullName}`;
});

// Admin Schema
const adminSchema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        minlength: 3,
        maxlength: 30,
        index: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    fullName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
    },
    role: {
        type: String,
        enum: ['admin', 'super_admin'],
        default: 'admin',
        index: true
    },
    permissions: [{
        type: String,
        enum: [
            'view_students',
            'manage_students',
            'view_attendance',
            'manage_attendance',
            'view_classes',
            'manage_classes',
            'view_reports',
            'manage_admins',
            'system_settings',
            'backup_restore'
        ]
    }],
    department: {
        type: String,
        enum: ['Computer Science', 'Electronics', 'Mechanical', 'Civil', 'Electrical', 'Administration'],
        default: 'Administration'
    },
    deviceFingerprint: {
        type: String,
        index: true
    },
    lastLogin: {
        type: Date,
        default: Date.now
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'Admin'
    },
    phoneNumber: {
        type: String,
        trim: true,
        match: [/^[6-9]\d{9}$/, 'Please provide a valid phone number']
    },
    profilePicture: {
        type: String,
        default: null
    },
    loginAttempts: {
        type: Number,
        default: 0
    },
    lockedUntil: {
        type: Date
    },
    sessionExpiry: {
        type: Date
    }
}, {
    timestamps: true,
    toJSON: {
        transform: function(doc, ret) {
            delete ret.password;
            delete ret.__v;
            return ret;
        }
    }
});

// Add indexes for admin queries
adminSchema.index({ role: 1, isActive: 1 });
adminSchema.index({ lastLogin: -1 });

// Class Schema
const classSchema = new Schema({
    subjectCode: {
        type: String,
        required: true,
        uppercase: true,
        trim: true,
        index: true
    },
    subjectName: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    faculty: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    room: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50
    },
    building: {
        type: String,
        trim: true,
        maxlength: 100,
        default: 'Main Building'
    },
    department: {
        type: String,
        required: true,
        enum: ['Computer Science', 'Electronics', 'Mechanical', 'Civil', 'Electrical'],
        index: true
    },
    semester: {
        type: Number,
        required: true,
        min: 1,
        max: 8,
        index: true
    },
    section: {
        type: String,
        uppercase: true,
        trim: true,
        maxlength: 5,
        default: 'A'
    },
    dayOfWeek: {
        type: Number,
        required: true,
        min: 0, // Sunday
        max: 6, // Saturday
        index: true
    },
    startTime: {
        type: String,
        required: true,
        match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please provide time in HH:MM format']
    },
    endTime: {
        type: String,
        required: true,
        match: [/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please provide time in HH:MM format']
    },
    classType: {
        type: String,
        enum: ['theory', 'lab', 'tutorial', 'seminar'],
        default: 'theory',
        index: true
    },
    maxStudents: {
        type: Number,
        default: 60,
        min: 1,
        max: 200
    },
    enrolledStudents: [{
        studentId: {
            type: String,
            ref: 'User'
        },
        enrolledDate: {
            type: Date,
            default: Date.now
        }
    }],
    attendanceWindow: {
        beforeMinutes: {
            type: Number,
            default: 10,
            min: 0,
            max: 30
        },
        afterMinutes: {
            type: Number,
            default: 5,
            min: 0,
            max: 15
        }
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    isCancelled: {
        type: Boolean,
        default: false
    },
    cancellationReason: {
        type: String,
        trim: true,
        maxlength: 500
    },
    cancelledBy: {
        type: Schema.Types.ObjectId,
        ref: 'Admin'
    },
    cancelledAt: {
        type: Date
    },
    makeupClass: {
        date: Date,
        time: String,
        room: String,
        reason: String
    },
    academicYear: {
        type: String,
        default: () => {
            const year = new Date().getFullYear();
            return `${year}-${year + 1}`;
        }
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'Admin'
    },
    lastModifiedBy: {
        type: Schema.Types.ObjectId,
        ref: 'Admin'
    }
}, {
    timestamps: true
});

// Compound indexes for efficient querying
classSchema.index({ department: 1, semester: 1, dayOfWeek: 1 });
classSchema.index({ dayOfWeek: 1, startTime: 1 });
classSchema.index({ subjectCode: 1, academicYear: 1 });
classSchema.index({ faculty: 1, isActive: 1 });

// Virtual for class duration
classSchema.virtual('duration').get(function() {
    const start = this.startTime.split(':').map(Number);
    const end = this.endTime.split(':').map(Number);
    const startMinutes = start[0] * 60 + start[1];
    const endMinutes = end[0] * 60 + end[1];
    return endMinutes - startMinutes;
});

// Attendance Schema
const attendanceSchema = new Schema({
    studentId: {
        type: String,
        required: true,
        ref: 'User',
        index: true
    },
    classId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'Class',
        index: true
    },
    attendanceDate: {
        type: Date,
        required: true,
        index: true
    },
    status: {
        type: String,
        required: true,
        enum: ['present', 'absent', 'late', 'excused'],
        index: true
    },
    markedAt: {
        type: Date,
        default: Date.now
    },
    markedBy: {
        type: String,
        enum: ['student', 'admin', 'system'],
        default: 'student'
    },
    deviceFingerprint: {
        type: String,
        required: function() {
            return this.markedBy === 'student';
        }
    },
    ipAddress: {
        type: String,
        trim: true
    },
    location: {
        latitude: Number,
        longitude: Number,
        accuracy: Number
    },
    isValidated: {
        type: Boolean,
        default: false,
        index: true
    },
    validatedBy: {
        type: Schema.Types.ObjectId,
        ref: 'Admin'
    },
    validatedAt: {
        type: Date
    },
    notes: {
        type: String,
        trim: true,
        maxlength: 500
    },
    isLateEntry: {
        type: Boolean,
        default: false
    },
    minutesLate: {
        type: Number,
        default: 0,
        min: 0
    },
    proxyDetectionScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    flaggedForReview: {
        type: Boolean,
        default: false,
        index: true
    },
    reviewedBy: {
        type: Schema.Types.ObjectId,
        ref: 'Admin'
    },
    reviewedAt: {
        type: Date
    },
    reviewNotes: {
        type: String,
        trim: true,
        maxlength: 1000
    }
}, {
    timestamps: true
});

// Compound indexes for attendance queries
attendanceSchema.index({ studentId: 1, attendanceDate: -1 });
attendanceSchema.index({ classId: 1, attendanceDate: -1 });
attendanceSchema.index({ attendanceDate: -1, status: 1 });
attendanceSchema.index({ deviceFingerprint: 1, attendanceDate: -1 });
attendanceSchema.index({ flaggedForReview: 1, isValidated: 1 });

// Ensure unique attendance per student per class per day
attendanceSchema.index({ studentId: 1, classId: 1, attendanceDate: 1 }, { unique: true });

// Attendance Window Schema (for tracking when attendance is open)
const attendanceWindowSchema = new Schema({
    classId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'Class',
        index: true
    },
    date: {
        type: Date,
        required: true,
        index: true
    },
    openedAt: {
        type: Date,
        default: Date.now
    },
    closedAt: {
        type: Date
    },
    isOpen: {
        type: Boolean,
        default: true,
        index: true
    },
    openedBy: {
        type: Schema.Types.ObjectId,
        ref: 'Admin'
    },
    manuallyOpened: {
        type: Boolean,
        default: false
    },
    manuallyClosedBy: {
        type: Schema.Types.ObjectId,
        ref: 'Admin'
    },
    totalMarked: {
        type: Number,
        default: 0
    },
    studentsPresent: {
        type: Number,
        default: 0
    },
    studentsLate: {
        type: Number,
        default: 0
    },
    expectedStudents: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Compound index for window queries
attendanceWindowSchema.index({ classId: 1, date: 1 }, { unique: true });
attendanceWindowSchema.index({ isOpen: 1, date: -1 });

// Notification Schema
const notificationSchema = new Schema({
    recipientId: {
        type: String,
        required: true,
        index: true
    },
    recipientType: {
        type: String,
        required: true,
        enum: ['student', 'admin', 'all'],
        index: true
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    message: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000
    },
    type: {
        type: String,
        required: true,
        enum: ['attendance_reminder', 'class_cancelled', 'low_attendance', 'system_alert', 'general'],
        index: true
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium',
        index: true
    },
    isRead: {
        type: Boolean,
        default: false,
        index: true
    },
    readAt: {
        type: Date
    },
    relatedClass: {
        type: Schema.Types.ObjectId,
        ref: 'Class'
    },
    relatedAttendance: {
        type: Schema.Types.ObjectId,
        ref: 'Attendance'
    },
    actionRequired: {
        type: Boolean,
        default: false
    },
    actionUrl: {
        type: String,
        trim: true
    },
    expiresAt: {
        type: Date,
        index: { expireAfterSeconds: 0 }
    },
    sentVia: [{
        type: String,
        enum: ['web', 'email', 'sms', 'push']
    }],
    deliveryStatus: {
        web: { type: Boolean, default: false },
        email: { type: Boolean, default: false },
        sms: { type: Boolean, default: false },
        push: { type: Boolean, default: false }
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'Admin'
    }
}, {
    timestamps: true
});

// Indexes for notification queries
notificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ type: 1, priority: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 });

// Report Schema (for storing generated reports)
const reportSchema = new Schema({
    reportType: {
        type: String,
        required: true,
        enum: ['daily', 'weekly', 'monthly', 'semester', 'student_individual', 'class_wise', 'department_wise'],
        index: true
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    description: {
        type: String,
        trim: true,
        maxlength: 1000
    },
    filters: {
        department: String,
        semester: Number,
        studentId: String,
        classId: Schema.Types.ObjectId,
        dateFrom: Date,
        dateTo: Date,
        status: [String]
    },
    data: {
        type: Schema.Types.Mixed,
        required: true
    },
    summary: {
        totalRecords: Number,
        totalPresent: Number,
        totalAbsent: Number,
        totalLate: Number,
        attendancePercentage: Number,
        insights: [String]
    },
    generatedBy: {
        type: Schema.Types.ObjectId,
        ref: 'Admin',
        required: true
    },
    isPublic: {
        type: Boolean,
        default: false
    },
    fileUrl: {
        type: String // For storing PDF/Excel file URLs
    },
    format: {
        type: String,
        enum: ['json', 'pdf', 'excel', 'csv'],
        default: 'json'
    },
    status: {
        type: String,
        enum: ['generating', 'completed', 'failed'],
        default: 'generating',
        index: true
    },
    error: {
        type: String
    }
}, {
    timestamps: true
});

// Indexes for report queries
reportSchema.index({ reportType: 1, createdAt: -1 });
reportSchema.index({ generatedBy: 1, createdAt: -1 });
reportSchema.index({ status: 1, createdAt: -1 });

// System Settings Schema
const systemSettingsSchema = new Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    value: {
        type: Schema.Types.Mixed,
        required: true
    },
    description: {
        type: String,
        trim: true,
        maxlength: 500
    },
    category: {
        type: String,
        enum: ['attendance', 'security', 'notifications', 'general', 'ui'],
        default: 'general',
        index: true
    },
    isPublic: {
        type: Boolean,
        default: false
    },
    modifiedBy: {
        type: Schema.Types.ObjectId,
        ref: 'Admin'
    }
}, {
    timestamps: true
});

// Audit Log Schema (for tracking important system events)
const auditLogSchema = new Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    userType: {
        type: String,
        required: true,
        enum: ['student', 'admin', 'system'],
        index: true
    },
    action: {
        type: String,
        required: true,
        enum: [
            'login',
            'logout',
            'attendance_marked',
            'attendance_modified',
            'user_created',
            'user_modified',
            'user_deleted',
            'class_created',
            'class_modified',
            'class_deleted',
            'admin_created',
            'admin_modified',
            'settings_changed',
            'report_generated',
            'system_backup',
            'data_export'
        ],
        index: true
    },
    targetId: {
        type: String,
        index: true
    },
    targetType: {
        type: String,
        enum: ['user', 'admin', 'class', 'attendance', 'report', 'settings']
    },
    changes: {
        type: Schema.Types.Mixed
    },
    deviceFingerprint: {
        type: String
    },
    ipAddress: {
        type: String,
        trim: true
    },
    userAgent: {
        type: String,
        trim: true
    },
    success: {
        type: Boolean,
        default: true,
        index: true
    },
    errorMessage: {
        type: String,
        trim: true
    },
    metadata: {
        type: Schema.Types.Mixed
    }
}, {
    timestamps: true
});

// Indexes for audit log queries
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ targetId: 1, targetType: 1, createdAt: -1 });
auditLogSchema.index({ success: 1, createdAt: -1 });

// Create models
const User = mongoose.model('User', userSchema);
const Admin = mongoose.model('Admin', adminSchema);
const Class = mongoose.model('Class', classSchema);
const Attendance = mongoose.model('Attendance', attendanceSchema);
const AttendanceWindow = mongoose.model('AttendanceWindow', attendanceWindowSchema);
const Notification = mongoose.model('Notification', notificationSchema);
const Report = mongoose.model('Report', reportSchema);
const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);
const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = {
    User,
    Admin,
    Class,
    Attendance,
    AttendanceWindow,
    Notification,
    Report,
    SystemSettings,
    AuditLog
};