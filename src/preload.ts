// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
    invokeSearch: (query: string): Promise<any[]> => {
        console.log("Preload:", query);

        return ipcRenderer.invoke("search", query);
    },
    invokeAction: (resultId: string): Promise<void> => ipcRenderer.invoke("execute-action", resultId),
    resizeWindow: (height: number) => ipcRenderer.send("resize-window", height),
});