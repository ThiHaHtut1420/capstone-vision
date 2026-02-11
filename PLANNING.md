# Project Planning: Live CCTV Grid Display

## Project Overview

A full-screen p5.js application that displays a grid of live CCTV feeds from the Internet, with one hidden camera feed integrated into the grid. The application will run on a PC connected to a large TV screen via HDMI.

## Core Features

1. **Grid Display**: Multiple live CCTV feeds arranged in a grid layout
2. **Live Internet Feeds**: Fetch and display real-time CCTV streams from public sources
3. **Pre-recorded Fallback Feeds**: Collection of local video files to use when internet connection is unstable
4. **Automatic Fallback System**: Seamlessly switches between live and pre-recorded feeds based on connection status
5. **Hidden Camera Integration**: One local camera feed (webcam) integrated into the grid
6. **Full Screen Mode**: Application runs in full screen on TV display
7. **Real-time Updates**: Continuous streaming of all feeds

## Technical Requirements

### Hardware
- PC/Laptop with HDMI output
- Large TV screen with HDMI input
- Webcam/camera for hidden feed (USB or built-in)
- Stable internet connection for fetching CCTV feeds

### Software
- Web browser (Chrome, Firefox, or Edge recommended)
- p5.js library
- Node.js (optional, for local development server)

## Technical Architecture

### Technology Stack
- **Frontend**: p5.js (JavaScript)
- **Video Streaming**: 
  - Internet CCTV feeds: Public RTSP/HTTP streams or MJPEG streams
  - Local camera: WebRTC or MediaDevices API
- **Display**: HTML5 Canvas (via p5.js)

### Key Components

1. **Feed Manager**
   - Manages collection of CCTV feed URLs
   - Handles feed loading and error recovery
   - Rotates through available feeds if some fail
   - Manages fallback hierarchy (live → backup live → pre-recorded)

2. **Connection Monitor**
   - Monitors internet connectivity status
   - Detects network instability (timeouts, slow responses)
   - Triggers automatic fallback to pre-recorded feeds
   - Attempts to reconnect and restore live feeds when connection improves

3. **Pre-recorded Feed Manager**
   - Manages collection of local video files
   - Handles video file loading and playback
   - Loops videos seamlessly for continuous display
   - Maps pre-recorded feeds to corresponding live feed slots

4. **Grid Layout System**
   - Calculates grid dimensions based on number of feeds
   - Responsive layout that adapts to screen resolution
   - Maintains aspect ratios of video feeds

5. **Video Renderer**
   - Renders each feed in its grid cell
   - Handles video loading states
   - Displays placeholder/error states for failed feeds
   - Seamlessly transitions between live and pre-recorded feeds

6. **Camera Capture Module**
   - Captures video from local webcam
   - Integrates seamlessly into grid
   - Handles camera permissions and errors

7. **Full Screen Controller**
   - Manages full screen mode
   - Handles screen resolution and scaling
   - Keyboard shortcuts for controls

## Implementation Plan

### Phase 1: Setup & Basic Structure
- [ ] Initialize p5.js project structure
- [ ] Set up HTML file with full screen canvas
- [ ] Configure p5.js for full screen mode
- [ ] Test basic canvas rendering

### Phase 2: Grid Layout System
- [ ] Implement grid calculation algorithm
- [ ] Create grid cell rendering system
- [ ] Add responsive layout logic
- [ ] Test with placeholder rectangles

### Phase 3: Internet CCTV Feed Integration
- [ ] Research and collect public CCTV feed URLs
- [ ] Implement video loading for HTTP/MJPEG streams
- [ ] Handle RTSP streams (may require conversion/proxy)
- [ ] Add error handling and fallback mechanisms
- [ ] Test feed loading and display

### Phase 4: Local Camera Integration
- [ ] Implement webcam capture using p5.js `createCapture()`
- [ ] Integrate camera feed into grid
- [ ] Handle camera permissions
- [ ] Test camera feed display

### Phase 5: Feed Management & Fallback System
- [ ] Create feed configuration system (JSON/config file)
- [ ] Implement feed rotation/fallback logic for live feeds
- [ ] Add feed status monitoring
- [ ] Implement connection monitoring system
- [ ] Create pre-recorded feed manager
- [ ] Implement automatic fallback mechanism (live → pre-recorded)
- [ ] Add automatic reconnection logic (pre-recorded → live)
- [ ] Handle network errors gracefully

### Phase 6: Polish & Optimization
- [ ] Optimize rendering performance
- [ ] Add loading indicators
- [ ] Implement smooth transitions
- [ ] Add keyboard controls (full screen toggle, refresh feeds, etc.)
- [ ] Test on target hardware (TV screen)

### Phase 7: Deployment
- [ ] Create startup script/instructions
- [ ] Configure browser for kiosk mode (optional)
- [ ] Document feed sources and configuration
- [ ] Create user manual

## Technical Challenges & Solutions

### Challenge 1: CORS and Video Streaming
**Problem**: Many CCTV feeds may have CORS restrictions or require special protocols (RTSP).

**Solutions**:
- Use public MJPEG streams (common for CCTV)
- Implement a proxy server if needed (Node.js backend)
- Use services that provide public CCTV feeds
- Consider using iframe embedding for some feeds

### Challenge 2: Performance with Multiple Video Streams
**Problem**: Rendering many video streams simultaneously can be resource-intensive.

**Solutions**:
- Limit number of concurrent feeds
- Optimize video resolution/quality
- Use requestAnimationFrame efficiently
- Implement lazy loading for off-screen feeds

### Challenge 3: Feed Availability
**Problem**: Public CCTV feeds may go offline or change URLs.

**Solutions**:
- Maintain a list of backup feeds
- Implement automatic feed rotation
- Add health checking for feeds
- Display error states gracefully

### Challenge 5: Internet Instability
**Problem**: Internet connection may become unstable or fail, causing all live feeds to stop working.

**Solutions**:
- Implement connection monitoring with periodic health checks
- Maintain a library of pre-recorded video files as fallback
- Automatically switch to pre-recorded feeds when connection issues detected
- Use network status API (navigator.onLine) combined with feed response times
- Implement timeout thresholds for feed loading
- Automatically attempt to restore live feeds when connection improves
- Seamless transition between live and pre-recorded (no visual disruption)

### Challenge 4: Full Screen on TV
**Problem**: Ensuring proper display on TV screen with correct resolution.

**Solutions**:
- Use p5.js `fullscreen()` function
- Detect screen resolution and adjust grid accordingly
- Test on actual TV hardware
- Add manual resolution override if needed

### Challenge 6: Pre-recorded Feed Management
**Problem**: Managing and organizing pre-recorded video files, ensuring they loop seamlessly.

**Solutions**:
- Organize videos in dedicated assets folder
- Use HTML5 video element with loop attribute
- Pre-load videos to ensure smooth transitions
- Match pre-recorded feeds to live feed slots (same aspect ratio/content type)
- Use video formats compatible with browsers (MP4, WebM)

## Feed Sources

### Potential CCTV Feed Sources
- Public traffic cameras
- Weather cameras
- Public space cameras (with permission)
- Test streams from services like:
  - EarthCam
  - Insecam (public cameras)
  - Various city traffic camera systems

**Note**: Always respect privacy and terms of service when using public feeds.

## Configuration

### Feed Configuration Format
```json
{
  "feeds": [
    {
      "id": "feed1",
      "url": "http://example.com/camera1.mjpg",
      "type": "mjpeg",
      "enabled": true,
      "fallbackUrl": "http://backup.example.com/camera1.mjpg",
      "prerecordedPath": "assets/videos/feed1_backup.mp4"
    },
    {
      "id": "local_camera",
      "type": "webcam",
      "enabled": true
    }
  ],
  "grid": {
    "columns": 4,
    "rows": 3,
    "spacing": 2
  },
  "display": {
    "fullscreen": true,
    "refreshInterval": 5000
  },
  "connection": {
    "monitorInterval": 3000,
    "timeoutThreshold": 5000,
    "reconnectAttempts": 3,
    "reconnectDelay": 10000,
    "autoFallback": true
  }
}
```

## File Structure

```
capstone-sandbox/
├── index.html
├── sketch.js (main p5.js file)
├── feedManager.js
├── connectionMonitor.js
├── prerecordedManager.js
├── gridLayout.js
├── cameraCapture.js
├── config.json
├── assets/
│   ├── videos/
│   │   ├── feed1_backup.mp4
│   │   ├── feed2_backup.mp4
│   │   └── (other pre-recorded feeds)
│   └── (placeholder images, etc.)
├── README.md
└── PLANNING.md
```

## Dependencies

### Core
- p5.js (via CDN or local)
- p5.js libraries (if needed):
  - p5.sound (not needed for this project)
  - p5.dom (for UI elements if needed)

### Optional
- Node.js + Express (for proxy server if needed)
- CORS proxy service (if needed for feeds)

## Testing Plan

1. **Unit Testing**
   - Grid layout calculations
   - Feed URL validation
   - Camera capture functionality

2. **Integration Testing**
   - Multiple feeds loading simultaneously
   - Grid rendering with various feed counts
   - Error handling and recovery
   - Automatic fallback to pre-recorded feeds
   - Reconnection and restoration of live feeds

3. **Performance Testing**
   - Frame rate with multiple feeds
   - Memory usage
   - CPU usage

4. **Hardware Testing**
   - Full screen on TV display
   - Different screen resolutions
   - Camera compatibility

5. **Offline/Network Testing**
   - Simulate network failures
   - Test automatic fallback to pre-recorded feeds
   - Test reconnection when network is restored
   - Verify seamless transitions between live and pre-recorded
   - Test with unstable/slow connections

## Deployment Considerations

### Browser Setup
- Use Chrome/Edge in kiosk mode for automatic startup
- Disable browser UI elements
- Set browser to open full screen automatically

### Startup Script
- Create batch/shell script to launch browser in kiosk mode
- Add to startup programs for automatic launch

### Maintenance
- Regular feed URL updates
- Monitor feed availability
- Update camera permissions if needed

## Timeline Estimate

- **Phase 1-2**: 1-2 days (Setup & Grid)
- **Phase 3**: 2-3 days (Internet Feeds)
- **Phase 4**: 1 day (Camera Integration)
- **Phase 5**: 2-3 days (Feed Management & Fallback System)
- **Phase 6**: 2-3 days (Polish)
- **Phase 7**: 1 day (Deployment)

**Total**: ~9-13 days of development

## Future Enhancements

- Feed selection UI (hidden, accessible via keyboard)
- Recording capability for specific feeds
- Motion detection alerts
- Feed metadata display (location, timestamp)
- Customizable grid layouts
- Feed quality selection
- Automatic feed discovery

## Pre-recorded Feed Strategy

### Video Collection
- Record or collect sample CCTV-style footage
- Match video content/style to live feed types (traffic, weather, public spaces)
- Ensure videos are long enough to loop seamlessly (5-10 minutes minimum)
- Use consistent video formats (MP4 recommended for browser compatibility)
- Match aspect ratios to live feeds for seamless transitions

### Fallback Logic
1. **Connection Monitoring**: 
   - Check `navigator.onLine` status
   - Monitor feed response times
   - Detect timeout errors

2. **Automatic Switching**:
   - When connection issues detected → switch to pre-recorded feeds
   - When connection restored → attempt to restore live feeds
   - Smooth transition with no visual glitches

3. **Fallback Hierarchy**:
   - Primary: Live feed URL
   - Secondary: Backup live feed URL (if configured)
   - Tertiary: Pre-recorded video file
   - All transitions should be automatic and seamless

### Video Preparation
- Use video editing software to create seamless loops
- Ensure videos start and end at similar frames for smooth looping
- Compress videos appropriately (balance quality vs. file size)
- Consider creating multiple versions for variety

## Notes

- Ensure compliance with privacy laws when displaying public cameras
- Some feeds may require authentication
- Consider bandwidth limitations when using many feeds
- Test thoroughly on target hardware before final deployment
- Pre-recorded feeds ensure the installation works even without internet
- Consider recording your own footage to match the aesthetic of live feeds
