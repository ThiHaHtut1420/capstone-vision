// Main p5.js sketch
let gridLayout;
let feedManager;
let cameraCapture;
let config;
let fullscreenMode = false;
let testPatternGenerator;

function preload() {
  // Load configuration
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
    // Draw feed (works for both video and image)
    try {
      image(feed, cell.x, cell.y, cell.width, cell.height);
      
      // Draw border
      noFill();
      stroke(100);
      strokeWeight(1);
      rect(cell.x, cell.y, cell.width, cell.height);
    } catch (e) {
      // Fallback if image drawing fails
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
        image(capture, cell.x, cell.y, cell.width, cell.height);
        
        // Draw border to indicate it's the camera feed
        noFill();
        stroke(0, 255, 0);
        strokeWeight(2);
        rect(cell.x, cell.y, cell.width, cell.height);
        
        // Optional: Add label
        fill(0, 255, 0, 150);
        noStroke();
        rect(cell.x, cell.y, 100, 25);
        fill(0);
        textAlign(LEFT, TOP);
        textSize(12);
        text('CAMERA', cell.x + 5, cell.y + 5);
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

function keyPressed() {
  // Press 'f' or 'F' to toggle fullscreen
  if (key === 'f' || key === 'F') {
    fullscreenMode = !fullscreenMode;
    fullscreen(fullscreenMode);
  }
  
  // Press ESC to exit fullscreen
  if (keyCode === ESCAPE) {
    fullscreen(false);
    fullscreenMode = false;
  }
}
