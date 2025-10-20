/**
 * app.js
 * The main application controller. Manages state and orchestrates other modules.
 */

const app = {
    state: {
        students: [],
        attendanceRecords: [],
        settings: {
            recognitionThreshold: 0.6,
            sessionTimeout: 60,
            livenessDetection: true,
        },
        currentSession: null,
        recognitionInterval: null,
    },

    /**
     * Initializes the entire application.
     */
    async init() {
        // Load data and theme first
        const { students, attendanceRecords, settings } = db.load();
        this.state.students = students;
        this.state.attendanceRecords = attendanceRecords;
        this.state.settings = { ...this.state.settings, ...settings };
        const savedTheme = localStorage.getItem('faceAttend_theme');
        if (savedTheme) {
            document.documentElement.setAttribute('data-theme', savedTheme);
            document.getElementById('themeToggle').textContent = savedTheme === 'light' ? '🌙' : '☀️';
        }

        this.setupEventListeners();
        this.refreshUI();
        await face.loadModels();
        face.createMatcher(this.state.students, this.state.settings.recognitionThreshold);
        console.log("FaceAttend Initialized.");
    },

    /**
     * Binds all necessary event listeners.
     */
    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => 
            btn.addEventListener('click', () => ui.showSection(btn.dataset.section))
        );
        document.getElementById('themeToggle').addEventListener('click', ui.toggleTheme);
        
        // Registration
        document.getElementById('startRegistrationCamera').addEventListener('click', this.startRegistrationCamera.bind(this));
        document.getElementById('capturePhoto').addEventListener('click', this.capturePhoto.bind(this));
        document.getElementById('stopRegistrationCamera').addEventListener('click', this.stopRegistrationCamera.bind(this));
        document.getElementById('registerStudent').addEventListener('click', this.registerStudent.bind(this));

        // Attendance
        document.getElementById('startSession').addEventListener('click', this.startSession.bind(this));
        document.getElementById('endSession').addEventListener('click', this.endSession.bind(this));
        document.getElementById('startAttendanceCamera').addEventListener('click', this.startAttendance.bind(this));
        document.getElementById('stopAttendanceCamera').addEventListener('click', this.stopAttendance.bind(this));

        // Reports
        document.getElementById('generateReport').addEventListener('click', this.generateReport.bind(this));
        document.getElementById('exportCSV').addEventListener('click', this.exportCSV.bind(this));
        document.getElementById('exportJSON').addEventListener('click', this.exportJSON.bind(this));

        // Admin
        document.getElementById('recognitionThreshold').addEventListener('input', e => {
            document.getElementById('thresholdValue').textContent = e.target.value;
        });
        document.getElementById('saveSettings').addEventListener('click', this.saveSettings.bind(this));
        document.getElementById('backupData').addEventListener('click', () => db.backup(this.state));
        document.getElementById('restoreData').addEventListener('click', () => document.getElementById('restoreFile').click());
        document.getElementById('restoreFile').addEventListener('change', this.restoreData.bind(this));
        document.getElementById('clearAllData').addEventListener('click', this.clearAllData.bind(this));
    },

    /**
     * Refreshes all UI components with current state data.
     */
    refreshUI() {
        ui.refresh(this.state);
        // Also update admin settings inputs
        document.getElementById('recognitionThreshold').value = this.state.settings.recognitionThreshold;
        document.getElementById('thresholdValue').textContent = this.state.settings.recognitionThreshold;
        document.getElementById('sessionTimeout').value = this.state.settings.sessionTimeout;
        document.getElementById('livenessDetection').checked = this.state.settings.livenessDetection;
    },

    // --- REGISTRATION LOGIC ---
    async startRegistrationCamera() {
        const success = await camera.start('registrationVideo');
        if (success) {
            document.getElementById('startRegistrationCamera').disabled = true;
            document.getElementById('capturePhoto').disabled = false;
            document.getElementById('stopRegistrationCamera').disabled = false;
        }
    },

    stopRegistrationCamera() {
        camera.stop();
        document.getElementById('startRegistrationCamera').disabled = false;
        document.getElementById('capturePhoto').disabled = true;
        document.getElementById('stopRegistrationCamera').disabled = true;
    },

    capturePhoto() {
        const photoData = camera.capture('registrationVideo', 'registrationCanvas');
        if (photoData) {
            document.getElementById('previewImage').src = photoData;
            document.getElementById('capturedPhotoPreview').style.display = 'block';
            document.getElementById('registerStudent').style.display = 'block';
            this.tempPhotoData = photoData; // Store temporarily
        }
    },

    async registerStudent() {
        if (!this.tempPhotoData) {
            ui.showToast('Please capture a photo first.', 'warning');
            return;
        }
        const student = {
            id: document.getElementById('studentId').value,
            name: document.getElementById('studentName').value,
            course: document.getElementById('studentCourse').value,
            semester: document.getElementById('studentSemester').value,
            email: document.getElementById('studentEmail').value,
            photo: this.tempPhotoData,
        };
        if (!student.id || !student.name || !student.course) {
            ui.showToast('Please fill all required fields.', 'error');
            return;
        }
        if (this.state.students.some(s => s.id === student.id)) {
            ui.showToast('A student with this ID already exists.', 'error');
            return;
        }

        ui.showLoading(true, 'Analyzing face...');
        const img = new Image();
        img.src = student.photo;
        img.onload = async () => {
            const descriptor = await face.getDescriptor(img);
            if (!descriptor) {
                ui.showLoading(false);
                ui.showToast('Could not detect a face. Please try again with better lighting.', 'error');
                return;
            }
            student.faceDescriptor = descriptor;
            this.state.students.push(student);
            db.save(this.state);
            face.createMatcher(this.state.students, this.state.settings.recognitionThreshold);
            this.refreshUI();

            // Reset form
            document.getElementById('studentRegistrationForm').reset();
            document.getElementById('capturedPhotoPreview').style.display = 'none';
            document.getElementById('registerStudent').style.display = 'none';
            this.tempPhotoData = null;
            this.stopRegistrationCamera();
            ui.showLoading(false);
            ui.showToast('Student registered successfully!', 'success');
        };
    },

    removeStudent(studentId) {
        if (confirm(`Are you sure you want to remove student ${studentId}?`)) {
            this.state.students = this.state.students.filter(s => s.id !== studentId);
            db.save(this.state);
            face.createMatcher(this.state.students, this.state.settings.recognitionThreshold);
            this.refreshUI();
            ui.showToast('Student removed.', 'success');
        }
    },

    // --- ATTENDANCE LOGIC ---
    startSession() {
        const course = document.getElementById('sessionCourse').value;
        if (!course) { ui.showToast('Please select a course.', 'warning'); return; }

        this.state.currentSession = {
            course,
            date: document.getElementById('sessionDate').value,
            startTime: document.getElementById('sessionStartTime').value,
            endTime: document.getElementById('sessionEndTime').value,
            attendanceRecords: [],
        };

        document.getElementById('startSession').disabled = true;
        document.getElementById('endSession').disabled = false;
        document.getElementById('startAttendanceCamera').disabled = false;
        document.getElementById('sessionStatus').textContent = 'Session Active';
        document.getElementById('sessionStatus').classList.add('active');
        this.refreshUI();
    },

    endSession() {
        if (!this.state.currentSession) return;
        this.stopAttendance();
        this.state.attendanceRecords.push(this.state.currentSession);
        this.state.currentSession = null;
        db.save(this.state);
        
        document.getElementById('startSession').disabled = false;
        document.getElementById('endSession').disabled = true;
        document.getElementById('startAttendanceCamera').disabled = true;
        document.getElementById('sessionStatus').textContent = 'No Active Session';
        document.getElementById('sessionStatus').classList.remove('active');
        this.refreshUI();
        ui.showToast('Session ended and saved.', 'success');
    },

    async startAttendance() {
        const success = await camera.start('attendanceVideo');
        if (success) {
            document.getElementById('startAttendanceCamera').disabled = true;
            document.getElementById('stopAttendanceCamera').disabled = false;
            document.getElementById('recognitionStatus').textContent = 'Scanning...';

            this.state.recognitionInterval = setInterval(async () => {
                const videoEl = document.getElementById('attendanceVideo');
                const descriptor = await face.getDescriptor(videoEl);
                if (descriptor) {
                    const match = face.findBestMatch(descriptor);
                    if (match && match.label !== 'unknown') {
                        const student = this.state.students.find(s => s.id === match.label);
                        if (student) {
                            // Check if already marked
                            const isMarked = this.state.currentSession.attendanceRecords.some(r => r.studentId === student.id);
                            if (!isMarked) {
                                this.state.currentSession.attendanceRecords.push({
                                    studentId: student.id,
                                    studentName: student.name,
                                    timestamp: new Date().toISOString()
                                });
                                ui.updateLiveAttendance(this.state.currentSession);
                                document.getElementById('recognitionStatus').textContent = `✅ ${student.name}`;
                            } else {
                                document.getElementById('recognitionStatus').textContent = `${student.name} (Already Marked)`;
                            }
                        }
                    } else {
                        document.getElementById('recognitionStatus').textContent = 'Unknown Face';
                    }
                }
            }, 2000); // Scan every 2 seconds
        }
    },
    
    stopAttendance() {
        camera.stop();
        if (this.state.recognitionInterval) {
            clearInterval(this.state.recognitionInterval);
            this.state.recognitionInterval = null;
        }
        document.getElementById('startAttendanceCamera').disabled = false;
        document.getElementById('stopAttendanceCamera').disabled = true;
        document.getElementById('recognitionStatus').textContent = 'Camera Inactive';
    },

    // --- REPORTS & ADMIN LOGIC ---
    generateReport() {
        const course = document.getElementById('reportCourse').value;
        const from = document.getElementById('reportDateFrom').value;
        const to = document.getElementById('reportDateTo').value;
        const studentId = document.getElementById('reportStudent').value;
        
        let results = [];
        this.state.attendanceRecords.forEach(session => {
            // Filter session
            if ((course && session.course !== course) || (session.date < from) || (session.date > to)) {
                return;
            }
            // Filter records within session
            session.attendanceRecords.forEach(rec => {
                if (!studentId || rec.studentId === studentId) {
                    results.push({ ...rec, course: session.course, date: session.date });
                }
            });
        });
        ui.displayReportResults(results);
    },

    exportCSV() {
        const table = document.querySelector('#reportResults table');
        if (!table) { ui.showToast('Generate a report first.', 'warning'); return; }
        let csv = Array.from(table.querySelectorAll('tr')).map(tr => 
            Array.from(tr.querySelectorAll('th, td')).map(cell => `"${cell.textContent}"`).join(',')
        ).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        db.download(blob, 'report.csv');
    },

    exportJSON() {
        this.generateReport(); // First, filter data based on UI
        const reportData = ui.attendanceChart.data.datasets[0].data; // Get data from chart
        if (reportData.length === 0) { ui.showToast('No data to export.', 'warning'); return; }
        const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
        db.download(blob, 'report.json');
    },

    saveSettings() {
        this.state.settings = {
            recognitionThreshold: document.getElementById('recognitionThreshold').value,
            sessionTimeout: document.getElementById('sessionTimeout').value,
            livenessDetection: document.getElementById('livenessDetection').checked,
        };
        db.save(this.state);
        face.createMatcher(this.state.students, this.state.settings.recognitionThreshold); // Re-create matcher with new threshold
        ui.showToast('Settings saved successfully.', 'success');
    },

    async restoreData(event) {
        try {
            const data = await db.handleRestoreFile(event);
            this.state.students = data.students;
            this.state.attendanceRecords = data.attendanceRecords;
            this.state.settings = data.settings;
            db.save(this.state);
            face.createMatcher(this.state.students, this.state.settings.recognitionThreshold);
            this.refreshUI();
            ui.showToast('Data restored successfully!', 'success');
        } catch (error) {
            ui.showToast(error, 'error');
        }
    },

    clearAllData() {
        if (db.clearAll()) {
            this.state = { students: [], attendanceRecords: [], settings: {}, currentSession: null, recognitionInterval: null };
            face.createMatcher([]);
            this.refreshUI();
            ui.showToast('All application data has been cleared.', 'success');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());
