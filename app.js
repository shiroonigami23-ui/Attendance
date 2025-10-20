// app.js
import { dbHandler, adminListHandler } from './database.js';

const app = {
    state: {
        students: [],
        attendanceRecords: [],
        settings: {
            recognitionThreshold: 0.6,
            sessionTimeout: 60,
            livenessDetection: true,
            geminiApiKey: ''
        },
        currentSession: null,
        recognitionInterval: null,
        adminUser: null,
    },

    init() {
        document.addEventListener('firebase-ready', () => {
            const auth = window.auth;
            window.onAuthStateChanged(auth, user => {
                if (user && user.isVerifiedAdmin) { // Custom flag to ensure they passed our check
                    this.state.adminUser = user;
                    document.getElementById('login-screen').classList.add('hidden');
                    document.getElementById('app-container').classList.remove('hidden');
                    this.startApp();
                } else {
                    this.state.adminUser = null;
                    document.getElementById('login-screen').classList.remove('hidden');
                    document.getElementById('app-container').classList.add('hidden');
                     if (user) window.signOut(auth); // Sign out if they are not a verified admin
                }
            });

            document.getElementById('login-btn').addEventListener('click', this.handleLogin.bind(this));
        });
    },
    
    async handleLogin() {
        const provider = new window.GoogleAuthProvider();
        const auth = window.auth;
        const authStatus = document.getElementById('auth-status');
        authStatus.textContent = 'Opening Google Sign-in...';

        try {
            const result = await window.signInWithPopup(auth, provider);
            const user = result.user;
            authStatus.textContent = 'Verifying admin status...';

            const admins = await adminListHandler.getAdmins();
            const isExistingAdmin = admins.some(admin => admin.uid === user.uid);

            if (isExistingAdmin) {
                authStatus.textContent = `Welcome back, ${user.displayName}!`;
                user.isVerifiedAdmin = true; // Set flag to allow entry
                this.state.adminUser = user;
                this.startApp();

            } else if (admins.length < 10) {
                authStatus.textContent = 'Registering new admin account...';
                await adminListHandler.addAdmin(user);
                authStatus.textContent = `Welcome, ${user.displayName}! Registration successful.`;
                user.isVerifiedAdmin = true; // Set flag to allow entry
                this.state.adminUser = user;
                this.startApp();

            } else {
                authStatus.textContent = 'Login failed: Admin registration is closed.';
                ui.showToast('The maximum number of admins (10) has been reached.', 'error');
                await window.signOut(auth);
            }

        } catch (error) {
            console.error("Authentication Error:", error);
            if (error.code !== 'auth/popup-closed-by-user') {
               authStatus.textContent = `Login Failed: ${error.message}`;
            } else {
               authStatus.textContent = '';
            }
        }
    },
    
    async startApp() {
        if (!this.state.adminUser) return;
        ui.showLoading(true, "Loading admin data...");
        const { students, attendanceRecords, settings } = await dbHandler.load(this.state.adminUser.uid);
        this.state.students = students;
        this.state.attendanceRecords = attendanceRecords;
        this.state.settings = { ...this.state.settings, ...settings };
        
        this.setupMainAppEventListeners();
        this.refreshUI();
        await face.loadModels();
        face.createMatcher(this.state.students, this.state.settings.recognitionThreshold);
        ui.showLoading(false);
        console.log("FaceAttend Initialized and running for admin:", this.state.adminUser.email);
    },

    setupMainAppEventListeners() {
        if(this.listenersAttached) return; // Prevent re-attaching listeners
        this.listenersAttached = true;

        document.getElementById('logout-btn').addEventListener('click', () => window.signOut(window.auth));
        document.querySelectorAll('.nav-btn').forEach(btn => 
            btn.addEventListener('click', () => ui.showSection(btn.dataset.section))
        );
        document.getElementById('themeToggle').addEventListener('click', ui.toggleTheme);
        document.getElementById('startRegistrationCamera').addEventListener('click', this.startRegistrationCamera.bind(this));
        document.getElementById('capturePhoto').addEventListener('click', this.capturePhoto.bind(this));
        document.getElementById('stopRegistrationCamera').addEventListener('click', this.stopRegistrationCamera.bind(this));
        document.getElementById('registerStudent').addEventListener('click', this.registerStudent.bind(this));
        document.getElementById('startSession').addEventListener('click', this.startSession.bind(this));
        document.getElementById('endSession').addEventListener('click', this.endSession.bind(this));
        document.getElementById('startAttendanceCamera').addEventListener('click', this.startAttendance.bind(this));
        document.getElementById('stopAttendanceCamera').addEventListener('click', this.stopAttendance.bind(this));
        document.getElementById('generateReport').addEventListener('click', this.generateReport.bind(this));
        document.getElementById('exportCSV').addEventListener('click', this.exportCSV.bind(this));
        document.getElementById('exportJSON').addEventListener('click', this.exportJSON.bind(this));
        document.getElementById('recognitionThreshold').addEventListener('input', e => {
            document.getElementById('thresholdValue').textContent = e.target.value;
        });
        document.getElementById('saveSettings').addEventListener('click', this.saveSettings.bind(this));
        document.getElementById('backupData').addEventListener('click', () => dbHandler.backup(this.state));
        document.getElementById('restoreData').addEventListener('click', () => document.getElementById('restoreFile').click());
        document.getElementById('restoreFile').addEventListener('change', this.restoreData.bind(this));
        document.getElementById('clearAllData').addEventListener('click', this.clearAllData.bind(this));
    },

    refreshUI() {
        if (!this.state.adminUser) return;
        ui.refresh(this.state);
        document.getElementById('welcome-message').textContent = `Welcome, ${this.state.adminUser.displayName.split(' ')[0]}`;
        document.getElementById('gemini-api-key').value = this.state.settings.geminiApiKey || '';
        document.getElementById('recognitionThreshold').value = this.state.settings.recognitionThreshold;
        document.getElementById('thresholdValue').textContent = this.state.settings.recognitionThreshold;
        document.getElementById('sessionTimeout').value = this.state.settings.sessionTimeout;
        document.getElementById('livenessDetection').checked = this.state.settings.livenessDetection;
    },

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
        document.getElementById('capturedPhotoPreview').style.display = 'none';
        document.getElementById('registerStudent').style.display = 'none';
        this.tempPhotoData = null;
    },

    capturePhoto() {
        const photoData = camera.capture('registrationVideo', 'registrationCanvas');
        if (photoData) {
            document.getElementById('previewImage').src = photoData;
            document.getElementById('capturedPhotoPreview').style.display = 'block';
            document.getElementById('registerStudent').style.display = 'block';
            this.tempPhotoData = photoData;
        }
    },

    async registerStudent() {
        if (!this.tempPhotoData) {
            ui.showToast('Please capture a photo first.', 'warning');
            return;
        }

        const qualityCheck = await face.analyzeImageQualityWithGemini(this.state.settings.geminiApiKey, this.tempPhotoData);
        if (!qualityCheck.success) {
            ui.showToast(`Photo rejected: ${qualityCheck.reason}`, 'error');
            return;
        }
        ui.showToast(`AI Quality Check: ${qualityCheck.reason}`, 'success');

        const student = {
            id: document.getElementById('studentId').value,
            name: document.getElementById('studentName').value,
            course: document.getElementById('studentCourse').value,
            semester: document.getElementById('studentSemester').value,
            email: document.getElementById('studentEmail').value,
            photo: this.tempPhotoData,
        };

        if (!student.id || !student.name || !student.course) {
            ui.showToast('Please fill all required student fields.', 'error');
            return;
        }
        if (this.state.students.some(s => s.id === student.id)) {
            ui.showToast('A student with this ID already exists.', 'error');
            return;
        }

        ui.showLoading(true, 'Creating face signature...');
        const img = new Image();
        img.src = student.photo;
        img.onload = async () => {
            const descriptor = await face.getDescriptor(img);
            if (!descriptor) {
                ui.showLoading(false);
                ui.showToast('Could not create face signature. Please try another photo.', 'error');
                return;
            }
            student.faceDescriptor = Array.from(descriptor);
            this.state.students.push(student);
            
            await dbHandler.save(this.state.adminUser.uid, this.state);
            face.createMatcher(this.state.students, this.state.settings.recognitionThreshold);
            this.refreshUI();

            document.getElementById('studentRegistrationForm').reset();
            this.stopRegistrationCamera();
            ui.showLoading(false);
            ui.showToast('Student registered successfully!', 'success');
        };
    },

    async removeStudent(studentId) {
        if (confirm(`Are you sure you want to remove student ${studentId}? This is permanent.`)) {
            this.state.students = this.state.students.filter(s => s.id !== studentId);
            await dbHandler.deleteStudent(this.state.adminUser.uid, studentId);
            face.createMatcher(this.state.students, this.state.settings.recognitionThreshold);
            this.refreshUI();
            ui.showToast('Student removed from database.', 'success');
        }
    },
    
    startSession() {
        const course = document.getElementById('sessionCourse').value;
        if (!course) { ui.showToast('Please select a course.', 'warning'); return; }

        this.state.currentSession = {
            id: `session_${Date.now()}`,
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
        ui.showToast(`Session for ${course} started.`, 'success');
    },

    async endSession() {
        if (!this.state.currentSession) return;
        this.stopAttendance();
        this.state.attendanceRecords.push(this.state.currentSession);
        
        await dbHandler.save(this.state.adminUser.uid, this.state);
        this.state.currentSession = null;
        
        document.getElementById('startSession').disabled = false;
        document.getElementById('endSession').disabled = true;
        document.getElementById('startAttendanceCamera').disabled = true;
        document.getElementById('sessionStatus').textContent = 'No Active Session';
        document.getElementById('sessionStatus').classList.remove('active');
        this.refreshUI();
        ui.showToast('Session ended and saved to database.', 'success');
    },

    async startAttendance() {
        const success = await camera.start('attendanceVideo');
        if (success) {
            document.getElementById('startAttendanceCamera').disabled = true;
            document.getElementById('stopAttendanceCamera').disabled = false;
            document.getElementById('recognitionStatus').textContent = 'Scanning...';

            this.state.recognitionInterval = setInterval(async () => {
                const videoEl = document.getElementById('attendanceVideo');
                if (!videoEl || videoEl.paused || videoEl.ended) {
                    this.stopAttendance();
                    return;
                }
                const descriptor = await face.getDescriptor(videoEl);
                if (descriptor) {
                    const match = face.findBestMatch(descriptor);
                    if (match && match.label !== 'unknown') {
                        const student = this.state.students.find(s => s.id === match.label);
                        if (student && this.state.currentSession) {
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
            }, 2000);
        }
    },
    
    stopAttendance() {
        camera.stop();
        if (this.state.recognitionInterval) {
            clearInterval(this.state.recognitionInterval);
            this.state.recognitionInterval = null;
        }
        const startBtn = document.getElementById('startAttendanceCamera');
        if (startBtn) {
            startBtn.disabled = this.state.currentSession ? false : true;
            document.getElementById('stopAttendanceCamera').disabled = true;
            document.getElementById('recognitionStatus').textContent = 'Camera Inactive';
        }
    },

    generateReport() {
        const course = document.getElementById('reportCourse').value;
        const from = document.getElementById('reportDateFrom').value || '1970-01-01';
        const to = document.getElementById('reportDateTo').value || '2999-12-31';
        const studentId = document.getElementById('reportStudent').value;
        
        let results = [];
        this.state.attendanceRecords.forEach(session => {
            if ((course && session.course !== course) || (session.date < from) || (session.date > to)) {
                return;
            }
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
        dbHandler.download(blob, 'report.csv');
    },

    exportJSON() {
        this.generateReport();
        const table = document.querySelector('#reportResults table');
        if (!table) { ui.showToast('Generate a report first to export.', 'warning'); return; }
        
        const course = document.getElementById('reportCourse').value;
        const from = document.getElementById('reportDateFrom').value || '1970-01-01';
        const to = document.getElementById('reportDateTo').value || '2999-12-31';
        const studentId = document.getElementById('reportStudent').value;
        let results = [];
        this.state.attendanceRecords.forEach(session => {
            if ((course && session.course !== course) || (session.date < from) || (session.date > to)) {
                return;
            }
            session.attendanceRecords.forEach(rec => {
                if (!studentId || rec.studentId === studentId) {
                    results.push({ ...rec, course: session.course, date: session.date });
                }
            });
        });

        if (results.length === 0) { ui.showToast('No data to export.', 'warning'); return; }
        const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
        dbHandler.download(blob, 'report.json');
    },
    
    async saveSettings() {
        this.state.settings.geminiApiKey = document.getElementById('gemini-api-key').value;
        this.state.settings.recognitionThreshold = document.getElementById('recognitionThreshold').value;
        this.state.settings.sessionTimeout = document.getElementById('sessionTimeout').value;
        this.state.settings.livenessDetection = document.getElementById('livenessDetection').checked;
        
        await dbHandler.save(this.state.adminUser.uid, this.state);
        face.createMatcher(this.state.students, this.state.settings.recognitionThreshold);
        ui.showToast('Settings saved to database.', 'success');
    },

    async restoreData(event) {
        if (!confirm("This will overwrite your current cloud data with the contents of the backup file. This cannot be undone. Are you sure?")) {
            event.target.value = '';
            return;
        }
        
        try {
            const fileReader = new Promise((resolve, reject) => {
                const file = event.target.files[0];
                if (!file) { reject('No file selected.'); return; }
                const reader = new FileReader();
                reader.onload = e => resolve(JSON.parse(e.target.result));
                reader.onerror = () => reject('Error reading file.');
                reader.readAsText(file);
            });
            const data = await fileReader;
            
            if (!data.students || !data.attendanceRecords || !data.settings) {
                throw new Error("Invalid backup file format.");
  }

            this.state.students = data.students;
            this.state.attendanceRecords = data.attendanceRecords;
            this.state.settings = data.settings;
            await dbHandler.save(this.state.adminUser.uid, this.state);
            face.createMatcher(this.state.students, this.state.settings.recognitionThreshold);
            this.refreshUI();
            ui.showToast('Data restored and saved to cloud!', 'success');
        } catch (error) {
            ui.showToast(error.message || 'Failed to restore data.', 'error');
        } finally {
            event.target.value = '';
        }
    },

    async clearAllData() {
        if (confirm('Are you sure you want to clear ALL student and attendance data from the cloud? This is permanent.')) {
            this.state.students = [];
            this.state.attendanceRecords = [];
            await dbHandler.save(this.state.adminUser.uid, this.state);
            face.createMatcher([]);
            this.refreshUI();
            ui.showToast('All cloud data has been cleared.', 'success');
        }
    }
};

app.init();
