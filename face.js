/**
 * face.js
 * Handles all face-api.js interactions, including model loading and recognition.
 */

const face = {
    isLoaded: false,
    faceMatcher: null,
    MODEL_URL: 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/',

    /**
     * Loads all necessary face recognition models.
     */
    async loadModels() {
        if (this.isLoaded) return;
        ui.showLoading(true, 'Loading Face Models...');
        try {
            await Promise.all([
                faceapi.nets.tinyFaceDetector.loadFromUri(this.MODEL_URL),
                faceapi.nets.faceLandmark68Net.loadFromUri(this.MODEL_URL),
                faceapi.nets.faceRecognitionNet.loadFromUri(this.MODEL_URL),
                faceapi.nets.faceExpressionNet.loadFromUri(this.MODEL_URL) // For potential future use
            ]);
            this.isLoaded = true;
            ui.updateSystemStatus('faceApiStatus', 'Ready', 'active');
            ui.showToast('Face models loaded.', 'success');
        } catch (error) {
            console.error("Error loading face models:", error);
            ui.updateSystemStatus('faceApiStatus', 'Error', 'inactive');
            ui.showToast('Failed to load face models.', 'error');
        } finally {
            ui.showLoading(false);
        }
    },

    /**
     * Creates a face descriptor from an image element.
     * @param {HTMLImageElement|HTMLVideoElement} imageEl - The image or video to process.
     * @returns {Promise<Float32Array|null>} The descriptor or null if not found.
     */
    async getDescriptor(imageEl) {
        if (!this.isLoaded) return null;
        const detection = await faceapi
            .detectSingleFace(imageEl, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptor();
        return detection ? detection.descriptor : null;
    },

    /**
     * Creates a FaceMatcher instance from the list of registered students.
     * @param {Array} students - The array of student objects.
     * @param {number} threshold - The recognition distance threshold.
     */
    createMatcher(students, threshold = 0.6) {
        if (!students || students.length === 0) {
            this.faceMatcher = null;
            return;
        }
        const labeledDescriptors = students
            .filter(s => s.faceDescriptor && s.faceDescriptor.length > 0)
            .map(s => new faceapi.LabeledFaceDescriptors(
                s.id,
                [Float32Array.from(Object.values(s.faceDescriptor))]
            ));
        
        if (labeledDescriptors.length > 0) {
            this.faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, threshold);
        } else {
            this.faceMatcher = null;
        }
    },

    /**
     * Finds the best match for a given descriptor.
     * @param {Float32Array} descriptor - The descriptor to match.
     * @returns {faceapi.FaceMatch|null} The best match or null.
     */
    findBestMatch(descriptor) {
        if (!this.faceMatcher || !descriptor) return null;
        return this.faceMatcher.findBestMatch(descriptor);
    }
};
