/**
 * ui.js
 * This module handles all direct DOM manipulations and UI updates.
 * It is exported so other modules like app.js can use its functions.
 */
export const ui = {
    attendanceChart: null,

    showSection(sectionId) {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.section === sectionId);
        });
        document.querySelectorAll('.section').forEach(section => {
            section.classList.toggle('active', section.id === sectionId);
        });
    },

    toggleTheme() {
        const newTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        document.getElementById('themeToggle').textContent = newTheme === 'light' ? '🌙' : '☀️';
        localStorage.setItem('faceAttend_theme', newTheme);
    },

    showLoading(show, message = 'Loading...') {
        const overlay = document.getElementById('loadingOverlay');
        document.getElementById('loadingText').textContent = message;
        overlay.classList.toggle('show', show);
    },

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        setTimeout(() => toast.classList.remove('show'), 3000);
    },

    updateDashboard(state) {
        const { students, attendanceRecords } = state;
        document.getElementById('totalStudents').textContent = students.length;
        document.getElementById('totalSessions').textContent = attendanceRecords.length;

        const today = new Date().toISOString().split('T')[0];
        const todayAttendanceCount = attendanceRecords
            .filter(rec => rec.date === today)
            .reduce((count, rec) => count + rec.attendanceRecords.length, 0);
        document.getElementById('todayAttendance').textContent = todayAttendanceCount;
        
        const totalPossible = students.length * attendanceRecords.length;
        const totalPresent = attendanceRecords.reduce((sum, rec) => sum + rec.attendanceRecords.length, 0);
        const avg = totalPossible > 0 ? ((totalPresent / totalPossible) * 100).toFixed(0) : 0;
        document.getElementById('averageAttendance').textContent = `${avg}%`;
    },
    
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
                    <button class="btn btn-danger btn-small btn-remove-student" data-student-id="${s.id}">Remove</button>
                </div>
            </div>
        `).join('');
    },

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
                <span><strong>${rec.studentName}</strong> (${rec.studentId})</span>
                <span class="text-secondary">${new Date(rec.timestamp).toLocaleTimeString()}</span>
            </div>
        `).join('');
    },

    displayReportResults(reportData) {
        const container = document.getElementById('reportResults');
        if (reportData.length === 0) {
            container.innerHTML = `<p class="text-secondary">No records found for the selected filters.</p>`;
            this.renderChart([]);
            return;
        }
        container.innerHTML = `
            <table>
                <thead><tr><th>Date</th><th>Course</th><th>Student Name</th><th>Student ID</th><th>Time</th></tr></thead>
                <tbody>
                    ${reportData.map(rec => `
                        <tr>
                            <td>${rec.date}</td>
                            <td>${rec.course}</td>
                            <td>${rec.studentName}</td>
                            <td>${rec.studentId}</td>
                            <td>${new Date(rec.timestamp).toLocaleTimeString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        this.renderChart(reportData);
    },

    renderChart(reportData) {
        const ctx = document.getElementById('attendanceChart').getContext('2d');
        const dailyData = reportData.reduce((acc, rec) => {
            acc[rec.date] = (acc[rec.date] || 0) + 1;
            return acc;
        }, {});

        const labels = Object.keys(dailyData).sort();
        const data = labels.map(label => dailyData[label]);

        if (this.attendanceChart) this.attendanceChart.destroy();
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
            options: { responsive: true, maintainAspectRatio: true }
        });
    },

    refresh(state) {
        this.updateDashboard(state);
        this.displayRegisteredStudents(state.students);
        this.updateLiveAttendance(state.currentSession);
    },
};
