/**
 * Pluggable data layer for EW signal app.
 * Swap in DummyDataProvider, RestDataProvider, or WebSocketDataProvider.
 */

export interface Threat {
  id: string;
  label: string;
  confidence: number;
  bearing: number;
}

export interface DeviceState {
  heading: number;
  latitude?: number;
  longitude?: number;
}

export interface DataPayload {
  threats: Threat[];
  device: DeviceState;
}

export type DataCallback = (data: DataPayload) => void;

export class DataProvider {
  subscribe(_callback: DataCallback): () => void {
    return () => {};
  }

  connect(): void {}
  disconnect(): void {}
}

export class DummyDataProvider extends DataProvider {
  private _interval: ReturnType<typeof setInterval> | null = null;
  private _listeners = new Set<DataCallback>();
  private _threats: Threat[] = [
    { id: '1', label: 'DRONE', confidence: 0.88, bearing: 45 },
    { id: '2', label: 'RADAR', confidence: 0.62, bearing: 210 },
    { id: '3', label: 'COMMS', confidence: 0.41, bearing: 310 },
  ];
  private _device: DeviceState = { heading: 0 };

  subscribe(callback: DataCallback): () => void {
    this._listeners.add(callback);
    callback({ threats: this._threats, device: this._device });
    return () => this._listeners.delete(callback);
  }

  connect(): void {
    let baseHeading = 45;
    let wobble = 0;
    let tickCount = 0;
    this._interval = setInterval(() => {
      tickCount++;
      if (Math.random() < 0.7) {
        wobble += (Math.random() - 0.5) * 6;
      } else {
        wobble += (Math.random() - 0.5) * 16;
      }
      wobble = Math.max(-22, Math.min(22, wobble));
      wobble *= 0.88;
      const heading = ((baseHeading + wobble) % 360 + 360) % 360;
      if (tickCount % 20 === 10) {
        baseHeading = (baseHeading + (Math.random() - 0.5) * 24 + 360) % 360;
      }
      this._device = { ...this._device, heading };
      this._listeners.forEach((cb) => cb({ threats: this._threats, device: this._device }));
    }, 200);
  }

  disconnect(): void {
    if (this._interval) clearInterval(this._interval);
    this._interval = null;
  }
}

export interface RestDataProviderOptions {
  baseUrl?: string;
  threatsUrl?: string;
  deviceUrl?: string;
  pollMs?: number;
}

export class RestDataProvider extends DataProvider {
  private _baseUrl: string;
  private _threatsUrl: string;
  private _deviceUrl: string;
  private _pollMs: number;
  private _pollTimer: ReturnType<typeof setInterval> | null = null;
  private _listeners = new Set<DataCallback>();

  constructor(options: RestDataProviderOptions = {}) {
    super();
    this._baseUrl = options.baseUrl ?? '';
    this._threatsUrl = options.threatsUrl ?? '/api/threats';
    this._deviceUrl = options.deviceUrl ?? '/api/device';
    this._pollMs = options.pollMs ?? 2000;
  }

  subscribe(callback: DataCallback): () => void {
    this._listeners.add(callback);
    this._fetch();
    return () => this._listeners.delete(callback);
  }

  private async _fetch(): Promise<void> {
    try {
      const [threatsRes, deviceRes] = await Promise.all([
        fetch(this._baseUrl + this._threatsUrl).then((r) => r.json()) as Promise<Threat[] | { threats: Threat[] }>,
        fetch(this._baseUrl + this._deviceUrl).then((r) => r.json()) as Promise<DeviceState | { device: DeviceState }>,
      ]);
      const threats = Array.isArray(threatsRes) ? threatsRes : (threatsRes?.threats ?? []);
      const device = (deviceRes && typeof deviceRes === 'object' && 'heading' in deviceRes)
        ? (deviceRes as DeviceState)
        : ((deviceRes as { device?: DeviceState })?.device ?? { heading: 0 });
      this._listeners.forEach((cb) => cb({ threats, device }));
    } catch (e) {
      console.warn('RestDataProvider fetch failed', e);
    }
  }

  connect(): void {
    this._pollTimer = setInterval(() => this._fetch(), this._pollMs);
  }

  disconnect(): void {
    if (this._pollTimer) clearInterval(this._pollTimer);
    this._pollTimer = null;
  }
}

export interface WebSocketDataProviderOptions {
  url?: string;
}

export class WebSocketDataProvider extends DataProvider {
  private _url: string;
  private _ws: WebSocket | null = null;
  private _listeners = new Set<DataCallback>();

  constructor(options: WebSocketDataProviderOptions = {}) {
    super();
    this._url = options.url ?? 'wss://example.com/ew-signals';
  }

  subscribe(callback: DataCallback): () => void {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  connect(): void {
    if (this._ws?.readyState === WebSocket.OPEN) return;
    try {
      this._ws = new WebSocket(this._url);
      this._ws.onmessage = (ev: MessageEvent) => {
        try {
          const data = JSON.parse(ev.data as string) as { threats?: Threat[]; device?: DeviceState };
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

  disconnect(): void {
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
  }
}
