import { usePluginManager } from "./plugin-manager";
import { SearchResult, SearchResultDTO, ResultManagerContract } from "../interfaces/results";
import { PluginManagerContract } from "src/interfaces/plugin";

const pluginManager: PluginManagerContract = usePluginManager();

class ResultManager implements ResultManagerContract {
    private results: SearchResult[] = [];

    constructor(private pluginManager: PluginManagerContract) {}

    public async search(query: string): Promise<SearchResultDTO[]> {
        const results = await Promise.all(this.pluginManager.plugins.map((plugin) => plugin.search(query)));

        this.results = results.flat().map((res, index) => {
            const id = crypto.randomUUID();
            return {
                id,
                title: res.title,
                icon: res.icon,
                pluginId: res.pluginId,
                action: res.action,
            };
        });

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
