/**
 * ui.js
 * Handles all direct DOM manipulations and UI updates.
 */

const ui = {
    attendanceChart: null,

    /**
     * Switches the visible section in the main container.
     * @param {string} sectionId - The ID of the section to show.
     */
    showSection(sectionId) {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.section === sectionId);
        });
        document.querySelectorAll('.section').forEach(section => {
            section.classList.toggle('active', section.id === sectionId);
        });

        // Trigger section-specific updates
        if (sectionId === 'reports' || sectionId === 'registration') {
            app.refreshUI();
        }
    },

    /**
     * Toggles the color theme.
     */
    toggleTheme() {
        const newTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        document.getElementById('themeToggle').textContent = newTheme === 'light' ? '🌙' : '☀️';
        localStorage.setItem('faceAttend_theme', newTheme);
    },

    /**
     * Displays or hides the loading overlay.
     * @param {boolean} show - True to show, false to hide.
     * @param {string} [message='Loading...'] - The message to display.
     */
    showLoading(show, message = 'Loading...') {
        const overlay = document.getElementById('loadingOverlay');
        document.getElementById('loadingText').textContent = message;
        overlay.classList.toggle('show', show);
    },

    /**
     * Shows a short-lived notification toast.
     * @param {string} message - The message for the toast.
     * @param {string} [type='info'] - The type ('success', 'error', 'warning', 'info').
     */
    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        setTimeout(() => toast.classList.remove('show'), 3000);
    },

    /**
     * Updates the dashboard stats.
     * @param {Object} state - The main application state.
     */
    updateDashboard(state) {
        const { students, currentSession, attendanceRecords } = state;
        document.getElementById('totalStudents').textContent = students.length;
        document.getElementById('totalSessions').textContent = currentSession ? 1 : 0;

        const today = new Date().toISOString().split('T')[0];
        const todayAttendance = attendanceRecords
            .filter(rec => rec.date === today)
            .reduce((count, rec) => count + rec.attendanceRecords.length, 0);
        document.getElementById('todayAttendance').textContent = todayAttendance;
        
        const totalPossible = students.length * attendanceRecords.length;
        const totalPresent = attendanceRecords.reduce((sum, rec) => sum + rec.attendanceRecords.length, 0);
        const avg = totalPossible > 0 ? ((totalPresent / totalPossible) * 100).toFixed(1) : 0;
        document.getElementById('averageAttendance').textContent = `${avg}%`;
    },

    /**
     * Renders the list of registered students.
     * @param {Array} students - The array of student objects.
     */
    displayRegisteredStudents(students) {
        const list = document.getElementById('registeredStudentsList');
        if (!students || students.length === 0) {
            list.innerHTML = `<p class="text-secondary">No students have been registered yet.</p>`;
            return;
        }
        list.innerHTML = students.map(s => `
            <div class="student-card">
                <img src="${s.photo}" alt="${s.name}" class="student-photo">
                <div class="student-info">
                    <h4>${s.name}</h4>
                    <p>${s.id} | ${s.course}</p>
                </div>
                <div class="student-actions">
                    <button class="btn btn-danger btn-small" onclick="app.removeStudent('${s.id}')">Remove</button>
                </div>
            </div>
        `).join('');
    },

    /**
     * Updates the live attendance list during a session.
     * @param {Object} session - The current session object.
     */
    updateLiveAttendance(session) {
        const list = document.getElementById('liveAttendanceList');
        const count = document.getElementById('attendanceCount');
        if (!session || !session.attendanceRecords || session.attendanceRecords.length === 0) {
            list.innerHTML = `<p class="text-secondary">Waiting for students...</p>`;
            count.textContent = '0';
            return;
        }
        count.textContent = session.attendanceRecords.length;
        list.innerHTML = session.attendanceRecords.map(rec => `
            <div class="attendance-item">
                <div class="attendance-info">
                    <strong>${rec.studentName}</strong>
                    <span class="text-secondary">${new Date(rec.timestamp).toLocaleTimeString()}</span>
                </div>
                <span class="attendance-status present">Present</span>
            </div>
        `).join('');
    },

    /**
     * Populates the student filter dropdown in the reports section.
     * @param {Array} students - The array of student objects.
     */
    populateReportFilters(students) {
        const select = document.getElementById('reportStudent');
        select.innerHTML = '<option value="">All Students</option>';
        students.forEach(s => {
            select.innerHTML += `<option value="${s.id}">${s.name} (${s.id})</option>`;
        });
    },

    /**
     * Displays the generated report in a table.
     * @param {Array} reportData - The filtered data for the report.
     */
    displayReportResults(reportData) {
        const container = document.getElementById('reportResults');
        if (reportData.length === 0) {
            container.innerHTML = `<p class="text-secondary">No records found for the selected filters.</p>`;
            this.renderChart([]);
            return;
        }
        container.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Date</th><th>Course</th><th>Student Name</th><th>Student ID</th><th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${reportData.map(rec => `
                        <tr>
                            <td>${rec.date}</td>
                            <td>${rec.course}</td>
                            <td>${rec.studentName}</td>
                            <td>${rec.studentId}</td>
                            <td><span class="attendance-status present">Present</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        this.renderChart(reportData);
    },

    /**
     * Renders or updates the attendance analytics chart.
     * @param {Array} reportData - The data to plot.
     */
    renderChart(reportData) {
        const ctx = document.getElementById('attendanceChart').getContext('2d');
        const dailyData = reportData.reduce((acc, rec) => {
            acc[rec.date] = (acc[rec.date] || 0) + 1;
            return acc;
        }, {});

        const labels = Object.keys(dailyData).sort();
        const data = labels.map(label => dailyData[label]);

        if (this.attendanceChart) {
            this.attendanceChart.destroy();
        }
        this.attendanceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Daily Attendance Count',
                    data: data,
                    borderColor: 'var(--primary-color)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true,
                    tension: 0.3
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    },

    /**
     * Updates all relevant UI elements based on the current state.
     * @param {Object} state - The main application state.
     */
    refresh(state) {
        this.updateDashboard(state);
        this.displayRegisteredStudents(state.students);
        this.populateReportFilters(state.students);
        this.updateLiveAttendance(state.currentSession);
    },
};
