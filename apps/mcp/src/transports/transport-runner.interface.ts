/** Connects servers to a transport until stopped. */
export interface TransportRunner {
  start(): Promise<void>;

  stop(): Promise<void>;
}
