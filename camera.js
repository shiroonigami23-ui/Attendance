/**
 * camera.js
 * Manages all WebRTC camera interactions.
 */

const camera = {
    currentStream: null,

    /**
     * Starts the camera and attaches the stream to a video element.
     * @param {string} videoElementId - The ID of the <video> element.
     * @returns {Promise<boolean>} True on success, false on failure.
     */
    async start(videoElementId) {
        try {
            if (this.currentStream) {
                this.stop();
            }
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 } },
                audio: false
            });
            const videoEl = document.getElementById(videoElementId);
            videoEl.srcObject = stream;
            this.currentStream = stream;
            ui.updateSystemStatus('cameraStatus', 'Active', 'active');
            return true;
        } catch (error) {
            console.error("Camera access error:", error);
            ui.showToast("Could not access camera. Please check permissions.", "error");
            ui.updateSystemStatus('cameraStatus', 'Error', 'inactive');
            return false;
        }
    },

    /**
     * Stops the currently active camera stream.
     */
    stop() {
        if (this.currentStream) {
            this.currentStream.getTracks().forEach(track => track.stop());
            this.currentStream = null;
            ui.updateSystemStatus('cameraStatus', 'Inactive', 'inactive');
        }
    },

    /**
     * Captures a single frame from a video element to a canvas.
     * @param {string} videoElementId - The ID of the source <video> element.
     * @param {string} canvasElementId - The ID of the destination <canvas> element.
     * @returns {string|null} The captured image as a data URL, or null on failure.
     */
    capture(videoElementId, canvasElementId) {
        const video = document.getElementById(videoElementId);
        const canvas = document.getElementById(canvasElementId);
        if (video.readyState < 2) { // Ensure video is ready
            ui.showToast('Camera is not ready yet.', 'warning');
            return null;
        }
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        return canvas.toDataURL('image/jpeg');
    }
};
