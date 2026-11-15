import type { IncomingMessage, ServerResponse } from 'http';

export declare function p2pMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next?: () => void
): void;
