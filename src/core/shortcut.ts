// shortcut.ts
import { globalShortcut, BrowserWindow } from "electron";

export function registerShortcut(win: BrowserWindow) {
    globalShortcut.register("Control+Space", () => {
        win.show();
        win.focus();
    });
}
