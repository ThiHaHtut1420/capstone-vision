// Camera Capture Module
class CameraCapture {
  constructor() {
    this.capture = null;
    this.isReady = false;
    this.error = false;
    this.initialized = false;
    /** After the stream is drawable, wait this long before painting it (slower than other tiles). */
    this.extraRevealDelayMs = 2200;
    /** When set, video is only drawn once `millis() >=` this value (deadline after first drawable frame). */
    this._drawVideoNotBefore = null;
  }

  initialize() {
    try {
      this.capture = createCapture(VIDEO);
      this.capture.hide();
      this.capture.size(640, 480);
      
      const self = this;
      
      // Check if video is ready (multiple ways to detect)
      const checkReady = () => {
        if (self.capture && self.capture.elt && self.capture.elt.readyState >= 2) {
          self.isReady = true;
          self.error = false;
          console.log('Camera ready');
        }
      };
      
      // Try multiple event listeners
      this.capture.elt.onloadedmetadata = () => {
        self.isReady = true;
        self.error = false;
        console.log('Camera metadata loaded');
      };
      
      this.capture.elt.onloadeddata = () => {
        self.isReady = true;
        self.error = false;
        console.log('Camera data loaded');
      };
      
      this.capture.elt.oncanplay = () => {
        self.isReady = true;
        self.error = false;
        console.log('Camera can play');
      };

      this.capture.elt.onerror = () => {
        self.error = true;
        self.isReady = false;
        console.error('Failed to access camera');
      };
      
      // Also check periodically if readyState changes
      setTimeout(() => {
        checkReady();
        if (!self.isReady && self.capture && self.capture.elt) {
          // If still not ready after 2 seconds, check if video element exists
          if (self.capture.elt.readyState >= 2 || self.capture.elt.videoWidth > 0) {
            self.isReady = true;
            self.error = false;
            console.log('Camera ready (delayed check)');
          }
        }
      }, 2000);
      
      this.initialized = true;
    } catch (err) {
      this.error = true;
      console.error('Camera initialization error:', err);
    }
  }

  getVideoDrawable() {
    const elt = this.capture?.elt;
    return (
      !this.error &&
      !!elt &&
      elt.tagName === 'VIDEO' &&
      elt.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      elt.videoWidth > 0
    );
  }

  /**
   * Call each frame from draw(). When the camera first becomes drawable, starts the post-loading hold.
   */
  updateRevealGate() {
    if (this.error || !this.capture?.elt) {
      this._drawVideoNotBefore = null;
      return;
    }
    if (this.getVideoDrawable() && this._drawVideoNotBefore === null) {
      this._drawVideoNotBefore = millis() + this.extraRevealDelayMs;
    }
  }

  /** True while the feed is ready but we are still holding on the loading / starting UI. */
  shouldDeferRevealedVideo() {
    return this.getVideoDrawable() && this._drawVideoNotBefore !== null && millis() < this._drawVideoNotBefore;
  }

  getCapture() {
    // Return capture if it exists, even if not fully ready yet
    // p5.js capture might work even if events haven't fired
    if (this.capture) {
      // Check if it's actually working
      if (this.capture.elt && (this.capture.elt.readyState >= 2 || this.capture.elt.videoWidth > 0)) {
        this.isReady = true;
        return this.capture;
      }
      // Still return it - let draw() handle the display
      return this.capture;
    }
    return null;
  }

  isAvailable() {
    // More lenient check - if capture exists and is initialized, consider it available
    if (this.capture && this.initialized) {
      // Check if video element has dimensions (means it's working)
      if (this.capture.elt && this.capture.elt.videoWidth > 0) {
        this.isReady = true;
        return true;
      }
      // Still return true if capture exists - might be loading
      return !this.error;
    }
    return false;
  }
}
