export interface Logger {
  info: (message: string) => void;
}

export const NOOP_LOGGER: Logger = {
  info: () => {},
};

export function getLogger(options: { logger?: Logger }): Logger {
  return options.logger ?? NOOP_LOGGER;
}
