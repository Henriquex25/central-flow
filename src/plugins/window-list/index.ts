import { Plugin, PluginResult } from "../../interfaces/plugin";
import { exec } from "child_process";
import util from "util";

const execAsync = util.promisify(exec);

const windowListPlugin: Plugin = {
    id: "window-list",
    name: "Janela Ativa",
    async search(query: string): Promise<PluginResult[]> {
        console.log("plugin window-list search:", query);

        const { stdout } = await execAsync("wmctrl -l");

        console.log("wmctrl output:", stdout);

        const result = stdout
            .split("\n")
            .map((line, index) => {
                const parts = line.trim().split(/\s+/);
                const windowId = parts[0];
                const desktop = parts[1];
                const title = parts.slice(3).join(" ");

                if (!windowId || !title || !desktop) {
                    return null;
                }

                return {
                    pluginId: this.id,
                    title: title
                        .trim()
                        .toLowerCase()
                        .split(" ")
                        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(" "),
                    action: () => exec(`wmctrl -ia ${windowId}`),
                };
            })
            .filter((window) => {
                return (
                    window &&
                    window.title.length > 0 &&
                    !window.title.startsWith("@!") &&
                    window.title.toLowerCase().includes(query.toLowerCase())
                );
            });

        console.log("Search results:", result);

        return result;
    },
};

export default windowListPlugin;
