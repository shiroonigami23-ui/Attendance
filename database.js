// database.js
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, writeBatch, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/**
 * Handles all data operations for a specific admin's data (students, attendance).
 */
export const dbHandler = {
    async save(adminId, state) {
        if (!adminId) return;
        const db = getFirestore();
        const batch = writeBatch(db);

        const settingsRef = doc(db, "admins", adminId, "config", "settings");
        batch.set(settingsRef, state.settings);

        state.students.forEach(student => {
            const studentRef = doc(db, "admins", adminId, "students", student.id);
            batch.set(studentRef, student);
        });
        
        state.attendanceRecords.forEach(record => {
             const recordRef = doc(db, "admins", adminId, "attendance", record.id);
             batch.set(recordRef, record);
        });

        try {
            await batch.commit();
        } catch (error) {
            console.error("Error saving data to Firestore:", error);
            ui.showToast("Could not save data.", "error");
        }
    },

    async load(adminId) {
        if (!adminId) return { students: [], attendanceRecords: [], settings: {} };
        const db = getFirestore();
        try {
            const settingsRef = doc(db, "admins", adminId, "config", "settings");
            const settingsSnap = await getDoc(settingsRef);
            const settings = settingsSnap.exists() ? settingsSnap.data() : {};

            const studentsCol = collection(db, "admins", adminId, "students");
            const studentsSnap = await getDocs(studentsCol);
            const students = studentsSnap.docs.map(doc => doc.data());

            const recordsCol = collection(db, "admins", adminId, "attendance");
            const recordsSnap = await getDocs(recordsCol);
            const attendanceRecords = recordsSnap.docs.map(doc => doc.data());

            return { students, attendanceRecords, settings };
        } catch (error) {
            console.error("Error loading data from Firestore:", error);
            ui.showToast("Failed to load data.", "error");
            return { students: [], attendanceRecords: [], settings: {} };
        }
    },

    async deleteStudent(adminId, studentId) {
        if (!adminId || !studentId) return;
        const db = getFirestore();
        const studentRef = doc(db, "admins", adminId, "students", studentId);
        try {
            await deleteDoc(studentRef);
        } catch(error) {
            console.error("Error deleting student:", error);
        }
    },
    
    download(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

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
};

/**
 * Handles checking and managing the global list of admins.
 */
export const adminListHandler = {
    async getAdmins() {
        const db = getFirestore();
        const adminsCol = collection(db, "adminsList");
        const adminsSnapshot = await getDocs(adminsCol);
        return adminsSnapshot.docs.map(doc => doc.data());
    },
    
    async addAdmin(user) {
        if (!user || !user.uid) return;
        const db = getFirestore();
        // Use setDoc with the user's UID as the document ID to prevent duplicates
        const adminRef = doc(db, "adminsList", user.uid);
        await setDoc(adminRef, {
            email: user.email,
            uid: user.uid,
            registeredAt: new Date().toISOString()
        });
    }
};
