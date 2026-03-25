// Main p5.js sketch
let gridLayout;
let feedManager;
let cameraCapture;
let config;
let fullscreenMode = false;
let testPatternGenerator;
let diagnosticsEnabled = false;
/** null = still checking; true = /api/health missing (e.g. python http.server only). */
let proxyServerMissing = null;

function preload() {
  // config.json works with `python3 -m http.server` and with Express static hosting.
  // `/api/config` is only provided by server.js; plain static servers return 404 for it.
  config = loadJSON('config.json');
}

function setup() {
  // Create canvas - will be resized for fullscreen
  createCanvas(windowWidth, windowHeight);
  
  // Initialize components
  gridLayout = new GridLayout(config.grid);
  feedManager = new FeedManager();
  cameraCapture = new CameraCapture();
  testPatternGenerator = new TestPatternGenerator();
  
  // Load feeds
  feedManager.loadFeeds(config.feeds);

  fetch('/api/health')
    .then((r) => {
      proxyServerMissing = !r.ok;
    })
    .catch(() => {
      proxyServerMissing = true;
    });
  
  // Initialize camera
  cameraCapture.initialize();
  
  // Debug: Log camera status
  setTimeout(() => {
    console.log('Camera status:', {
      initialized: cameraCapture.initialized,
      isReady: cameraCapture.isReady,
      error: cameraCapture.error,
      hasCapture: !!cameraCapture.capture,
      videoWidth: cameraCapture.capture?.elt?.videoWidth || 0,
      videoHeight: cameraCapture.capture?.elt?.videoHeight || 0
    });
  }, 3000);
  
  // Don't auto-enter fullscreen (requires user gesture)
  // User can press 'F' to toggle fullscreen
  // if (config.display.fullscreen) {
  //   enterFullscreen();
  // }
  
  // Handle window resize
  windowResized();
}

function draw() {
  background(0);
  
  // Update grid layout if window size changed
  gridLayout.calculateLayout(width, height);
  
  // Get all enabled feeds including camera
  const allFeeds = config.feeds.filter(feed => feed.enabled);
  const totalFeeds = allFeeds.length;
  const cameraIndex = findCameraIndex();
  
  let feedManagerIndex = 0; // Index for feedManager (excludes camera)
  
  // Draw all grid cells
  for (let i = 0; i < gridLayout.getCellCount(); i++) {
    const cell = gridLayout.getCell(i);
    
    if (i < totalFeeds) {
      // We have a feed for this cell
      const feedInfo = allFeeds[i];
      
      // Check if this is the camera feed
      if (feedInfo && feedInfo.type === 'webcam') {
        drawCameraFeed(cell, cameraCapture);
      } else {
        // Draw regular feed using feedManager index
        drawVideoFeed(cell, feedManagerIndex, feedManager);
        feedManagerIndex++;
      }
    } else {
      // No feed for this cell - show test pattern
      testPatternGenerator.generatePattern(cell, i, millis());
      
      // Draw border
      noFill();
      stroke(50);
      strokeWeight(1);
      rect(cell.x, cell.y, cell.width, cell.height);
    }
  }

  if (proxyServerMissing === true) {
    drawProxyServerBanner();
  }

  if (diagnosticsEnabled) {
    drawDiagnosticsOverlay();
  }
}

/**
 * p5's image(video) can throw on WebKit when compositing HLS/MSE; raw drawImage is more reliable.
 */
function drawVideoElementToCell(videoElt, cell) {
  const w = cell.width;
  const h = cell.height;
  if (!videoElt || w <= 0 || h <= 0) return;
  push();
  translate(cell.x, cell.y);
  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.rect(0, 0, w, h);
  drawingContext.clip();
  drawingContext.drawImage(videoElt, 0, 0, w, h);
  drawingContext.restore();
  pop();
}

function drawProxyServerBanner() {
  push();
  noStroke();
  fill(160, 30, 30, 235);
  rect(0, 0, width, 78);
  fill(255);
  textAlign(LEFT, TOP);
  textSize(15);
  text('Safari needs the Node server for DSAT/HLS feeds (canvas + cross-origin video).', 14, 10);
  textSize(12);
  text('Stop whatever is using port 8000 (e.g. Python), or run:  npm run dev:3000', 14, 32);
  text('Then open via localhost or your PC\'s LAN URL (printed in the terminal when the server starts)  —  D = diagnostics', 14, 52);
  pop();
}

function drawVideoFeed(cell, index, feedManager) {
  const feed = feedManager.getFeed(index);
  const feedInfo = feedManager.getFeedInfo(index);
  
  if (feedManager.isLoading(index)) {
    // Show loading state with animated pattern
    testPatternGenerator.generatePattern(cell, index, millis());
    fill(255, 200);
    textAlign(CENTER, CENTER);
    textSize(16);
    text('Loading...', cell.x + cell.width/2, cell.y + cell.height/2);
    
    // Draw border
    noFill();
    stroke(100);
    strokeWeight(1);
    rect(cell.x, cell.y, cell.width, cell.height);
  } else if (feedManager.hasError(index)) {
    // Show error state with test pattern
    testPatternGenerator.generatePattern(cell, index, millis());
    fill(255, 0, 0, 200);
    textAlign(CENTER, CENTER);
    textSize(14);
    text('Feed Error', cell.x + cell.width/2, cell.y + cell.height/2);
    if (feedInfo) {
      fill(150, 200);
      textSize(10);
      text(feedInfo.id, cell.x + cell.width/2, cell.y + cell.height/2 + 20);
    }
    
    // Draw border
    noFill();
    stroke(150, 0, 0);
    strokeWeight(2);
    rect(cell.x, cell.y, cell.width, cell.height);
  } else if (feed) {
    // HLS/MSE often reaches "ok" before the element has decoded frames; drawing then shows black.
    const dom = feed.elt;
    const isVideo = dom && dom.tagName === 'VIDEO';
    const videoDrawable =
      isVideo &&
      dom.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      dom.videoWidth > 0;
    if (isVideo && !videoDrawable) {
      testPatternGenerator.generatePattern(cell, index, millis());
      fill(255, 220);
      textAlign(CENTER, CENTER);
      textSize(14);
      text('Starting stream…', cell.x + cell.width / 2, cell.y + cell.height / 2);
      fill(180);
      textSize(10);
      text('click if stuck', cell.x + cell.width / 2, cell.y + cell.height / 2 + 18);
      noFill();
      stroke(80);
      strokeWeight(1);
      rect(cell.x, cell.y, cell.width, cell.height);
      return;
    }

    try {
      if (isVideo) {
        drawVideoElementToCell(dom, cell);
      } else {
        image(feed, cell.x, cell.y, cell.width, cell.height);
      }

      noFill();
      stroke(100);
      strokeWeight(1);
      rect(cell.x, cell.y, cell.width, cell.height);
    } catch (e) {
      if (isVideo && dom.videoWidth > 0) {
        try {
          image(feed, cell.x, cell.y, cell.width, cell.height);
          noFill();
          stroke(100);
          strokeWeight(1);
          rect(cell.x, cell.y, cell.width, cell.height);
          return;
        } catch (_) {}
      }
      testPatternGenerator.generatePattern(cell, index, millis());
      fill(255, 100, 0, 200);
      textAlign(CENTER, CENTER);
      textSize(12);
      text('Render Error', cell.x + cell.width/2, cell.y + cell.height/2);
      
      // Draw border
      noFill();
      stroke(150, 100, 0);
      strokeWeight(2);
      rect(cell.x, cell.y, cell.width, cell.height);
    }
  } else {
    // No feed available - show test pattern
    testPatternGenerator.generatePattern(cell, index, millis());
    fill(150, 200);
    textAlign(CENTER, CENTER);
    textSize(12);
    text('No Feed', cell.x + cell.width/2, cell.y + cell.height/2);
    
    // Draw border
    noFill();
    stroke(50);
    strokeWeight(1);
    rect(cell.x, cell.y, cell.width, cell.height);
  }
}

function drawTestPattern(cell, brightness) {
  // Draw a test pattern background (legacy function, now using TestPatternGenerator)
  fill(brightness);
  rect(cell.x, cell.y, cell.width, cell.height);
  
  // Draw grid lines
  stroke(brightness + 20);
  strokeWeight(1);
  for (let x = cell.x; x < cell.x + cell.width; x += 20) {
    line(x, cell.y, x, cell.y + cell.height);
  }
  for (let y = cell.y; y < cell.y + cell.height; y += 20) {
    line(cell.x, y, cell.x + cell.width, y);
  }
}

function drawCameraFeed(cell, cameraCapture) {
  const capture = cameraCapture.getCapture();
  
  if (capture) {
    // Check if capture has valid video dimensions
    const hasVideo = capture.elt && capture.elt.videoWidth > 0 && capture.elt.videoHeight > 0;
    
    if (hasVideo || cameraCapture.isAvailable()) {
      try {
        if (capture.elt && capture.elt.tagName === 'VIDEO') {
          drawVideoElementToCell(capture.elt, cell);
        } else {
          image(capture, cell.x, cell.y, cell.width, cell.height);
        }

        noFill();
        stroke(100);
        strokeWeight(1);
        rect(cell.x, cell.y, cell.width, cell.height);
      } catch (e) {
        console.error('Error drawing camera:', e);
        fill(30);
        rect(cell.x, cell.y, cell.width, cell.height);
        fill(255, 100, 0);
        textAlign(CENTER, CENTER);
        textSize(12);
        text('Camera Error', cell.x + cell.width/2, cell.y + cell.height/2);
      }
    } else {
      // Camera exists but not ready yet
      fill(50);
      rect(cell.x, cell.y, cell.width, cell.height);
      fill(255);
      textAlign(CENTER, CENTER);
      textSize(14);
      text('Camera\nInitializing...', cell.x + cell.width/2, cell.y + cell.height/2);
    }
  } else {
    // Camera not available
    fill(20);
    rect(cell.x, cell.y, cell.width, cell.height);
    fill(255, 100, 0);
    textAlign(CENTER, CENTER);
    textSize(14);
    text('Camera\nNot Available', cell.x + cell.width/2, cell.y + cell.height/2);
    fill(150);
    textSize(10);
    text('Check permissions', cell.x + cell.width/2, cell.y + cell.height/2 + 30);
  }
}

function findCameraIndex() {
  if (!config || !config.feeds) return -1;
  for (let i = 0; i < config.feeds.length; i++) {
    if (config.feeds[i].type === 'webcam') {
      return i;
    }
  }
  return -1;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  if (gridLayout) {
    gridLayout.calculateLayout(width, height);
  }
}

function enterFullscreen() {
  const fs = fullscreen();
  if (!fs) {
    fullscreen(true);
    fullscreenMode = true;
  }
}

function mousePressed() {
  if (feedManager) feedManager.nudgeAllPlayback();
}

function keyPressed() {
  // Press 'f' or 'F' to toggle fullscreen
  if (key === 'f' || key === 'F') {
    fullscreenMode = !fullscreenMode;
    fullscreen(fullscreenMode);
  }

  // Press 'd' or 'D' to toggle diagnostics overlay
  if (key === 'd' || key === 'D') {
    diagnosticsEnabled = !diagnosticsEnabled;
  }
  
  // Press ESC to exit fullscreen
  if (keyCode === ESCAPE) {
    fullscreen(false);
    fullscreenMode = false;
  }
}

function drawDiagnosticsOverlay() {
  push();
  textFont('monospace');
  textSize(11);
  textAlign(LEFT, TOP);

  const padding = 10;
  const lineH = 14;
  const maxLines = 36;

  const feedCount = feedManager?.getFeedCount?.() ?? 0;
  const lines = [];
  lines.push(`Diagnostics (D to toggle)`);
  lines.push(`feeds: ${feedCount}`);

  for (let i = 0; i < Math.min(feedCount, maxLines - 3); i++) {
    const d = feedManager.getDiagnostics(i);
    const state = d.loading ? 'loading' : d.error ? 'error' : 'ok';
    const err = d.error && d.lastError ? ` | ${d.lastError}` : '';
    lines.push(`${i}: ${d.id} [${d.type}] ${state}${err}`);
  }

  const overlayW = Math.min(width - padding * 2, 900);
  const overlayH = padding * 2 + lines.length * lineH;

  noStroke();
  fill(0, 170);
  rect(padding, padding, overlayW, overlayH, 6);

  fill(255);
  let y = padding + padding;
  for (const line of lines) {
    text(line, padding + padding, y);
    y += lineH;
  }

  pop();
}
