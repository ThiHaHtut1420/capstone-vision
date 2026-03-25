// Feed Manager - handles loading and managing CCTV feeds

/** Hosts known to send Access-Control-Allow-Origin on playlists + segments (Chrome can use hls.js without our proxy). */
function hlsWorksDirectInBrowser(url) {
  try {
    const { hostname } = new URL(url);
    const h = hostname.toLowerCase();
    if (h === 'streaming1.dsatmacau.com' || h.endsWith('.dsatmacau.com')) return true;
    if (h === 'test-streams.mux.dev' || h.endsWith('.mux.dev')) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Safari / WebKit: drawing cross-origin HLS <video> into a p5 canvas often fails (blank / SecurityError)
 * even when CORS headers exist. Chromium is looser. Same-origin /proxy/hls/... fixes canvas compositing.
 */
function browserNeedsHlsProxyForCanvas() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return (
    /Safari/i.test(ua) &&
    !/Chrome|Chromium|CriOS|OPR|OPiOS|Edg|EdgiOS|FxiOS|Android/i.test(ua)
  );
}

/** Snapshot/image URLs that send CORS * (safe for canvas via createImg + crossOrigin). */
function imageWorksDirectInBrowser(url) {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return h === 'imgproxy.windy.com';
  } catch {
    return false;
  }
}

function cacheBustSrc(base) {
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}_t=${Date.now()}`;
}

class FeedManager {
  constructor() {
    this.feeds = [];
    this.videos = [];
    this.images = []; // For MJPEG streams
    this.loadingStates = [];
    this.lastUpdateTime = [];
    this.hlsInstances = [];
    this.lastOkTime = [];
    this.lastErrorMessage = [];
    this.proxyUrls = [];
    this.intervals = [];
  }

  loadFeeds(feedConfigs) {
    this.feeds = feedConfigs.filter(feed => feed.enabled && feed.type !== 'webcam');
    this.videos = [];
    this.images = [];
    this.loadingStates = [];
    this.lastUpdateTime = [];
    this.hlsInstances = [];
    this.lastOkTime = [];
    this.lastErrorMessage = [];
    this.proxyUrls = [];

    // Cleanup prior refresh intervals
    if (this.intervals?.length) {
      for (const id of this.intervals) {
        if (id) clearInterval(id);
      }
    }
    this.intervals = [];

    for (let i = 0; i < this.feeds.length; i++) {
      const feed = this.feeds[i];
      this.loadingStates[i] = { loading: true, error: false };
      this.lastUpdateTime[i] = 0;
      this.lastOkTime[i] = 0;
      this.lastErrorMessage[i] = '';
      
      if (feed.type === 'mjpeg' || feed.type === 'mjpg') this.loadMJPEGFeed(i, feed);
      else if (feed.type === 'image') this.loadImageFeed(i, feed);
      else if (feed.type === 'earthcam') this.loadEarthcamFeed(i, feed);
      else if (feed.type === 'hls') this.loadHLSFeed(i, feed);
      else if (feed.type === 'http' || feed.type === 'video' || feed.type === 'videoFile') this.loadVideoFeed(i, feed);
    }
  }

  buildProxyUrl(path, upstreamUrl) {
    return `${path}?url=${encodeURIComponent(upstreamUrl)}`;
  }

  markOk(index) {
    this.loadingStates[index].loading = false;
    this.loadingStates[index].error = false;
    this.lastUpdateTime[index] = millis();
    this.lastOkTime[index] = millis();
    this.lastErrorMessage[index] = '';
  }

  markError(index, message) {
    this.loadingStates[index].loading = false;
    this.loadingStates[index].error = true;
    this.lastErrorMessage[index] = message || 'Unknown error';
  }

  loadImageFeed(index, feed) {
    const useProxy = feed.forceImageProxy === true || !imageWorksDirectInBrowser(feed.url);
    const fetchBase = useProxy
      ? `/proxy/image?url=${encodeURIComponent(feed.url)}`
      : feed.url;
    this.proxyUrls[index] = fetchBase;

    const firstSrc = cacheBustSrc(fetchBase);
    // p5: third string arg sets crossOrigin before src (needed for imgproxy.windy.com → canvas).
    const img = useProxy
      ? createImg(firstSrc, feed.id || '')
      : createImg(firstSrc, feed.id || '', 'anonymous');
    img.hide();

    img.elt.onload = () => this.markOk(index);
    img.elt.onerror = () => {
      this.markError(index, `Failed to load image feed: ${feed.id}`);
      console.error(`Failed to load image feed: ${feed.id}`);
    };

    this.images[index] = img;
    this.feeds[index] = feed;

    const refreshMs = Number.isFinite(feed.refreshMs) ? feed.refreshMs : 2000;
    const refreshInterval = setInterval(() => {
      if (this.images[index] && !this.loadingStates[index].error) {
        this.images[index].elt.src = cacheBustSrc(fetchBase);
      }
    }, refreshMs);
    this.intervals[index] = refreshInterval;
  }

  loadMJPEGFeed(index, feed) {
    // For MJPEG streams, we use an img element that we update periodically
    const proxyUrl = `/proxy/mjpeg?url=${encodeURIComponent(feed.url)}`;
    this.proxyUrls[index] = proxyUrl;

    const img = createImg(proxyUrl, feed.id);
    img.hide();
    
    const self = this;
    img.elt.onload = () => {
      self.markOk(index);
    };

    img.elt.onerror = () => {
      self.markError(index, `Failed to load MJPEG feed: ${feed.id}`);
      console.error(`Failed to load MJPEG feed: ${feed.id}`);
    };

    this.images[index] = img;
    this.feeds[index] = feed; // Store feed for refresh

    // Some feeds are actually snapshots mis-labeled as MJPEG; allow optional refresh
    if (Number.isFinite(feed.refreshMs) && feed.refreshMs > 0) {
      const refreshInterval = setInterval(() => {
        if (self.images[index] && !self.loadingStates[index].error) {
          self.images[index].elt.src = `${proxyUrl}&ts=${Date.now()}`;
        }
      }, feed.refreshMs);
      this.intervals[index] = refreshInterval;
    }
  }

  loadEarthcamFeed(index, feed) {
    const { page, cam } = feed;
    if (!page || !cam) {
      this.markError(index, 'EarthCam feed requires "page" and "cam"');
      return;
    }
    // `ts` busts browser cache; server ignores it. Each tile gets its own URL string.
    const playlistUrl = `/proxy/earthcam/hls.m3u8?page=${encodeURIComponent(page)}&cam=${encodeURIComponent(cam)}&ts=${Date.now()}`;
    this.attachHlsPlaylist(index, feed, playlistUrl);
  }

  loadHLSFeed(index, feed) {
    const useProxy = feed.forceProxy === true || !hlsWorksDirectInBrowser(feed.url);
    const playlistUrl = useProxy
      ? `/proxy/hls/playlist.m3u8?url=${encodeURIComponent(feed.url)}`
      : feed.url;
    this.attachHlsPlaylist(index, feed, playlistUrl);
  }

  attachHlsPlaylist(index, feed, playlistUrl) {
    this.proxyUrls[index] = playlistUrl;

    // p5 createVideo() with no args uses src=[''] and adds <source src=""> children,
    // which breaks hls.js / MSE. Empty array adds no <source> tags.
    const video = createVideo([]);
    video.hide();
    video.volume(0);

    const elt = video.elt;
    if (elt) {
      elt.muted = true;
      elt.setAttribute('muted', '');
      elt.setAttribute('playsinline', '');
      elt.setAttribute('webkit-playsinline', '');
      while (elt.firstChild) elt.removeChild(elt.firstChild);
      elt.removeAttribute('src');
    }

    const self = this;

    elt.onloadeddata = () => self.markOk(index);
    elt.oncanplay = () => self.markOk(index);
    elt.addEventListener('playing', () => self.markOk(index), { once: true });
    elt.onerror = (e) => {
      self.markError(index, `Failed to load HLS feed: ${feed.id}`);
      console.error(`Failed to load HLS feed: ${feed.id}`, e);
    };

    const canPlayNatively =
      elt &&
      typeof elt.canPlayType === 'function' &&
      elt.canPlayType('application/vnd.apple.mpegurl') !== '';

    const hlsJsSupported =
      typeof window !== 'undefined' && window.Hls && window.Hls.isSupported();
    // Safari advertises native HLS but drawing that video to a 2D canvas often throws (SecurityError).
    // MSE via hls.js matches Chrome and composites reliably.
    const useHlsJs =
      hlsJsSupported && (!canPlayNatively || browserNeedsHlsProxyForCanvas());

    if (useHlsJs) {
      // No crossOrigin here: MSE buffers from hls.js are not the same as a single cross-origin src,
      // and anonymous can interfere with playback in some browsers.
      const hls = new window.Hls({
        enableWorker: false,
        lowLatencyMode: true,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 12,
        liveDurationInfinity: true,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        // iOS 17.1+ / Safari: improves MSE path when native HLS would taint canvas
        preferManagedMediaSource: true
      });
      this.hlsInstances[index] = hls;

      hls.on(window.Hls.Events.ERROR, (_event, data) => {
        if (!data?.fatal) return;
        try {
          if (data.type === 'networkError') {
            hls.startLoad();
            return;
          }
          if (data.type === 'mediaError') {
            hls.recoverMediaError();
            return;
          }
        } catch (_) {}
        self.markError(index, `HLS fatal: ${data.type || 'unknown'}`);
        try {
          hls.destroy();
        } catch (_) {}
      });

      hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        self.markOk(index);
        elt.play().catch(() => {});
      });

      hls.loadSource(playlistUrl);
      hls.attachMedia(elt);
    } else if (canPlayNatively) {
      // Native HLS fallback (e.g. Safari without MSE / old WebKit).
      const proxied =
        typeof playlistUrl === 'string' &&
        playlistUrl.startsWith('/') &&
        typeof window !== 'undefined';
      if (proxied) {
        elt.removeAttribute('crossOrigin');
      } else {
        elt.crossOrigin = 'anonymous';
      }
      elt.src = playlistUrl;
      elt.play().catch(() => {});
    } else {
      self.markError(index, 'HLS not supported in this browser');
    }

    try {
      video.play();
      elt.play().catch(() => {});
    } catch (_) {}

    this.videos[index] = video;
  }

  /** Call after a user gesture if autoplay blocked (muted streams usually start anyway). */
  nudgeAllPlayback() {
    for (let i = 0; i < this.videos.length; i++) {
      const v = this.videos[i];
      const el = v?.elt;
      if (el && el.tagName === 'VIDEO' && el.paused) {
        el.play().catch(() => {});
      }
    }
  }

  loadVideoFeed(index, feed) {
    // Same path as type:hls — Safari native HLS + canvas often throws; attachHlsPlaylist forces hls.js there.
    if (typeof feed.url === 'string' && feed.url.includes('.m3u8')) {
      const useHlsProxy =
        !hlsWorksDirectInBrowser(feed.url) || browserNeedsHlsProxyForCanvas();
      const playlistUrl = useHlsProxy
        ? `/proxy/hls/playlist.m3u8?url=${encodeURIComponent(feed.url)}`
        : feed.url;
      this.attachHlsPlaylist(index, feed, playlistUrl);
      return;
    }

    const video = createVideo(feed.url);
    video.hide();
    video.volume(0);
    if (video.elt) {
      video.elt.muted = true;
      video.elt.setAttribute('muted', '');
      video.elt.setAttribute('playsinline', '');
      video.elt.setAttribute('webkit-playsinline', '');
    }

    const self = this;

    if (video.elt) {
      video.elt.crossOrigin = 'anonymous';
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

  getDiagnostics(index) {
    const feed = this.getFeedInfo(index);
    const upstream =
      feed?.url ??
      (feed?.type === 'earthcam' && feed?.page ? `${feed.page} (${feed.cam})` : '');
    return {
      id: feed?.id ?? `feed_${index}`,
      type: feed?.type ?? 'unknown',
      upstreamUrl: upstream,
      proxyUrl: this.proxyUrls[index] ?? '',
      loading: this.isLoading(index),
      error: this.hasError(index),
      lastOkMs: this.lastOkTime[index] ?? 0,
      lastError: this.lastErrorMessage[index] ?? ''
    };
  }
}
