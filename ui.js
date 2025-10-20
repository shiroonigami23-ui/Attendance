// ui.js

/**
 * Shows a specific section and hides others.
 * @param {string} sectionName - The name of the section to show.
 */
function showSection(sectionName) {
    // Update navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.section === sectionName);
    });

    // Show section
    document.querySelectorAll('.section').forEach(section => {
        section.classList.toggle('active', section.id === sectionName);
    });
}

/**
 * Toggles the theme between light and dark.
 */
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    document.getElementById('themeToggle').textContent = newTheme === 'light' ? '🌙' : '☀️';
}

/**
 * Shows or hides the loading overlay.
 * @param {boolean} show - Whether to show the overlay.
 * @param {string} [message='Loading...'] - The message to display.
 */
function showLoading(show, message = 'Loading...') {
    const overlay = document.getElementById('loadingOverlay');
    document.getElementById('loadingText').textContent = message;
    overlay.classList.toggle('show', show);
}

/**
 * Shows a toast notification.
 * @param {string} message - The message to display.
 * @param {string} [type='info'] - The type of toast (info, success, error, warning).
 */
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');

    toastMessage.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

/**
 * Updates the system status indicators in the admin panel.
 * @param {string} elementId - The ID of the status element.
 * @param {string} status - The status text.
 * @param {string} statusClass - The class for styling the status.
 */
function updateSystemStatus(elementId, status, statusClass) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = status;
        element.className = `status-value ${statusClass}`;
    }
}

/**
 * Updates the dashboard with the latest statistics.
 * @param {Array} students - The array of registered students.
 * @param {Object} session - The current attendance session.
 * @param {Array} records - The array of all attendance records.
 */
function updateDashboard(students, session, records) {
    document.getElementById('totalStudents').textContent = students.length;
    document.getElementById('totalSessions').textContent = session ? 1 : 0;

    const today = new Date().toISOString().split('T')[0];
    const todayAttendance = records
        .filter(rec => rec.date === today)
        .reduce((total, rec) => total + (rec.attendanceRecords ? rec.attendanceRecords.length : 0), 0);

    document.getElementById('todayAttendance').textContent = todayAttendance;

    if (records.length > 0 && students.length > 0) {
        const totalPossibleAttendances = records.length * students.length;
        const totalActualAttendances = records.reduce((total, rec) => total + (rec.attendanceRecords ? rec.attendanceRecords.length : 0), 0);
        const averagePercentage = totalPossibleAttendances > 0 ? ((totalActualAttendances / totalPossibleAttendances) * 100).toFixed(1) : 0;
        document.getElementById('averageAttendance').textContent = `${averagePercentage}%`;
    } else {
        document.getElementById('averageAttendance').textContent = '0%';
    }
}

/**
 * Displays the list of registered students.
 * @param {Array} students - The array of registered students.
 */
function displayRegisteredStudents(students) {
    const container = document.getElementById('registeredStudentsList');
    if (students.length === 0) {
        container.innerHTML = '<p class="text-secondary">No students registered yet.</p>';
        return;
    }

    container.innerHTML = students.map(student => `
        <div class="student-card">
            <img src="${student.photo}" alt="${student.name}" class="student-photo">
            <div class="student-info">
                <h4>${student.name}</h4>
                <p><strong>ID:</strong> ${student.id}</p>
                <p><strong>Course:</strong> ${student.course}</p>
            </div>
            <div class="student-actions">
                <button class="btn btn-danger btn-small" onclick="app.removeStudent('${student.id}')">Remove</button>
            </div>
        </div>
    `).join('');
}


/**
 * Updates the live attendance list for the current session.
 * @param {Object} session - The current attendance session.
 */
function updateLiveAttendance(session) {
    const container = document.getElementById('liveAttendanceList');
    const countElement = document.getElementById('attendanceCount');

    if (!session || !session.attendanceRecords || session.attendanceRecords.length === 0) {
        container.innerHTML = '<p class="text-secondary">No attendance marked yet.</p>';
        countElement.textContent = '0';
        return;
    }

    countElement.textContent = session.attendanceRecords.length;
    container.innerHTML = session.attendanceRecords
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .map(record => `
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


// Make UI functions available globally
window.ui = {
    showSection,
    toggleTheme,
    showLoading,
    showToast,
    updateSystemStatus,
    updateDashboard,
    displayRegisteredStudents,
    updateLiveAttendance,
};
