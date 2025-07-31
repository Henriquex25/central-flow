import { PluginResult } from "./plugin";

export interface ResultManagerContract {
    search(query: string): Promise<SearchResultDTO[]>;
    execute(id: string): void;
};

export interface SearchResult extends PluginResult {
    id: string;
};

export interface SearchResultDTO {
    id: string;
    title: string;
    icon?: string;
};
