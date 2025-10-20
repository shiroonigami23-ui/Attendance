/**
 * app.js
 * The main application logic. It now exports the 'app' object and does not call init() itself.
 */
import { dbHandler, adminListHandler } from './database.js';
import { ui } from './ui.js';
import { camera } from './camera.js';
import { face } from './face.js';

// **THE FIX**: Export the app object so index.html can import and run it.
export const app = {
    state: {
        students: [],
        attendanceRecords: [],
        settings: { geminiApiKey: '' },
        currentSession: null,
        recognitionInterval: null,
        adminUser: null,
    },

    // **THE FIX**: This function is now called from index.html after Firebase is ready.
    init() {
        const auth = window.auth; // Guaranteed to exist now
        
        // Listen for authentication state changes
        window.onAuthStateChanged(auth, user => {
            if (user && user.isVerifiedAdmin) {
                this.state.adminUser = user;
                document.getElementById('login-screen').classList.add('hidden');
                document.getElementById('app-container').classList.remove('hidden');
                this.startApp();
            } else {
                this.state.adminUser = null;
                document.getElementById('login-screen').classList.remove('hidden');
                document.getElementById('app-container').classList.add('hidden');
                if (user) window.signOut(auth); // Sign out users who are not verified admins
            }
        });

        // Attach the login button click listener
        document.getElementById('login-btn').addEventListener('click', this.handleLogin.bind(this));
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
                user.isVerifiedAdmin = true; // This flag lets onAuthStateChanged know to grant access
            } else if (admins.length < 10) {
                await adminListHandler.addAdmin(user);
                user.isVerifiedAdmin = true;
            } else {
                authStatus.textContent = 'Login failed: Admin registration is closed.';
                ui.showToast('The maximum number of admins has been reached.', 'error');
                await window.signOut(auth);
            }
        } catch (error) {
            if (error.code !== 'auth/popup-closed-by-user') {
                authStatus.textContent = `Login Failed: ${error.message}`;
                console.error("Auth Error:", error);
            } else {
                authStatus.textContent = '';
            }
        }
    },
    
    async startApp() {
        if (!this.state.adminUser) return;
        ui.showLoading(true, "Loading your data...");
        const data = await dbHandler.load(this.state.adminUser.uid);
        this.state = { ...this.state, ...data };
        
        this.setupEventListeners();
        ui.refresh(this.state);
        document.getElementById('gemini-api-key').value = this.state.settings.geminiApiKey || '';
        document.getElementById('welcome-message').textContent = `Welcome, ${this.state.adminUser.displayName.split(' ')[0]}`;
        
        await face.loadModels();
        face.createMatcher(this.state.students);
        ui.showLoading(false);
    },

    setupEventListeners() {
        if (this.listenersAttached) return;
        this.listenersAttached = true;

        document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => ui.showSection(btn.dataset.section)));
        document.getElementById('logout-btn').addEventListener('click', () => window.signOut(window.auth));
        document.getElementById('themeToggle').addEventListener('click', ui.toggleTheme);
        
        document.getElementById('startRegistrationCamera').addEventListener('click', this.startRegistrationCamera.bind(this));
        document.getElementById('capturePhoto').addEventListener('click', this.capturePhoto.bind(this));
        document.getElementById('registerStudent').addEventListener('click', this.registerStudent.bind(this));
        
        document.getElementById('registeredStudentsList').addEventListener('click', (e) => {
            if (e.target.classList.contains('btn-remove-student')) {
                const studentId = e.target.dataset.studentId;
                this.removeStudent(studentId);
            }
        });
        
        document.getElementById('startSession').addEventListener('click', this.startSession.bind(this));
        document.getElementById('endSession').addEventListener('click', this.endSession.bind(this));
        document.getElementById('startAttendanceCamera').addEventListener('click', this.startAttendance.bind(this));
        document.getElementById('stopAttendanceCamera').addEventListener('click', this.stopAttendance.bind(this));

        document.getElementById('saveSettings').addEventListener('click', this.saveSettings.bind(this));
        document.getElementById('backupData').addEventListener('click', () => dbHandler.backup(this.state));
        document.getElementById('clearAllData').addEventListener('click', this.clearAllData.bind(this));
        document.getElementById('generateReport').addEventListener('click', () => ui.displayReportResults(this.state.attendanceRecords));
    },
    // The rest of the functions (startRegistrationCamera, registerStudent, etc.) are the same as before
    // No changes are needed below this line in this file.
    async startRegistrationCamera() {
        if (await camera.start('registrationVideo')) {
            document.getElementById('capturePhoto').disabled = false;
        }
    },

    capturePhoto() {
        const photoData = camera.capture('registrationVideo', 'registrationCanvas');
        if (photoData) {
            document.getElementById('previewImage').src = photoData;
            document.getElementById('capturedPhotoPreview').style.display = 'block';
            this.tempPhotoData = photoData;
        }
        camera.stop();
        document.getElementById('capturePhoto').disabled = true;
    },

    async registerStudent() {
        if (!this.tempPhotoData) return ui.showToast('Please capture a photo first.', 'warning');
        
        const qualityCheck = await face.analyzeImageQualityWithGemini(this.state.settings.geminiApiKey, this.tempPhotoData);
        if (!qualityCheck.success) return ui.showToast(`Photo rejected: ${qualityCheck.reason}`, 'error');
        
        const student = {
            id: document.getElementById('studentId').value.trim(),
            name: document.getElementById('studentName').value.trim(),
            course: document.getElementById('studentCourse').value,
            photo: this.tempPhotoData,
        };
        if (!student.id || !student.name) return ui.showToast('Student ID and Name are required.', 'error');
        if (this.state.students.some(s => s.id === student.id)) return ui.showToast('Student with this ID already exists.', 'error');

        ui.showLoading(true, 'Analyzing face...');
        const img = new Image();
        img.src = student.photo;
        img.onload = async () => {
            const descriptor = await face.getDescriptor(img);
            if (!descriptor) {
                ui.showLoading(false);
                return ui.showToast('Could not find a face in the photo. Please try again.', 'error');
            }
            
            student.faceDescriptor = Array.from(descriptor);
            this.state.students.push(student);
            await dbHandler.save(this.state.adminUser.uid, this.state);
            face.createMatcher(this.state.students);
            ui.refresh(this.state);
            
            document.getElementById('studentRegistrationForm').reset();
            document.getElementById('capturedPhotoPreview').style.display = 'none';
            this.tempPhotoData = null;
            ui.showLoading(false);
            ui.showToast('Student registered successfully!', 'success');
        };
    },
    
    async removeStudent(studentId) {
        if (confirm(`Are you sure you want to remove student ${studentId}?`)) {
            this.state.students = this.state.students.filter(s => s.id !== studentId);
            await dbHandler.deleteStudent(this.state.adminUser.uid, studentId);
            face.createMatcher(this.state.students);
            ui.refresh(this.state);
            ui.showToast('Student removed.', 'success');
        }
    },

    startSession() {
        const course = document.getElementById('sessionCourse').value;
        if (!course) return ui.showToast('Please select a course for the session.', 'warning');
        
        this.state.currentSession = {
            id: `session_${Date.now()}`,
            course: course,
            date: new Date().toISOString().slice(0,10),
            attendanceRecords: [],
        };
        
        document.getElementById('startSession').disabled = true;
        document.getElementById('endSession').disabled = false;
        document.getElementById('startAttendanceCamera').disabled = false;
        document.getElementById('sessionStatus').textContent = 'Session Active';
        ui.showToast('Session started.', 'success');
    },
    
    async endSession() {
        this.stopAttendance();
        if (this.state.currentSession && this.state.currentSession.attendanceRecords.length > 0) {
            this.state.attendanceRecords.push(this.state.currentSession);
            await dbHandler.save(this.state.adminUser.uid, this.state);
        }
        this.state.currentSession = null;
        
        document.getElementById('startSession').disabled = false;
        document.getElementById('endSession').disabled = true;
        document.getElementById('startAttendanceCamera').disabled = true;
        document.getElementById('sessionStatus').textContent = 'No Active Session';
        ui.updateLiveAttendance(null);
        ui.showToast('Session ended.', 'success');
    },
    
    async startAttendance() {
        if (!this.state.currentSession) return ui.showToast('You must start a session first.', 'warning');
        if (!face.faceMatcher) return ui.showToast('No students registered to match against.', 'warning');
        if (!await camera.start('attendanceVideo')) return;

        document.getElementById('startAttendanceCamera').disabled = true;
        document.getElementById('stopAttendanceCamera').disabled = false;
        
        this.state.recognitionInterval = setInterval(async () => {
            const videoEl = document.getElementById('attendanceVideo');
            if(!videoEl.srcObject) return; // Stop if camera was stopped
            const descriptor = await face.getDescriptor(videoEl);
            if (descriptor) {
                const match = face.findBestMatch(descriptor);
                document.getElementById('recognitionStatus').textContent = `Match: ${match.toString()}`;
                
                if (match && match.label !== 'unknown') {
                    const student = this.state.students.find(s => s.id === match.label);
                    const isMarked = this.state.currentSession.attendanceRecords.some(r => r.studentId === student.id);
                    if (student && !isMarked) {
                        this.state.currentSession.attendanceRecords.push({
                            studentId: student.id, studentName: student.name, timestamp: new Date().toISOString()
                        });
                        ui.updateLiveAttendance(this.state.currentSession);
                        ui.showToast(`${student.name} marked present!`, 'success');
                    }
                }
            } else {
                document.getElementById('recognitionStatus').textContent = 'Scanning...';
            }
        }, 2000);
    },

    stopAttendance() {
        camera.stop();
        if (this.state.recognitionInterval) clearInterval(this.state.recognitionInterval);
        this.state.recognitionInterval = null;
        document.getElementById('startAttendanceCamera').disabled = this.state.currentSession ? false : true;
        document.getElementById('stopAttendanceCamera').disabled = true;
        document.getElementById('recognitionStatus').textContent = 'Camera Inactive';
    },
    
    async saveSettings() {
        this.state.settings.geminiApiKey = document.getElementById('gemini-api-key').value;
        await dbHandler.save(this.state.adminUser.uid, this.state);
        ui.showToast('Settings have been saved.', 'success');
    },

    async clearAllData() {
        if (confirm('Are you sure you want to clear ALL student and attendance data? This action is permanent.')) {
            this.state.students = [];
            this.state.attendanceRecords = [];
            await dbHandler.save(this.state.adminUser.uid, this.state);
            face.createMatcher([]);
            ui.refresh(this.state);
            ui.showToast('All data has been cleared.', 'success');
        }
    }
};

// NOTE: app.init() is no longer called here. It is called from index.html
