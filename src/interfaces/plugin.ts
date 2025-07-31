export interface PluginManagerContract {
    plugins: Plugin[];
    loadInternalPlugins(pluginPaths: string[]): Promise<void>;
    loadExternalPlugins(dirPath: string): void;
}

export interface Plugin {
    id: string;
    name: string;
    description?: string;
    priority?: number; // Prioridade do plugin (opcional, padrão é 0)
    search: (query: string) => Promise<PluginResult[]>;
}

// Resultado retornado por um plugin
export interface PluginResult {
    pluginId: string;
    title: string;
    description?: string;
    icon?: string;
    score?: number;
    action: () => void;
}
