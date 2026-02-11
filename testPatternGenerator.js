// Test Pattern Generator - creates animated patterns for empty feed slots
class TestPatternGenerator {
  constructor() {
    this.patterns = [];
    this.time = 0;
  }

  generatePattern(cell, index, time) {
    // Different pattern styles for variety
    const patternType = index % 4;
    
    push();
    translate(cell.x, cell.y);
    
    switch (patternType) {
      case 0:
        this.drawGridPattern(cell.width, cell.height, time);
        break;
      case 1:
        this.drawBarsPattern(cell.width, cell.height, time);
        break;
      case 2:
        this.drawCirclesPattern(cell.width, cell.height, time);
        break;
      case 3:
        this.drawNoisePattern(cell.width, cell.height, time);
        break;
    }
    
    pop();
  }

  drawGridPattern(w, h, time) {
    // Animated grid pattern
    fill(20);
    noStroke();
    rect(0, 0, w, h);
    
    const gridSize = 20;
    const offset = (time * 0.5) % gridSize;
    
    stroke(60);
    strokeWeight(1);
    
    // Vertical lines
    for (let x = -offset; x < w; x += gridSize) {
      line(x, 0, x, h);
    }
    
    // Horizontal lines
    for (let y = -offset; y < h; y += gridSize) {
      line(0, y, w, y);
    }
    
    // Center crosshair
    stroke(100);
    strokeWeight(2);
    line(w/2, 0, w/2, h);
    line(0, h/2, w, h/2);
    
    // Corner markers
    fill(100);
    noStroke();
    rect(0, 0, 10, 10);
    rect(w-10, 0, 10, 10);
    rect(0, h-10, 10, 10);
    rect(w-10, h-10, 10, 10);
  }

  drawBarsPattern(w, h, time) {
    // Moving bars pattern
    fill(15);
    noStroke();
    rect(0, 0, w, h);
    
    const barWidth = 30;
    const speed = time * 0.3;
    const offset = speed % (barWidth * 2);
    
    noStroke();
    for (let x = -barWidth; x < w + barWidth; x += barWidth * 2) {
      const xPos = x + offset;
      if (xPos > -barWidth && xPos < w + barWidth) {
        fill(40);
        rect(xPos, 0, barWidth, h);
      }
    }
    
    // Static bars
    fill(25);
    for (let y = 0; y < h; y += 40) {
      rect(0, y, w, 2);
    }
  }

  drawCirclesPattern(w, h, time) {
    // Concentric circles pattern
    fill(18);
    noStroke();
    rect(0, 0, w, h);
    
    const centerX = w / 2;
    const centerY = h / 2;
    const maxRadius = sqrt(w * w + h * h) / 2;
    const pulse = sin(time * 0.02) * 5;
    
    noFill();
    stroke(50);
    strokeWeight(1);
    
    for (let r = 20; r < maxRadius; r += 30) {
      circle(centerX, centerY, r + pulse);
    }
    
    // Center dot
    fill(80);
    noStroke();
    circle(centerX, centerY, 8);
  }

  drawNoisePattern(w, h, time) {
    // Animated noise pattern - use simpler pattern to avoid pixel manipulation issues
    fill(22);
    noStroke();
    rect(0, 0, w, h);
    
    // Use a simpler pattern with dots instead of pixel manipulation
    const dotSize = 4;
    const spacing = 8;
    const noiseScale = 0.05;
    const timeOffset = time * 0.01;
    
    noStroke();
    for (let y = 0; y < h; y += spacing) {
      for (let x = 0; x < w; x += spacing) {
        const noiseVal = noise(x * noiseScale, y * noiseScale, timeOffset);
        const brightness = noiseVal * 60 + 20;
        fill(brightness);
        circle(x, y, dotSize);
      }
    }
    
    // Add some static lines
    stroke(35);
    strokeWeight(1);
    for (let i = 0; i < 5; i++) {
      const y = (h / 6) * (i + 1);
      line(0, y, w, y);
    }
  }
}
