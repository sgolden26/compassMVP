/**
 * Pluggable data layer for EW signal app.
 * Swap in DummyDataProvider, RestDataProvider, or WebSocketDataProvider.
 */

/**
 * @typedef {Object} Threat
 * @property {string} id
 * @property {string} label - e.g. "DRONE", "RADAR"
 * @property {number} confidence - 0–1
 * @property {number} bearing - degrees 0–360 (direction from user to threat)
 */

/**
 * @typedef {Object} DeviceState
 * @property {number} heading - device compass heading 0–360
 * @property {number} [latitude]
 * @property {number} [longitude]
 */

/**
 * Interface for signal/location data. Implement for dummy, REST, or WebSocket.
 */
export class DataProvider {
  /**
   * Subscribe to threat and device updates (called with new data).
   * @param {(data: { threats: Threat[], device: DeviceState }) => void} callback
   * @returns {() => void} unsubscribe
   */
  subscribe(callback) {
    return () => {};
  }

  connect() {}
  disconnect() {}
}

/**
 * Dummy data for offline MVP. Replace with REST/WebSocket or external dataset.
 */
export class DummyDataProvider extends DataProvider {
  constructor() {
    super();
    this._interval = null;
    this._listeners = new Set();
    this._threats = [
      { id: '1', label: 'DRONE', confidence: 0.88, bearing: 45 },
      { id: '2', label: 'RADAR', confidence: 0.62, bearing: 210 },
      { id: '3', label: 'COMMS', confidence: 0.41, bearing: 310 },
    ];
    this._device = { heading: 0 };
  }

  subscribe(callback) {
    this._listeners.add(callback);
    callback({ threats: this._threats, device: this._device });
    return () => this._listeners.delete(callback);
  }

  connect() {
    // Realistic heading: mostly stable, wobbly left/right, occasional turn
    let baseHeading = 45;
    let wobble = 0;
    let tickCount = 0;
    this._interval = setInterval(() => {
      tickCount++;
      // Small wobble most of the time; bigger nudge sometimes
      if (Math.random() < 0.7) {
        wobble += (Math.random() - 0.5) * 6;
      } else {
        wobble += (Math.random() - 0.5) * 16;
      }
      wobble = Math.max(-22, Math.min(22, wobble));
      wobble *= 0.88; // drift back toward center
      const heading = ((baseHeading + wobble) % 360 + 360) % 360;
      // Every ~4 s, occasional turn so base direction shifts a bit
      if (tickCount % 20 === 10) {
        baseHeading = (baseHeading + (Math.random() - 0.5) * 24 + 360) % 360;
      }
      this._device = { ...this._device, heading };
      this._listeners.forEach((cb) => cb({ threats: this._threats, device: this._device }));
    }, 200);
  }

  disconnect() {
    if (this._interval) clearInterval(this._interval);
    this._interval = null;
  }
}

/**
 * Stub: REST polling. Implement with your API base URL and endpoints.
 */
export class RestDataProvider extends DataProvider {
  constructor(options = {}) {
    super();
    this._baseUrl = options.baseUrl || '';
    this._threatsUrl = options.threatsUrl || '/api/threats';
    this._deviceUrl = options.deviceUrl || '/api/device';
    this._pollMs = options.pollMs || 2000;
    this._pollTimer = null;
    this._listeners = new Set();
  }

  subscribe(callback) {
    this._listeners.add(callback);
    this._fetch();
    return () => this._listeners.delete(callback);
  }

  async _fetch() {
    try {
      const [threatsRes, deviceRes] = await Promise.all([
        fetch(this._baseUrl + this._threatsUrl).then((r) => r.json()),
        fetch(this._baseUrl + this._deviceUrl).then((r) => r.json()),
      ]);
      const data = {
        threats: Array.isArray(threatsRes) ? threatsRes : threatsRes?.threats ?? [],
        device: deviceRes?.device ?? deviceRes ?? { heading: 0 },
      };
      this._listeners.forEach((cb) => cb(data));
    } catch (e) {
      console.warn('RestDataProvider fetch failed', e);
    }
  }

  connect() {
    this._pollTimer = setInterval(() => this._fetch(), this._pollMs);
  }

  disconnect() {
    if (this._pollTimer) clearInterval(this._pollTimer);
    this._pollTimer = null;
  }
}

/**
 * Stub: WebSocket for real-time signal data.
 */
export class WebSocketDataProvider extends DataProvider {
  constructor(options = {}) {
    super();
    this._url = options.url || 'wss://example.com/ew-signals';
    this._ws = null;
    this._listeners = new Set();
  }

  subscribe(callback) {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  connect() {
    if (this._ws?.readyState === WebSocket.OPEN) return;
    try {
      this._ws = new WebSocket(this._url);
      this._ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          this._listeners.forEach((cb) => cb({
            threats: data.threats ?? [],
            device: data.device ?? { heading: 0 },
          }));
        } catch (e) {
          console.warn('WebSocket message parse failed', e);
        }
      };
      this._ws.onclose = () => { this._ws = null; };
    } catch (e) {
      console.warn('WebSocket connect failed', e);
    }
  }

  disconnect() {
    if (this._ws) { this._ws.close(); this._ws = null; }
  }
}
