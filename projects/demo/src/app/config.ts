export interface DemoConfig {
  readonly url: string;
  readonly anonKey: string;
}

declare global {
  interface Window {
    AUTHKIT_CONFIG?: DemoConfig;
  }
}

export const demoConfig: DemoConfig = window.AUTHKIT_CONFIG ?? { url: '', anonKey: '' };
