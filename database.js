/**
 * database.js
 * Handles all interactions with localStorage for data persistence.
 */

const db = {
    /**
     * Saves the entire application state to localStorage.
     * @param {Object} state - The application state object.
     */
    save(state) {
        try {
            localStorage.setItem('faceAttend_students', JSON.stringify(state.students));
            localStorage.setItem('faceAttend_records', JSON.stringify(state.attendanceRecords));
            localStorage.setItem('faceAttend_settings', JSON.stringify(state.settings));
        } catch (error) {
            console.error("Error saving data to localStorage:", error);
            ui.showToast("Could not save data.", "error");
        }
    },

    /**
     * Loads the application state from localStorage.
     * @returns {Object} The loaded state (students, records, settings).
     */
    load() {
        try {
            const students = JSON.parse(localStorage.getItem('faceAttend_students')) || [];
            const attendanceRecords = JSON.parse(localStorage.getItem('faceAttend_records')) || [];
            const settings = JSON.parse(localStorage.getItem('faceAttend_settings')) || {};
            return { students, attendanceRecords, settings };
        } catch (error) {
            console.error("Error loading data from localStorage:", error);
            return { students: [], attendanceRecords: [], settings: {} };
        }
    },

    /**
     * Clears all application data from localStorage.
     */
    clearAll() {
        if (confirm('Are you sure you want to clear ALL data? This cannot be undone.')) {
            localStorage.removeItem('faceAttend_students');
            localStorage.removeItem('faceAttend_records');
            localStorage.removeItem('faceAttend_settings');
            return true;
        }
        return false;
    },

    /**
     * Creates a JSON backup of the current data and triggers a download.
     * @param {Object} state - The application state object.
     */
    backup(state) {
        const backupData = {
            students: state.students,
            attendanceRecords: state.attendanceRecords,
            settings: state.settings,
            backupDate: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        this.download(blob, `faceattend-backup-${Date.now()}.json`);
        ui.showToast("Backup created successfully!", "success");
    },

    /**
     * Handles the file selection for restoring data.
     * @param {Event} event - The file input change event.
     * @returns {Promise<Object>} A promise that resolves with the parsed data from the file.
     */
    handleRestoreFile(event) {
        return new Promise((resolve, reject) => {
            const file = event.target.files[0];
            if (!file) {
                reject('No file selected.');
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (data.students && data.attendanceRecords && data.settings) {
                        resolve(data);
                    } else {
                        reject('Invalid backup file format.');
                    }
                } catch (error) {
                    reject('Error parsing backup file.');
                }
            };
            reader.onerror = () => reject('Error reading file.');
            reader.readAsText(file);
        });
    },
    
    /**
     * Utility to trigger a file download.
     * @param {Blob} blob - The data blob to download.
     * @param {string} filename - The name of the file.
     */
    download(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};
