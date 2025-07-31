import { usePluginManager } from "./plugin-manager";
import { SearchResult, SearchResultDTO, ResultManagerContract } from "../interfaces/results";
import { PluginManagerContract } from "src/interfaces/plugin";

const pluginManager: PluginManagerContract = usePluginManager();

class ResultManager implements ResultManagerContract {
    private results: SearchResult[] = [];

    constructor(private pluginManager: PluginManagerContract) {}

    public async search(query: string, plugin_id?: string): Promise<SearchResultDTO[]> {
        const results = plugin_id ?
            await this.pluginManager.plugins.find((plugin) => plugin.id === plugin_id)?.search(query) ?? [] :
            await Promise.all(this.pluginManager.plugins.map((plugin) => plugin.search(query)));

        const pluginPriorityMap = new Map<string, number>();
        this.pluginManager.plugins.forEach((plugin) => {
            pluginPriorityMap.set(plugin.id, plugin.priority ?? 0);
        });

        this.results = results
            .flat()
            .map((res, index) => {
                const id = crypto.randomUUID();
                const pluginPriority = pluginPriorityMap.get(res.pluginId) ?? 0;

                return {
                    id,
                    title: res.title,
                    icon: res.icon,
                    pluginId: res.pluginId,
                    pluginPriority,
                    action: res.action,
                };
            })
            .sort((a, b) => {
                // Primeiro critério: prioridade (decrescente - maior prioridade primeiro)
                if (a.pluginPriority !== b.pluginPriority) {
                    return b.pluginPriority - a.pluginPriority;
                }

                // Segundo critério: título (alfabético - como desempate)
                return a.title.localeCompare(b.title);
            });;

        console.log("Search query:", query);
        console.log("Search results:", this.results);

        return this.results.map(({ id, title, icon }) => ({ id, title, icon }));
    }

    public async execute(resultId: string): Promise<void> {
        console.log("Executing action for result ID:", resultId);

        const result = this.results.find((r) => r.id === resultId);
        if (!result) throw new Error(`Result with id ${resultId} not found`);
        result.action();
    }
}

export const resultManager = new ResultManager(pluginManager);
export function useResultManager() {
    return resultManager;
}
