import type { Polka } from 'polka';
import type { BotCtxMiddleware } from '../../types';
/**
 * Interface representing a Provider HTTP Server.
 */
export interface ProviderHttpServer {
    /**
     * Polka server instance.
     */
    server: Polka;
    /**
     * Starts the HTTP server.
     * @param vendor Bot context middleware.
     * @param port Optional port number. If not provided, defaults to the port specified in the 'port' property.
     * @param args Additional arguments, such as botName.
     * @param cb Callback function to be executed after the server starts.
     */
    start(vendor: BotCtxMiddleware, cb?: (arg?: any) => void): void;
    /**
     * Stops the HTTP server.
     * @returns A Promise that resolves when the server is stopped.
     */
    stop(): Promise<void>;
    /**
     * Middleware function to handle context for incoming requests.
     * @param ctxPolka Function to handle the context.
     * @returns A function to be used as middleware.
     */
    inHandleCtx<T extends Pick<any, 'sendMessage'> & {
        provider: any;
    }>(ctxPolka: (bot: T | undefined, req: Request, res: PolkaRes) => Promise<void>): (...args: any[]) => any;
    /**
     * Retrieves a list of routes registered on the provided Polka instance.
     * @param app Polka instance.
     * @returns An array of route strings.
     */
    getListRoutes(app: Polka): string[];
    /**
     * Builds an instance of Polka HTTP server.
     * @returns A Polka instance.
     */
    buildHTTPServer(): Polka;
}
/**
 * Polka Response object interface.
 */
export type PolkaRes = {
    /**
     * Writes the HTTP response header with the specified status code and headers.
     * @param code HTTP status code.
     * @param headers Object containing the headers.
     */
    writeHead(code: number, headers: any): void;
    /**
     * Ends the response process by sending the specified data.
     * @param data Data to send as response body.
     */
    end(data: any | string): void;
};
//# sourceMappingURL=server.d.ts.map