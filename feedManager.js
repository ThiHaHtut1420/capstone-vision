// Feed Manager - handles loading and managing CCTV feeds
class FeedManager {
  constructor() {
    this.feeds = [];
    this.videos = [];
    this.images = []; // For MJPEG streams
    this.loadingStates = [];
    this.lastUpdateTime = [];
  }

  loadFeeds(feedConfigs) {
    this.feeds = feedConfigs.filter(feed => feed.enabled && feed.type !== 'webcam');
    this.videos = [];
    this.images = [];
    this.loadingStates = [];
    this.lastUpdateTime = [];

    for (let i = 0; i < this.feeds.length; i++) {
      const feed = this.feeds[i];
      this.loadingStates[i] = { loading: true, error: false };
      this.lastUpdateTime[i] = 0;
      
      if (feed.type === 'mjpeg' || feed.type === 'mjpg') {
        this.loadMJPEGFeed(i, feed);
      } else if (feed.type === 'http' || feed.type === 'video') {
        this.loadVideoFeed(i, feed);
      }
    }
  }

  loadMJPEGFeed(index, feed) {
    // For MJPEG streams, we use an img element that we update periodically
    const img = createImg(feed.url, feed.id);
    img.hide();
    
    const self = this;
    img.elt.onload = () => {
      self.loadingStates[index].loading = false;
      self.loadingStates[index].error = false;
      self.lastUpdateTime[index] = millis();
    };

    img.elt.onerror = () => {
      self.loadingStates[index].loading = false;
      self.loadingStates[index].error = true;
      console.error(`Failed to load MJPEG feed: ${feed.id}`);
    };

    this.images[index] = img;
    this.feeds[index] = feed; // Store feed for refresh
    
    // Refresh MJPEG stream every 2 seconds
    const refreshInterval = setInterval(() => {
      if (self.images[index] && !self.loadingStates[index].error) {
        const timestamp = new Date().getTime();
        const separator = feed.url.includes('?') ? '&' : '?';
        self.images[index].elt.src = feed.url + separator + 't=' + timestamp;
      }
    }, 2000);
    
    // Store interval ID for potential cleanup
    if (!this.intervals) this.intervals = [];
    this.intervals[index] = refreshInterval;
  }

  loadVideoFeed(index, feed) {
    // For video streams/files (including HLS)
    const video = createVideo(feed.url);
    video.hide();
    video.volume(0);
    
    const self = this;
    
    // For HLS streams, we need to use hls.js or let the browser handle it
    // Check if it's an HLS stream (.m3u8)
    if (feed.url.includes('.m3u8')) {
      // HLS streams - browser may handle natively or need hls.js
      // Try to play it directly
      video.elt.setAttribute('playsinline', '');
      video.elt.setAttribute('webkit-playsinline', '');
    }
    
    video.elt.onloadeddata = () => {
      self.loadingStates[index].loading = false;
      self.loadingStates[index].error = false;
      console.log(`Video feed loaded: ${feed.id}`);
    };

    video.elt.oncanplay = () => {
      self.loadingStates[index].loading = false;
      self.loadingStates[index].error = false;
    };

    video.elt.onerror = (e) => {
      self.loadingStates[index].loading = false;
      self.loadingStates[index].error = true;
      console.error(`Failed to load video feed: ${feed.id}`, e);
    };

    // Try to play - p5.js play() doesn't return a promise, so use the native element
    try {
      video.play();
      // Also try native play() which returns a promise
      if (video.elt && video.elt.play) {
        video.elt.play().catch(err => {
          console.warn(`Could not autoplay ${feed.id}:`, err);
          // Still mark as loading, might work on user interaction
        });
      }
    } catch (err) {
      console.warn(`Could not play ${feed.id}:`, err);
    }
    
    this.videos[index] = video;
  }

  getFeed(index) {
    // Return video if available, otherwise return image
    if (this.videos[index]) {
      return this.videos[index];
    }
    if (this.images[index]) {
      return this.images[index];
    }
    return null;
  }

  getFeedCount() {
    return this.feeds.length;
  }

  isLoading(index) {
    return this.loadingStates[index]?.loading || false;
  }

  hasError(index) {
    return this.loadingStates[index]?.error || false;
  }

  getFeedInfo(index) {
    if (index >= 0 && index < this.feeds.length) {
      return this.feeds[index];
    }
    return null;
  }
}
