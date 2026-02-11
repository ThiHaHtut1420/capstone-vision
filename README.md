# capstone-vision
Main capstone project - Vision

A full-screen p5.js application that displays a grid of live CCTV feeds from the Internet, with one hidden camera feed integrated into the grid.

## Features

- **Grid Display**: Multiple live CCTV feeds arranged in a grid layout
- **Live Internet Feeds**: Fetch and display real-time CCTV streams from public sources
- **Local Camera Feed**: Webcam feed integrated into the grid
- **Full Screen Mode**: Runs in full screen for TV display
- **Automatic Fallback**: Pre-recorded feeds for when internet is unstable (coming soon)

## Quick Start

1. **Open the application**: Simply open `index.html` in a web browser
   - For best results, use Chrome, Firefox, or Edge
   - **Note**: Camera access requires HTTPS or localhost. For local testing, you can use a local server:
     ```bash
     # Using Python 3
     python3 -m http.server 8000
     # Then open http://localhost:8000
     ```

2. **Camera Permissions**: When prompted, allow camera access for the webcam feed

3. **Full Screen**: Press 'F' to toggle full screen mode, or ESC to exit

## Configuration

Edit `config.json` to customize:
- **Feeds**: Add or modify CCTV feed URLs
- **Grid Layout**: Adjust columns, rows, and spacing
- **Display Settings**: Configure fullscreen and refresh intervals

### Feed Types

- `mjpeg`: MJPEG stream (single image that refreshes)
- `video`: Video stream or file (MP4, WebM, etc.)
- `webcam`: Local camera feed

### Example Feed Configuration

```json
{
  "id": "feed1",
  "url": "http://example.com/camera.mjpg",
  "type": "mjpeg",
  "enabled": true
}
```

### Finding Working Feed URLs

The default configuration includes placeholder feed URLs. To get working feeds:

1. **Public Traffic Cameras**: Many cities provide public traffic camera feeds
2. **Weather Cameras**: Weather services often have public webcam feeds
3. **Test Streams**: Look for public MJPEG test streams online
4. **Your Own Feeds**: Set up your own MJPEG cameras or use IP camera software

**Note**: Many public feeds have CORS restrictions. You may need to:
- Use a proxy server
- Find feeds that explicitly allow cross-origin access
- Use HTTPS feeds when possible

## File Structure

```
capstone-sandbox/
├── index.html          # Main HTML file
├── sketch.js           # Main p5.js sketch
├── feedManager.js      # Manages CCTV feeds
├── cameraCapture.js    # Handles webcam capture
├── gridLayout.js       # Grid layout calculations
├── config.json         # Configuration file
└── assets/             # Pre-recorded videos (for fallback)
```

## Keyboard Controls

- **F**: Toggle fullscreen mode
- **ESC**: Exit fullscreen

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: May have limitations with some video formats

## Troubleshooting

- **Camera not working**: Ensure you're using HTTPS or localhost, and check browser permissions
- **Feeds not loading**: Check CORS restrictions and feed URL availability
- **Fullscreen issues**: Some browsers require user interaction before allowing fullscreen

## Development

See `PLANNING.md` for detailed project planning and roadmap.

## License

GPL-3.0
