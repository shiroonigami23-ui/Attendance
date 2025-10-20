/**
 * camera.js
 * This module manages all WebRTC camera interactions.
 */
import { ui } from './ui.js';

export const camera = {
    currentStream: null,

    async start(videoElementId) {
        try {
            if (this.currentStream) this.stop();
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 } } });
            const videoEl = document.getElementById(videoElementId);
            videoEl.srcObject = stream;
            this.currentStream = stream;
            return true;
        } catch (error) {
            console.error("Camera access error:", error);
            ui.showToast("Could not access camera. Please check permissions.", "error");
            return false;
        }
    },

    stop() {
        if (this.currentStream) {
            this.currentStream.getTracks().forEach(track => track.stop());
            this.currentStream = null;
        }
        // Also stop the video element to clear the last frame
        const videoElements = document.querySelectorAll('.camera-feed');
        videoElements.forEach(vid => {
            vid.srcObject = null;
        });
    },

    capture(videoElementId, canvasElementId) {
        const video = document.getElementById(videoElementId);
        const canvas = document.getElementById(canvasElementId);
        if (video.readyState < 2) {
            ui.showToast('Camera is not ready yet.', 'warning');
            return null;
        }
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        return canvas.toDataURL('image/jpeg');
    }
};
