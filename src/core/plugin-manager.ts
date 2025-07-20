import { Plugin, PluginManagerContract } from "../interfaces/plugin";
import fs from "fs";
import path from "path";

class PluginManager implements PluginManagerContract {
    plugins: Plugin[] = [];

    async loadInternalPlugins(pluginPaths: string[]): Promise<void> {
        for (const p of pluginPaths) {
            const plugin = await import(`../plugins/${p}/index.ts`);
            this.plugins.push(plugin.default);
        }
    }

    loadExternalPlugins(dirPath: string): void {
        if (!fs.existsSync(dirPath)) return;

        const pluginDirs = fs.readdirSync(dirPath);
        for (const dir of pluginDirs) {
            const pluginFile = path.join(dirPath, dir, "index.js");
            if (!fs.existsSync(pluginFile)) continue;

            try {
                const plugin: Plugin = require(pluginFile);
                if (typeof plugin.search === "function") {
                    this.plugins.push(plugin);
                    console.log(`✔ Plugin carregado: ${plugin.name}`);
                }
            } catch (err) {
                console.error(`❌ Erro ao carregar plugin: ${dir}`, err);
            }
        }
    }
}

const pluginManager = new PluginManager();
export function usePluginManager(): PluginManagerContract {
    return pluginManager;
}