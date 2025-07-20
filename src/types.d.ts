export {};

declare global {
    interface Window {
        electronAPI: {
            invokeSearch: (query: string) => Promise<any[]>;
            invokeAction: (resultId: string) => Promise<void>;
            resizeWindow: (height: number) => void;
        };
    }
}
