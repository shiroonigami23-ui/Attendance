// Global variables
let faceApiLoaded = false;
let currentStream = null;
let registeredStudents = [];
let attendanceRecords = [];
let currentSession = null;
let recognitionInterval = null;
let theme = 'light';



// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing app...');
    initializeApp();
    loadFaceAPI();
    setupEventListeners();
    loadData();
    updateDashboard();
});
// Use maintained fork CDN for consistent weights
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/';

async function loadFaceAPI() {
  try {
    showLoading(true, 'Loading Face Recognition Models...');
    console.time('face-models');

    if (typeof faceapi === 'undefined') {
      throw new Error('face-api script not loaded');
    }

    // Load all required nets from the same base URL
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      // Optional extras, comment out if not used:
      // faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
      // faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
    ]);

    console.timeEnd('face-models');
    faceApiLoaded = true;
    updateSystemStatus('faceApiStatus', 'Ready', 'active');
    showToast('Face models loaded', 'success');
  } catch (err) {
    console.error('Model load error:', err);
    updateSystemStatus('faceApiStatus', 'Error', 'inactive');
    showToast('Failed to load face models. Check network/CDN.', 'error');
  } finally {
    showLoading(false);
  }
}
// Initialize application
function initializeApp() {
    console.log('Initializing app...');

    // Set current date and time for session
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().slice(0, 5);

    const sessionDate = document.getElementById('sessionDate');
    const sessionStartTime = document.getElementById('sessionStartTime');
    const reportDateFrom = document.getElementById('reportDateFrom');
    const reportDateTo = document.getElementById('reportDateTo');

    if (sessionDate) sessionDate.value = today;
    if (sessionStartTime) sessionStartTime.value = currentTime;
    if (reportDateFrom) reportDateFrom.value = today;
    if (reportDateTo) reportDateTo.value = today;

    // Initialize theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
}

// Load Face-API.js models
async function loadFaceAPI() {
    try {
        showLoading(true, 'Loading Face Recognition Models...');

        await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights'),
            faceapi.nets.faceLandmark68Net.loadFromUri('https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights'),
            faceapi.nets.faceRecognitionNet.loadFromUri('https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights'),
            faceapi.nets.faceExpressionNet.loadFromUri('https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights')
        ]);

        faceApiLoaded = true;
        updateSystemStatus('faceApiStatus', 'Ready', 'active');
        showToast('Face recognition models loaded successfully!', 'success');
        console.log('Face-API.js models loaded successfully');

    } catch (error) {
        console.error('Error loading Face-API.js models:', error);
        updateSystemStatus('faceApiStatus', 'Error', 'inactive');
        showToast('Failed to load face recognition models', 'error');
    } finally {
        showLoading(false);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const section = e.target.dataset.section;
            showSection(section);
        });
    });

    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);

    // Registration form
    document.getElementById('studentRegistrationForm').addEventListener('submit', handleStudentRegistration);

    // Camera controls
    document.getElementById('startRegistrationCamera').addEventListener('click', startRegistrationCamera);
    document.getElementById('capturePhoto').addEventListener('click', capturePhoto);
    document.getElementById('stopRegistrationCamera').addEventListener('click', stopRegistrationCamera);
    document.getElementById('registerStudent').addEventListener('click', registerStudent);

    // Session controls
    document.getElementById('startSession').addEventListener('click', startSession);
    document.getElementById('endSession').addEventListener('click', endSession);

    // Attendance camera controls
    document.getElementById('startAttendanceCamera').addEventListener('click', startAttendanceCamera);
    document.getElementById('stopAttendanceCamera').addEventListener('click', stopAttendanceCamera);

    // Report controls
    document.getElementById('generateReport').addEventListener('click', generateReport);
    document.getElementById('exportCSV').addEventListener('click', exportCSV);
    document.getElementById('exportJSON').addEventListener('click', exportJSON);

    // Admin controls
    document.getElementById('recognitionThreshold').addEventListener('input', updateThreshold);
    document.getElementById('saveSettings').addEventListener('click', saveSettings);
    document.getElementById('backupData').addEventListener('click', backupData);
    document.getElementById('restoreData').addEventListener('click', restoreData);
    document.getElementById('clearAllData').addEventListener('click', clearAllData);
    document.getElementById('restoreFile').addEventListener('change', handleRestoreFile);
}

// Show section
function showSection(sectionName) {
    // Update navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.section === sectionName) {
            btn.classList.add('active');
        }
    });

    // Show section
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });

    document.getElementById(sectionName).classList.add('active');

    // Section-specific initialization
    if (sectionName === 'reports') {
        populateReportStudents();
    } else if (sectionName === 'registration') {
        displayRegisteredStudents();
    }
}

// Theme management
function toggleTheme() {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
}

function setTheme(newTheme) {
    theme = newTheme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);

    const themeToggle = document.getElementById('themeToggle');
    themeToggle.textContent = theme === 'light' ? '🌙' : '☀️';
}

// Student registration
function handleStudentRegistration(e) {
    e.preventDefault();

    const studentId = document.getElementById('studentId').value;
    const studentName = document.getElementById('studentName').value;
    const studentCourse = document.getElementById('studentCourse').value;
    const studentSemester = document.getElementById('studentSemester').value;
    const studentEmail = document.getElementById('studentEmail').value;

    // Check if student ID already exists
    if (registeredStudents.some(student => student.id === studentId)) {
        showToast('Student ID already exists!', 'error');
        return;
    }

    // Store form data temporarily
    window.tempStudentData = {
        id: studentId,
        name: studentName,
        course: studentCourse,
        semester: studentSemester,
        email: studentEmail
    };

    showToast('Please capture student photo to complete registration', 'warning');
}

// Camera functions for registration
async function startRegistrationCamera() {
    try {
        if (!faceApiLoaded) {
            showToast('Face recognition models are still loading. Please wait.', 'warning');
            return;
        }

        const video = document.getElementById('registrationVideo');
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 640, height: 480 } 
        });

        video.srcObject = stream;
        currentStream = stream;

        document.getElementById('startRegistrationCamera').disabled = true;
        document.getElementById('capturePhoto').disabled = false;
        document.getElementById('stopRegistrationCamera').disabled = false;

        updateSystemStatus('cameraStatus', 'Active', 'active');
        showToast('Camera started successfully', 'success');

    } catch (error) {
        console.error('Error starting camera:', error);
        showToast('Failed to start camera. Please check permissions.', 'error');
        updateSystemStatus('cameraStatus', 'Error', 'inactive');
    }
}

async function capturePhoto() {
    const video = document.getElementById('registrationVideo');
    const canvas = document.getElementById('registrationCanvas');
    const context = canvas.getContext('2d');

    // Set canvas dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0);

    // Convert to image data
    const imageData = canvas.toDataURL('image/jpeg', 0.9);

    // Show preview
    const preview = document.getElementById('capturedPhotoPreview');
    const previewImage = document.getElementById('previewImage');

    previewImage.src = imageData;
    preview.style.display = 'block';

    // Store photo data
    window.tempPhotoData = imageData;

    document.getElementById('registerStudent').style.display = 'block';
    showToast('Photo captured! Click Register Student to complete.', 'success');
}

function stopRegistrationCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }

    document.getElementById('startRegistrationCamera').disabled = false;
    document.getElementById('capturePhoto').disabled = true;
    document.getElementById('stopRegistrationCamera').disabled = true;

    updateSystemStatus('cameraStatus', 'Inactive', 'inactive');
}

async function registerStudent() {
    if (!window.tempStudentData || !window.tempPhotoData) {
        showToast('Please fill the form and capture a photo first', 'error');
        return;
    }

    try {
        showLoading(true, 'Processing face data...');

        // Create image element for face detection
        const img = new Image();
        img.src = window.tempPhotoData;

        img.onload = async () => {
            try {
                // Detect face and get descriptor
                const detection = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
                    .withFaceLandmarks()
                    .withFaceDescriptor();

                if (!detection) {
                    showToast('No face detected in the photo. Please try again.', 'error');
                    showLoading(false);
                    return;
                }

                // Create student record
                const studentData = {
                    ...window.tempStudentData,
                    photo: window.tempPhotoData,
                    faceDescriptor: Array.from(detection.descriptor),
                    registeredAt: new Date().toISOString()
                };

                // Add to registered students
                registeredStudents.push(studentData);
                saveData();

                // Reset form
                document.getElementById('studentRegistrationForm').reset();
                document.getElementById('capturedPhotoPreview').style.display = 'none';
                document.getElementById('registerStudent').style.display = 'none';

                // Clear temp data
                window.tempStudentData = null;
                window.tempPhotoData = null;

                displayRegisteredStudents();
                updateDashboard();

                showToast(`Student ${studentData.name} registered successfully!`, 'success');

            } catch (error) {
                console.error('Error processing face:', error);
                showToast('Error processing face data. Please try again.', 'error');
            } finally {
                showLoading(false);
            }
        };

    } catch (error) {
        console.error('Error registering student:', error);
        showToast('Error registering student. Please try again.', 'error');
        showLoading(false);
    }
}

// Display registered students
function displayRegisteredStudents() {
    const container = document.getElementById('registeredStudentsList');

    if (registeredStudents.length === 0) {
        container.innerHTML = '<p class="text-secondary">No students registered yet.</p>';
        return;
    }

    container.innerHTML = registeredStudents.map(student => `
        <div class="student-card">
            <img src="${student.photo}" alt="${student.name}" class="student-photo">
            <div class="student-info">
                <h4>${student.name}</h4>
                <p><strong>ID:</strong> ${student.id}</p>
                <p><strong>Course:</strong> ${student.course}</p>
                <p><strong>Semester:</strong> ${student.semester}</p>
                <p><strong>Email:</strong> ${student.email}</p>
            </div>
            <div class="student-actions">
                <button class="btn btn-danger btn-small" onclick="removeStudent('${student.id}')">
                    Remove
                </button>
            </div>
        </div>
    `).join('');
}

// Remove student
function removeStudent(studentId) {
    if (confirm('Are you sure you want to remove this student?')) {
        registeredStudents = registeredStudents.filter(student => student.id !== studentId);
        saveData();
        displayRegisteredStudents();
        updateDashboard();
        showToast('Student removed successfully', 'success');
    }
}

// Session management
function startSession() {
    const course = document.getElementById('sessionCourse').value;
    const date = document.getElementById('sessionDate').value;
    const startTime = document.getElementById('sessionStartTime').value;
    const endTime = document.getElementById('sessionEndTime').value;

    if (!course || !date || !startTime || !endTime) {
        showToast('Please fill all session details', 'error');
        return;
    }

    if (registeredStudents.length === 0) {
        showToast('Please register students before starting a session', 'error');
        return;
    }

    currentSession = {
        id: 'SES' + Date.now(),
        course,
        date,
        startTime,
        endTime,
        createdAt: new Date().toISOString(),
        attendanceRecords: []
    };

    document.getElementById('startSession').disabled = true;
    document.getElementById('endSession').disabled = false;
    document.getElementById('startAttendanceCamera').disabled = false;

    document.getElementById('sessionStatus').textContent = 'Active Session';
    document.getElementById('sessionStatus').classList.add('active');

    updateLiveAttendance();
    showToast(`Session started for ${course}`, 'success');
}

function endSession() {
    if (currentSession) {
        // Save session to attendance records
        attendanceRecords.push(currentSession);
        saveData();

        // Reset UI
        document.getElementById('startSession').disabled = false;
        document.getElementById('endSession').disabled = true;
        document.getElementById('startAttendanceCamera').disabled = true;
        document.getElementById('stopAttendanceCamera').disabled = true;

        document.getElementById('sessionStatus').textContent = 'No Active Session';
        document.getElementById('sessionStatus').classList.remove('active');

        // Stop camera if running
        stopAttendanceCamera();

        showToast('Session ended successfully', 'success');
        currentSession = null;
        updateDashboard();
    }
}

// Attendance camera functions
async function startAttendanceCamera() {
    try {
        if (!faceApiLoaded) {
            showToast('Face recognition models are still loading', 'warning');
            return;
        }

        const video = document.getElementById('attendanceVideo');
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 640, height: 480 } 
        });

        video.srcObject = stream;
        currentStream = stream;

        document.getElementById('startAttendanceCamera').disabled = true;
        document.getElementById('stopAttendanceCamera').disabled = false;

        document.getElementById('recognitionStatus').textContent = 'Scanning...';

        // Start face recognition
        startFaceRecognition();

        updateSystemStatus('cameraStatus', 'Active', 'active');
        showToast('Attendance camera started', 'success');

    } catch (error) {
        console.error('Error starting attendance camera:', error);
        showToast('Failed to start camera', 'error');
    }
}

function stopAttendanceCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }

    if (recognitionInterval) {
        clearInterval(recognitionInterval);
        recognitionInterval = null;
    }

    document.getElementById('startAttendanceCamera').disabled = false;
    document.getElementById('stopAttendanceCamera').disabled = true;
    document.getElementById('recognitionStatus').textContent = 'Camera Inactive';

    updateSystemStatus('cameraStatus', 'Inactive', 'inactive');
}

// Face recognition for attendance
function startFaceRecognition() {
    const video = document.getElementById('attendanceVideo');

    recognitionInterval = setInterval(async () => {
        try {
            const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (detection) {
                document.getElementById('recognitionStatus').textContent = 'Face detected, matching...';

                // Find best match
                const match = findBestMatch(detection.descriptor);

                if (match.student && match.distance < 0.6) {
                    // Check if already marked present in current session
                    const alreadyPresent = currentSession.attendanceRecords.some(
                        record => record.studentId === match.student.id
                    );

                    if (!alreadyPresent) {
                        markAttendance(match.student);
                        document.getElementById('recognitionStatus').textContent = 
                            `✅ ${match.student.name} - Present`;

                        // Brief pause after successful recognition
                        setTimeout(() => {
                            if (recognitionInterval) {
                                document.getElementById('recognitionStatus').textContent = 'Scanning...';
                            }
                        }, 2000);
                    } else {
                        document.getElementById('recognitionStatus').textContent = 
                            `${match.student.name} - Already marked`;
                    }
                } else {
                    document.getElementById('recognitionStatus').textContent = 'Unknown face detected';
                }
            } else {
                document.getElementById('recognitionStatus').textContent = 'Scanning...';
            }

        } catch (error) {
            console.error('Recognition error:', error);
        }
    }, 1000);
}

// Find best matching student
function findBestMatch(faceDescriptor) {
    let bestMatch = { student: null, distance: 1 };

    registeredStudents.forEach(student => {
        if (student.faceDescriptor) {
            const distance = faceapi.euclideanDistance(faceDescriptor, student.faceDescriptor);
            if (distance < bestMatch.distance) {
                bestMatch = { student, distance };
            }
        }
    });

    return bestMatch;
}

// Mark attendance
function markAttendance(student) {
    const attendanceRecord = {
        studentId: student.id,
        studentName: student.name,
        timestamp: new Date().toISOString(),
        status: 'present'
    };

    currentSession.attendanceRecords.push(attendanceRecord);

    updateLiveAttendance();
    showToast(`${student.name} marked present!`, 'success');
}

// Update live attendance display
function updateLiveAttendance() {
    const container = document.getElementById('liveAttendanceList');
    const countElement = document.getElementById('attendanceCount');

    if (!currentSession || currentSession.attendanceRecords.length === 0) {
        container.innerHTML = '<p class="text-secondary">No attendance marked yet.</p>';
        countElement.textContent = '0';
        return;
    }

    countElement.textContent = currentSession.attendanceRecords.length;

    container.innerHTML = currentSession.attendanceRecords.map(record => `
        <div class="attendance-item">
            <div class="attendance-info">
                <div>
                    <strong>${record.studentName}</strong>
                    <div class="text-secondary">${record.studentId}</div>
                </div>
                <div class="text-secondary">
                    ${new Date(record.timestamp).toLocaleTimeString()}
                </div>
            </div>
            <div class="attendance-status present">Present</div>
        </div>
    `).join('');
}

// Reports
function populateReportStudents() {
    const select = document.getElementById('reportStudent');
    select.innerHTML = '<option value="">All Students</option>';

    registeredStudents.forEach(student => {
        select.innerHTML += `<option value="${student.id}">${student.name} (${student.id})</option>`;
    });
}

function generateReport() {
    const course = document.getElementById('reportCourse').value;
    const dateFrom = document.getElementById('reportDateFrom').value;
    const dateTo = document.getElementById('reportDateTo').value;
    const studentId = document.getElementById('reportStudent').value;

    let filteredRecords = attendanceRecords.filter(session => {
        const sessionDate = new Date(session.date);
        const fromDate = new Date(dateFrom);
        const toDate = new Date(dateTo);

        let matches = sessionDate >= fromDate && sessionDate <= toDate;

        if (course) {
            matches = matches && session.course === course;
        }

        return matches;
    });

    displayReportResults(filteredRecords, studentId);
}

function displayReportResults(sessions, studentFilter) {
    const container = document.getElementById('reportResults');

    if (sessions.length === 0) {
        container.innerHTML = '<p class="text-secondary">No sessions found for the selected criteria.</p>';
        return;
    }

    let reportData = [];

    sessions.forEach(session => {
        session.attendanceRecords.forEach(record => {
            if (!studentFilter || record.studentId === studentFilter) {
                reportData.push({
                    course: session.course,
                    date: session.date,
                    startTime: session.startTime,
                    studentId: record.studentId,
                    studentName: record.studentName,
                    timestamp: record.timestamp,
                    status: record.status
                });
            }
        });
    });

    if (reportData.length === 0) {
        container.innerHTML = '<p class="text-secondary">No attendance records found.</p>';
        return;
    }

    const table = `
        <table>
            <thead>
                <tr>
                    <th>Course</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Student ID</th>
                    <th>Student Name</th>
                    <th>Marked At</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${reportData.map(record => `
                    <tr>
                        <td>${record.course}</td>
                        <td>${record.date}</td>
                        <td>${record.startTime}</td>
                        <td>${record.studentId}</td>
                        <td>${record.studentName}</td>
                        <td>${new Date(record.timestamp).toLocaleString()}</td>
                        <td><span class="attendance-status ${record.status}">${record.status}</span></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    container.innerHTML = table;
}

// Export functions
function exportCSV() {
    const table = document.querySelector('#reportResults table');
    if (!table) {
        showToast('Generate a report first', 'warning');
        return;
    }

    let csv = [];
    const rows = table.querySelectorAll('tr');

    rows.forEach(row => {
        const cols = row.querySelectorAll('td, th');
        const rowData = Array.from(cols).map(col => col.textContent.trim());
        csv.push(rowData.join(','));
    });

    const csvContent = csv.join('\n');
    downloadFile(csvContent, 'attendance-report.csv', 'text/csv');
}

function exportJSON() {
    if (attendanceRecords.length === 0) {
        showToast('No data to export', 'warning');
        return;
    }

    const jsonContent = JSON.stringify(attendanceRecords, null, 2);
    downloadFile(jsonContent, 'attendance-data.json', 'application/json');
}

// Utility functions
function downloadFile(content, fileName, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`File ${fileName} downloaded successfully`, 'success');
}

// Admin functions
function updateThreshold() {
    const threshold = document.getElementById('recognitionThreshold').value;
    document.getElementById('thresholdValue').textContent = threshold;
}

function saveSettings() {
    const settings = {
        recognitionThreshold: document.getElementById('recognitionThreshold').value,
        sessionTimeout: document.getElementById('sessionTimeout').value,
        livenessDetection: document.getElementById('livenessDetection').checked
    };

    localStorage.setItem('faceAttendSettings', JSON.stringify(settings));
    showToast('Settings saved successfully', 'success');
}

function backupData() {
    const backupData = {
        students: registeredStudents,
        attendanceRecords: attendanceRecords,
        timestamp: new Date().toISOString()
    };

    const jsonContent = JSON.stringify(backupData, null, 2);
    downloadFile(jsonContent, `faceattend-backup-${Date.now()}.json`, 'application/json');
}

function restoreData() {
    document.getElementById('restoreFile').click();
}

function handleRestoreFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const data = JSON.parse(event.target.result);

            if (data.students && data.attendanceRecords) {
                registeredStudents = data.students;
                attendanceRecords = data.attendanceRecords;
                saveData();

                updateDashboard();
                displayRegisteredStudents();

                showToast('Data restored successfully', 'success');
            } else {
                showToast('Invalid backup file format', 'error');
            }
        } catch (error) {
            console.error('Error restoring data:', error);
            showToast('Error reading backup file', 'error');
        }
    };

    reader.readAsText(file);
}

function clearAllData() {
    if (confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
        registeredStudents = [];
        attendanceRecords = [];
        currentSession = null;

        localStorage.removeItem('faceAttendStudents');
        localStorage.removeItem('faceAttendRecords');

        updateDashboard();
        displayRegisteredStudents();

        showToast('All data cleared successfully', 'success');
    }
}

// Data persistence
function saveData() {
    localStorage.setItem('faceAttendStudents', JSON.stringify(registeredStudents));
    localStorage.setItem('faceAttendRecords', JSON.stringify(attendanceRecords));
    updateStorageUsage();
}

function loadData() {
    try {
        const studentsData = localStorage.getItem('faceAttendStudents');
        const recordsData = localStorage.getItem('faceAttendRecords');
        const settingsData = localStorage.getItem('faceAttendSettings');

        if (studentsData) {
            registeredStudents = JSON.parse(studentsData);
        }

        if (recordsData) {
            attendanceRecords = JSON.parse(recordsData);
        }

        if (settingsData) {
            const settings = JSON.parse(settingsData);
            document.getElementById('recognitionThreshold').value = settings.recognitionThreshold || 0.6;
            document.getElementById('sessionTimeout').value = settings.sessionTimeout || 60;
            document.getElementById('livenessDetection').checked = settings.livenessDetection !== false;
            updateThreshold();
        }

        updateStorageUsage();

    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Dashboard updates
function updateDashboard() {
    document.getElementById('totalStudents').textContent = registeredStudents.length;
    document.getElementById('totalSessions').textContent = currentSession ? 1 : 0;

    const today = new Date().toISOString().split('T')[0];
    const todayAttendance = attendanceRecords
        .filter(session => session.date === today)
        .reduce((total, session) => total + session.attendanceRecords.length, 0);

    document.getElementById('todayAttendance').textContent = todayAttendance;

    // Calculate average attendance
    if (attendanceRecords.length > 0 && registeredStudents.length > 0) {
        const totalAttendances = attendanceRecords.reduce(
            (total, session) => total + session.attendanceRecords.length, 0
        );
        const averagePercentage = ((totalAttendances / (attendanceRecords.length * registeredStudents.length)) * 100).toFixed(1);
        document.getElementById('averageAttendance').textContent = averagePercentage + '%';
    } else {
        document.getElementById('averageAttendance').textContent = '0%';
    }
}

// System status updates
function updateSystemStatus(elementId, status, statusClass) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = status;
        element.className = 'status-value ' + statusClass;
    }
}

function updateStorageUsage() {
    try {
        const studentsSize = JSON.stringify(registeredStudents).length;
        const recordsSize = JSON.stringify(attendanceRecords).length;
        const totalSize = studentsSize + recordsSize;

        const sizeInKB = (totalSize / 1024).toFixed(2);
        document.getElementById('storageUsage').textContent = sizeInKB + ' KB';
    } catch (error) {
        console.error('Error calculating storage usage:', error);
    }
}

// UI utilities
function showLoading(show, message = 'Loading...') {
    const overlay = document.getElementById('loadingOverlay');
    const text = document.getElementById('loadingText');

    if (show) {
        text.textContent = message;
        overlay.classList.add('show');
    } else {
        overlay.classList.remove('show');
    }
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');

    toastMessage.textContent = message;
    toast.className = 'toast ' + type;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Initialize demo data (for demonstration purposes)
function initializeDemoData() {
    if (registeredStudents.length === 0) {
        // Add sample students without face data for demo
        sampleStudents.forEach(student => {
            registeredStudents.push({
                ...student,
                photo: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMzIiIGN5PSIzMiIgcj0iMzIiIGZpbGw9IiNGM0Y0RjYiLz4KPGNpcmNsZSBjeD0iMzIiIGN5PSIyNCIgcj0iOCIgZmlsbD0iIzlDQTNBRiIvPgo8cGF0aCBkPSJNMTYgNTJDMTYgNDQgMjQgNDAgMzIgNDBTNDggNDQgNDggNTIiIGZpbGw9IiM5Q0EzQUYiLz4KPC9zdmc+',
                faceDescriptor: null,
                registeredAt: new Date().toISOString()
            });
        });
        saveData();
    }
}

// Load demo data on first run
setTimeout(() => {
    if (registeredStudents.length === 0) {
        initializeDemoData();
        displayRegisteredStudents();
        updateDashboard();
    }
}, 2000);
