/**
 * app.js
 * The single source of truth for all application logic.
 * Contains the complete, final, and conflict-free initialization flow.
 */
import { dbHandler, adminListHandler } from './database.js';
import { ui } from './ui.js';
import { camera } from './camera.js';
import { face } from './face.js';

export const app = {
    state: {
        students: [],
        attendanceRecords: [],
        settings: {
            geminiApiKey: '',
            pythonAnywhereUrl: 'https://Kishan2269420.pythonanywhere.com'
        },
        currentSession: null,
        recognitionInterval: null,
        adminUser: null,
        listenersAttached: false,
        appStarted: false,
    },

    // This is the single entry point, called by index.html after Firebase is confirmed to be ready.
    init() {
        const auth = window.firebase.auth;
        
        // Always set up the login button listener.
        document.getElementById('login-btn').addEventListener('click', () => this.handleLogin());

        // This listener is the main gatekeeper of the app.
        window.firebase.onAuthStateChanged(auth, async (user) => {
            if (user) {
                // A user is signed in. We MUST verify they are an admin.
                const isAdmin = await adminListHandler.isAdmin(user.uid);
                if (isAdmin) {
                    // This user is on the admin list. Let them in.
                    this.state.adminUser = user;
                    this.showApp();
                    // Load their app data ONLY if it hasn't been loaded before.
                    if (!this.appStarted) {
                        this.appStarted = true;
                        await this.startAppData();
                    }
                } else {
                    // This user signed in but is NOT on the admin list.
                    // Show an error and sign them out immediately.
                    ui.showToast('This Google account is not authorized.', 'error');
                    window.firebase.signOut(auth);
                    this.showLogin();
                }
            } else {
                // No user is signed in. Show the login screen.
                this.appStarted = false; // Reset app state on logout
                this.showLogin();
            }
        });
    },

    // This function's only job is to handle a new login attempt.
    async handleLogin() {
        const provider = new window.firebase.GoogleAuthProvider();
        const auth = window.firebase.auth;
        const authStatus = document.getElementById('auth-status');
        authStatus.textContent = 'Opening Google Sign-in...';

        try {
            const result = await window.firebase.signInWithPopup(auth, provider);
            const user = result.user;
            authStatus.textContent = 'Verifying admin status...';
            
            // After a successful sign-in, the onAuthStateChanged listener will fire.
            // Our job here is to check if this is a NEW user and add them to the admin list if there's space.
            const admins = await adminListHandler.getAdmins();
            const isExistingAdmin = admins.some(admin => admin.uid === user.uid);

            if (isExistingAdmin) {
                // They are already an admin. onAuthStateChanged will let them in.
                authStatus.textContent = 'Welcome back!';
            } else if (admins.length < 10) {
                // This is a new user, and there is space. Add them to the list.
                authStatus.textContent = 'Registering new admin...';
                await adminListHandler.addAdmin(user);
                // Now that they're on the list, onAuthStateChanged will succeed.
            } else {
                // This is a new user, but the admin list is full.
                authStatus.textContent = 'Admin registration is full.';
                ui.showToast('The maximum number of admins has been reached.', 'error');
                await window.firebase.signOut(auth); // Immediately sign them out.
            }

        } catch (error) {
            if (error.code !== 'auth/popup-closed-by-user') {
                authStatus.textContent = `Login Failed: ${error.message}`;
                console.error("Login Error:", error);
            } else {
                authStatus.textContent = 'Login cancelled.';
            }
        }
    },
    
    showLogin() {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    },

    showApp() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
    },

    // This function loads all the necessary data for a verified admin.
    async startAppData() {
        if (!this.state.adminUser) return;
        ui.showLoading(true, "Loading admin data...");
        
        const data = await dbHandler.load(this.state.adminUser.uid);
        
        // Merge loaded data with defaults, preserving critical state
        const preservedState = {
            listenersAttached: this.state.listenersAttached,
            adminUser: this.state.adminUser,
            appStarted: this.state.appStarted
        };
        const defaultSettings = this.state.settings;

        this.state = { ...this.state, ...data, ...preservedState };
        this.state.settings = { ...defaultSettings, ...data.settings };
        
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
        document.getElementById('logout-btn').addEventListener('click', () => window.firebase.signOut(window.firebase.auth));
        document.getElementById('themeToggle').addEventListener('click', ui.toggleTheme);
        
        document.getElementById('startRegistrationCamera').addEventListener('click', this.startRegistrationCamera.bind(this));
        document.getElementById('capturePhoto').addEventListener('click', this.capturePhoto.bind(this));
        document.getElementById('registerStudent').addEventListener('click', this.registerStudent.bind(this));
        
        // Event delegation for remove buttons
        const studentList = document.getElementById('registeredStudentsList');
        if (studentList) {
            studentList.addEventListener('click', (e) => {
                if (e.target && e.target.classList.contains('btn-remove-student')) {
                    const studentId = e.target.dataset.studentId;
                    this.removeStudent(studentId);
                }
            });
        }
        
        document.getElementById('startSession').addEventListener('click', this.startSession.bind(this));
        document.getElementById('endSession').addEventListener('click', this.endSession.bind(this));
        document.getElementById('startAttendanceCamera').addEventListener('click', this.startAttendance.bind(this));
        document.getElementById('stopAttendanceCamera').addEventListener('click', this.stopAttendance.bind(this));
        document.getElementById('saveSettings').addEventListener('click', this.saveSettings.bind(this));
        document.getElementById('backupData').addEventListener('click', () => dbHandler.backup(this.state));
        document.getElementById('clearAllData').addEventListener('click', this.clearAllData.bind(this));
        document.getElementById('generateReport').addEventListener('click', () => {
             const results = this.filterReportData();
             ui.displayReportResults(results);
        });
    },

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
        
        const student = {
            id: document.getElementById('studentId').value.trim(),
            name: document.getElementById('studentName').value.trim(),
            course: document.getElementById('studentCourse').value,
            email: document.getElementById('studentEmail').value.trim(),
        };

        if (!student.id || !student.name) return ui.showToast('Student ID and Name are required.', 'error');
        if (this.state.students.some(s => s.id === student.id)) return ui.showToast('Student with this ID already exists.', 'error');

        ui.showLoading(true, 'Uploading photo...');
        const photoURL = await dbHandler.uploadImage(this.state.settings.pythonAnywhereUrl, student.id, this.tempPhotoData);
        if (!photoURL) {
            ui.showLoading(false);
            return ui.showToast('Could not upload photo to server.', 'error');
        }
        student.photoURL = photoURL;

        ui.showLoading(true, 'Creating face signature...');
        const img = new Image();
        img.crossOrigin = 'Anonymous'; // Required for loading images from another domain (PythonAnywhere)
        img.src = student.photoURL;
        img.onload = async () => {
            const descriptor = await face.getDescriptor(img);
            if (!descriptor) {
                ui.showLoading(false);
                return ui.showToast('Could not detect a face in the uploaded photo. Please try again with a clear, forward-facing picture.', 'error');
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
        img.onerror = () => {
             ui.showLoading(false);
             ui.showToast('Error loading student photo from the server for analysis.', 'error');
        }
    },
    
    async removeStudent(studentId) {
        if (confirm(`Are you sure you want to remove student ${studentId}? This is permanent.`)) {
            this.state.students = this.state.students.filter(s => s.id !== studentId);
            await dbHandler.deleteStudent(this.state.adminUser.uid, studentId);
            face.createMatcher(this.state.students);
            ui.refresh(this.state);
            ui.showToast('Student removed successfully.', 'success');
        }
    },

    startSession() {
        const course = document.getElementById('sessionCourse').value;
        if (!course) return ui.showToast('Please select a course.', 'warning');
        this.state.currentSession = { id: `session_${Date.now()}`, course, date: new Date().toISOString().slice(0,10), attendanceRecords: [] };
        document.getElementById('startSession').disabled = true;
        document.getElementById('endSession').disabled = false;
        document.getElementById('startAttendanceCamera').disabled = false;
        document.getElementById('sessionStatus').textContent = 'Session Active';
        ui.showToast(`Session for ${course} started.`, 'success');
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
        ui.showToast('Session ended and saved.', 'success');
    },
    
    async startAttendance() {
        if (!this.state.currentSession) return ui.showToast('Please start a session first.', 'warning');
        if (!face.faceMatcher) return ui.showToast('No registered students to match against.', 'warning');
        if (!await camera.start('attendanceVideo')) return;

        document.getElementById('startAttendanceCamera').disabled = true;
        document.getElementById('stopAttendanceCamera').disabled = false;
        
        this.state.recognitionInterval = setInterval(async () => {
            const videoEl = document.getElementById('attendanceVideo');
            if(!videoEl || !videoEl.srcObject) {
                this.stopAttendance();
                return;
            };
            const descriptor = await face.getDescriptor(videoEl);
            if (descriptor) {
                const match = face.findBestMatch(descriptor);
                document.getElementById('recognitionStatus').textContent = `Match Found: ${match.toString()}`;
                if (match && match.label !== 'unknown') {
                    const student = this.state.students.find(s => s.id === match.label);
                    const isMarked = this.state.currentSession.attendanceRecords.some(r => r.studentId === student.id);
                    if (student && !isMarked) {
                        this.state.currentSession.attendanceRecords.push({ studentId: student.id, studentName: student.name, timestamp: new Date().toISOString() });
                        ui.updateLiveAttendance(this.state.currentSession);
                        ui.showToast(`${student.name} marked present!`, 'success');
                    }
                }
            } else {
                document.getElementById('recognitionStatus').textContent = 'Scanning for faces...';
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
    
    filterReportData() {
        const course = document.getElementById('reportCourse').value;
        const studentId = document.getElementById('reportStudent').value;
        let results = [];
        this.state.attendanceRecords.forEach(session => {
            if (course && session.course !== course) return;
            session.attendanceRecords.forEach(rec => {
                if (!studentId || rec.studentId === studentId) {
                    results.push({ ...rec, course: session.course, date: session.date });
                }
            });
        });
        return results;
    },
    
    async saveSettings() {
        this.state.settings.geminiApiKey = document.getElementById('gemini-api-key').value;
        await dbHandler.save(this.state.adminUser.uid, this.state);
        ui.showToast('Settings saved.', 'success');
    },

    async clearAllData() {
        if (confirm('Are you absolutely sure you want to clear ALL student and attendance data? This action cannot be undone.')) {
            this.state.students = [];
            this.state.attendanceRecords = [];
            await dbHandler.save(this.state.adminUser.uid, this.state);
            face.createMatcher([]);
            ui.refresh(this.state);
            ui.showToast('All application data has been cleared.', 'success');
        }
    }
};
