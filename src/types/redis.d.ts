declare module 'redis' {
  export interface RedisLikeMulti {
    set(key: string, value: string): unknown;
    exec(): Promise<unknown>;
  }

  export interface RedisLikeClient {
    connect(): Promise<void>;
    quit(): Promise<void>;
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<string>;
    del(key: string): Promise<number>;
    multi(): RedisLikeMulti;
  }

  export function createClient(options: { url: string }): RedisLikeClient;
}
