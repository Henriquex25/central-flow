import SearchResultDTO from "./interfaces/results";

export {};

declare global {
    interface Window {
        electronAPI: {
            invokeSearch: (query: string) => Promise<any[]>;
            invokeAction: (resultId: string) => Promise<void>;
            resizeWindow: (height: number | undefined) => void;
            showMainWindow: (callback: (results: SearchResultDTO[]) => void) => void;
            hideMainWindow: (callback: () => void) => void;
        };
    }
}
