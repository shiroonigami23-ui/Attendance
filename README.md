# FaceAttend - Facial Recognition Attendance System

A complete web-based facial recognition attendance management system with LMS integration capabilities.

## 🌟 Features

### Core Functionality
- **Student Registration**: Add students with facial recognition training
- **Live Attendance**: Real-time face recognition for marking attendance
- **Session Management**: Create and manage class sessions with time windows
- **Reports & Analytics**: Generate detailed attendance reports and analytics
- **Admin Panel**: System configuration and data management

### Security Features
- **Anti-Proxy Protection**: Facial recognition prevents buddy punching
- **Liveness Detection**: Movement-based validation (configurable)
- **Session Time Windows**: Attendance restricted to configured periods
- **Secure Data Storage**: Local browser storage with encryption options

### LMS Integration Ready
- **REST API Compatible**: Ready for Moodle, Canvas, Blackboard integration
- **Standard Data Format**: Compatible with common LMS attendance modules
- **Export Functionality**: CSV/JSON export for gradebook sync

## 🚀 Quick Start

### Requirements
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Camera access permissions
- HTTPS connection (required for camera access)

### Installation
1. Download and extract the ZIP file
2. Place all files in a web server directory
3. Open `index.html` in your browser
4. Allow camera permissions when prompted

### For Local Development
```bash
# Using Python's built-in server
cd faceattend-folder
python -m http.server 8000

# Using Node.js live-server
npm install -g live-server
live-server
```

### For Production Deployment
- Upload files to your web server
- Ensure HTTPS is enabled for camera access
- Configure proper CORS headers if needed

## 📖 Usage Guide

### 1. Student Registration
1. Go to **Registration** tab
2. Fill out student details (ID, Name, Course, etc.)
3. Click **Start Camera** to begin photo capture
4. Position face in the circular frame
5. Click **Capture Photo** when ready
6. Review captured photo and click **Register Student**

### 2. Mark Attendance
1. Go to **Attendance** tab
2. Set up session details (Course, Date, Time)
3. Click **Start Session** to activate attendance
4. Click **Start Recognition** to begin camera scanning
5. Students look into camera one by one
6. System automatically recognizes and marks attendance
7. View live attendance list in real-time

### 3. Generate Reports
1. Go to **Reports** tab
2. Set filter criteria (Course, Date Range, Student)
3. Click **Generate Report** to view results
4. Use **Export CSV** or **Export JSON** for data export

### 4. System Administration
1. Go to **Admin** tab
2. Adjust recognition threshold for accuracy
3. Configure session timeout settings
4. Backup/restore data as needed
5. Monitor system status and storage usage

## ⚙️ Configuration

### Recognition Settings
- **Recognition Threshold**: 0.3-0.9 (lower = more sensitive)
- **Session Timeout**: 15-240 minutes
- **Liveness Detection**: Enable/disable movement validation

### Camera Settings
- **Resolution**: 640x480 (recommended for performance)
- **Frame Rate**: 1 FPS for recognition (battery efficient)
- **Auto-focus**: Enabled by default

## 🔧 Technical Details

### Libraries Used
- **face-api.js**: Client-side facial recognition
- **Chart.js**: Analytics and reporting charts
- **WebRTC API**: Camera access and video streaming

### Browser Compatibility
- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

### Data Storage
- Local browser storage (localStorage)
- No external database required
- Client-side processing (no server needed)

### File Structure
```
faceattend/
├── index.html          # Main application
├── style.css           # Styling and themes
├── app.js             # Core functionality
└── README.md          # This file
```

## 🔐 Security Considerations

### Data Protection
- All facial data stored locally in browser
- No data transmitted to external servers
- Face descriptors (not photos) used for matching
- Optional data encryption for sensitive deployments

### Privacy Compliance
- Students can request data deletion
- Transparent about data usage and storage
- No cross-domain data sharing
- Camera access only during active sessions

### Access Control
- Session-based access management
- Admin functions require confirmation
- Audit logging for attendance changes
- Time-based session expiration

## 🌐 LMS Integration

### Moodle Integration
```javascript
// Example API call to mark attendance in Moodle
const markMoodleAttendance = async (sessionId, studentId) => {
    const response = await fetch('/moodle/webservice/rest/server.php', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: new URLSearchParams({
            'wstoken': 'your-token',
            'wsfunction': 'mod_attendance_update_user_status',
            'sessionid': sessionId,
            'studentid': studentId,
            'statusid': 1 // Present
        })
    });
    return response.json();
};
```

### Canvas Integration
```javascript
// Example API call for Canvas attendance
const markCanvasAttendance = async (courseId, studentId) => {
    const response = await fetch(`/api/v1/courses/${courseId}/attendance`, {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer your-token',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            student_id: studentId,
            status: 'present',
            timestamp: new Date().toISOString()
        })
    });
    return response.json();
};
```

## 🛠️ Customization

### Themes
- Built-in light/dark theme toggle
- CSS custom properties for easy customization
- Responsive design for mobile devices

### Branding
- Update logo and colors in CSS variables
- Modify navigation and header text
- Add institutional branding elements

### Features
- Extend student registration fields
- Add custom attendance status types
- Integrate additional biometric methods
- Connect to external databases

## 📱 Mobile Support

### Responsive Design
- Optimized for tablets and smartphones
- Touch-friendly interface elements
- Mobile camera access supported

### Performance
- Efficient face processing on mobile devices
- Battery-optimized recognition intervals
- Offline functionality with sync capabilities

## 🔧 Troubleshooting

### Common Issues

**Camera not working:**
- Ensure HTTPS connection
- Check browser permissions
- Try different browsers
- Verify camera hardware

**Face not recognized:**
- Improve lighting conditions
- Adjust recognition threshold
- Re-register student photos
- Check camera focus

**Performance issues:**
- Reduce recognition frequency
- Close other browser tabs
- Use recommended camera resolution
- Clear browser cache

### Browser Support
If experiencing issues:
1. Update to latest browser version
2. Enable hardware acceleration
3. Clear browser data and cookies
4. Disable browser extensions

## 📊 Analytics

### Attendance Metrics
- Individual student attendance rates
- Class-wise attendance trends
- Daily/weekly/monthly reports
- Export data for external analysis

### System Metrics
- Recognition accuracy rates
- Camera performance statistics
- Storage usage monitoring
- Session duration tracking

## 🤝 Contributing

### Development Setup
1. Clone or download the project
2. Make modifications to HTML/CSS/JS files
3. Test with local web server
4. Ensure cross-browser compatibility

### Adding Features
- Follow existing code structure
- Update README with new features
- Test thoroughly before deployment
- Consider performance implications

## 📄 License

This project is open-source and available for educational and commercial use.

### Terms
- Free for educational institutions
- Attribution required for commercial use
- No warranty or support guarantee
- User responsible for compliance with privacy laws

## 🆘 Support

### Documentation
- In-app help tooltips
- Video tutorials (coming soon)
- FAQ section on website
- Community forums

### Technical Support
For technical issues:
1. Check troubleshooting section
2. Review browser console errors
3. Test in different browsers
4. Contact support with detailed logs

---

**FaceAttend** - Making attendance management simple, secure, and efficient through facial recognition technology.

Built with ❤️ for educational institutions worldwide.
