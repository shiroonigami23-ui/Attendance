// database.js

/**
 * Initializes the database connection.
 * For this application, we will use localStorage as a simple database.
 * More robust solutions like IndexedDB could be used for larger applications.
 */
function initializeDB() {
    console.log('Database initialized (localStorage)');
}

/**
 * Saves all application data to localStorage.
 * @param {Array} students - The array of registered students.
 * @param {Array} records - The array of attendance records.
 * @param {Object} settings - The application settings.
 */
function saveData(students, records, settings) {
    try {
        localStorage.setItem('faceAttendStudents', JSON.stringify(students));
        localStorage.setItem('faceAttendRecords', JSON.stringify(records));
        localStorage.setItem('faceAttendSettings', JSON.stringify(settings));
        return true;
    } catch (error) {
        console.error('Error saving data:', error);
        return false;
    }
}

/**
 * Loads all application data from localStorage.
 * @returns {Object} An object containing students, records, and settings.
 */
function loadData() {
    try {
        const students = JSON.parse(localStorage.getItem('faceAttendStudents')) || [];
        const records = JSON.parse(localStorage.getItem('faceAttendRecords')) || [];
        const settings = JSON.parse(localStorage.getItem('faceAttendSettings')) || {};
        return { students, records, settings };
    } catch (error) {
        console.error('Error loading data:', error);
        return { students: [], records: [], settings: {} };
    }
}

/**
 * Clears all data from localStorage.
 */
function clearAllData() {
    if (confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
        try {
            localStorage.removeItem('faceAttendStudents');
            localStorage.removeItem('faceAttendRecords');
            localStorage.removeItem('faceAttendSettings');
            return true;
        } catch (error) {
            console.error('Error clearing data:', error);
            return false;
        }
    }
    return false;
}

/**
 * Exports data to a file.
 * @param {Object} data - The data to export.
 * @param {string} fileName - The name of the file.
 * @param {string} contentType - The MIME type of the file.
 */
function exportToFile(data, fileName, contentType) {
    const content = (contentType === 'application/json') ? JSON.stringify(data, null, 2) : data;
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Make functions available to other scripts
window.db = {
    initializeDB,
    saveData,
    loadData,
    clearAllData,
    exportToFile,
};
