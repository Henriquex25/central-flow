import { Plugin, PluginResult } from "../../interfaces/plugin";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { exitCode } from "process";

const execAsync = promisify(exec);

interface DesktopEntry {
    name: string;
    exec: string;
    icon: string;
    desktopFile: string;
    wmClass?: string;
    startupWMClass?: string;
}

class AppLauncherPlugin implements Plugin {
    id = "app-launcher";
    name = "Applications";
    description = "Find and launch installed applications";

    private applications: DesktopEntry[] = [];
    private iconCache = new Map<string, string>();

    constructor() {
        this.loadApplications();
    }

    async search(query: string): Promise<PluginResult[]> {
        if (!query.trim()) return [];

        const results = this.applications
            .filter((app) => app.name.toLowerCase().includes(query.toLowerCase()))
            .map((app) => ({
                pluginId: this.id,
                title: app.name,
                description: `Launch application`,
                icon: this.getAppIconAsBase64(app.icon),
                score: this.calculateScore(app.name, query),
                action: () => this.launchApplication(app),
            }))
            .sort((a, b) => (b.score || 0) - (a.score || 0))
            .slice(0, 10);

        return results;
    }

    private async loadApplications(): Promise<void> {
        const applicationDirs = [
            "/usr/share/applications",
            "/usr/local/share/applications",
            `${process.env.HOME}/.local/share/applications`,
        ];

        this.applications = [];

        for (const dir of applicationDirs) {
            if (fs.existsSync(dir)) {
                const files = fs.readdirSync(dir).filter((file) => file.endsWith(".desktop"));

                for (const file of files) {
                    const filePath = path.join(dir, file);
                    const app = await this.parseDesktopFile(filePath);
                    if (app) {
                        this.applications.push(app);
                    }
                }
            }
        }
    }

    private async parseDesktopFile(filePath: string): Promise<DesktopEntry | null> {
        try {
            const content = fs.readFileSync(filePath, "utf8");
            const lines = content.split("\n");

            let name = "";
            let exec = "";
            let icon = "";
            let noDisplay = false;
            let wmClass = "";
            let startupWMClass = "";

            for (const line of lines) {
                const trimmed = line.trim();

                if (trimmed.startsWith("Name=") && !name) {
                    name = trimmed.substring(5);
                } else if (trimmed.startsWith("Exec=")) {
                    exec = trimmed.substring(5);
                } else if (trimmed.startsWith("Icon=")) {
                    icon = trimmed.substring(5);
                } else if (trimmed === "NoDisplay=true") {
                    noDisplay = true;
                } else if (trimmed.startsWith("StartupWMClass=")) {
                    startupWMClass = trimmed.substring(15);
                } else if (trimmed.startsWith("WMClass=")) {
                    wmClass = trimmed.substring(8);
                }
            }

            if (!name || !exec || noDisplay) return null;

            return {
                name,
                exec: this.cleanExecCommand(exec),
                icon,
                desktopFile: filePath,
                wmClass,
                startupWMClass,
            };
        } catch (error) {
            console.error(`Error parsing desktop file ${filePath}:`, error);
            return null;
        }
    }

    private cleanExecCommand(exec: string): string {
        // Remove field codes like %f, %F, %u, %U
        return exec.replace(/%[fFuUdDnNickvm]/g, "").trim();
    }

    private getAppIconAsBase64(iconName: string): string {
        if (!iconName) return "";

        // Se já está em cache, retorna
        if (this.iconCache.has(iconName)) {
            return this.iconCache.get(iconName)!;
        }

        const iconPath = this.findIconPath(iconName);
        if (iconPath && fs.existsSync(iconPath)) {
            try {
                const iconBase64 = this.convertToBase64(iconPath);
                this.iconCache.set(iconName, iconBase64);
                return iconBase64;
            } catch (error) {
                console.error(`Error converting icon ${iconPath}:`, error);
            }
        }

        // Se não encontrou, retorna ícone padrão
        const defaultIcon = this.getDefaultAppIcon();
        this.iconCache.set(iconName, defaultIcon);
        return defaultIcon;
    }

    private findIconPath(iconName: string): string {
        // Se é um caminho absoluto e existe
        if (path.isAbsolute(iconName) && fs.existsSync(iconName)) {
            return iconName;
        }

        // Procura nos diretórios de ícones do sistema
        const iconDirs = [
            "/usr/share/icons",
            "/usr/share/pixmaps",
            `${process.env.HOME}/.local/share/icons`,
            `${process.env.HOME}/.icons`,
        ];

        const iconSizes = ["48", "32", "24", "16"];
        const iconExtensions = [".png", ".svg", ".xpm"];
        const themes = ["hicolor", "Adwaita", "ubuntu-mono-light", "Humanity"];

        for (const baseDir of iconDirs) {
            if (!fs.existsSync(baseDir)) continue;

            // Primeiro tenta encontrar em temas específicos
            for (const theme of themes) {
                const themeDir = path.join(baseDir, theme);
                if (!fs.existsSync(themeDir)) continue;

                for (const size of iconSizes) {
                    const sizeDir = path.join(themeDir, `${size}x${size}`, "apps");
                    if (!fs.existsSync(sizeDir)) continue;

                    for (const ext of iconExtensions) {
                        const iconPath = path.join(sizeDir, iconName + ext);
                        if (fs.existsSync(iconPath)) {
                            return iconPath;
                        }
                    }
                }

                // Tenta scalable
                const scalableDir = path.join(themeDir, "scalable", "apps");
                if (fs.existsSync(scalableDir)) {
                    for (const ext of iconExtensions) {
                        const iconPath = path.join(scalableDir, iconName + ext);
                        if (fs.existsSync(iconPath)) {
                            return iconPath;
                        }
                    }
                }
            }

            // Se não encontrou em temas, procura diretamente no diretório
            for (const ext of iconExtensions) {
                const iconPath = path.join(baseDir, iconName + ext);
                if (fs.existsSync(iconPath)) {
                    return iconPath;
                }
            }
        }

        return "";
    }

    private convertToBase64(filePath: string): string {
        const fileBuffer = fs.readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase();

        let mimeType = "image/png";
        switch (ext) {
            case ".svg":
                mimeType = "image/svg+xml";
                break;
            case ".jpg":
            case ".jpeg":
                mimeType = "image/jpeg";
                break;
            case ".png":
                mimeType = "image/png";
                break;
            case ".xpm":
                mimeType = "image/x-xpixmap";
                break;
        }

        return `data:${mimeType};base64,${fileBuffer.toString("base64")}`;
    }

    private getDefaultAppIcon(): string {
        const defaultSvg = `
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="48" height="48" rx="8" fill="#3B82F6"/>
                <rect x="12" y="12" width="24" height="24" rx="4" fill="white" fill-opacity="0.9"/>
                <circle cx="18" cy="18" r="2" fill="#3B82F6"/>
                <rect x="22" y="16" width="8" height="2" rx="1" fill="#3B82F6"/>
                <rect x="22" y="20" width="6" height="2" rx="1" fill="#3B82F6"/>
                <rect x="14" y="26" width="16" height="2" rx="1" fill="#3B82F6"/>
                <rect x="14" y="30" width="12" height="2" rx="1" fill="#3B82F6"/>
            </svg>
        `;

        return `data:image/svg+xml;base64,${Buffer.from(defaultSvg).toString("base64")}`;
    }

    private calculateScore(appName: string, query: string): number {
        const lowerAppName = appName.toLowerCase();
        const lowerQuery = query.toLowerCase();

        if (lowerAppName === lowerQuery) return 100;
        if (lowerAppName.startsWith(lowerQuery)) return 90;
        if (lowerAppName.includes(lowerQuery)) return 70;

        // Busca por palavras
        const words = lowerQuery.split(" ");
        let wordMatches = 0;
        for (const word of words) {
            if (lowerAppName.includes(word)) {
                wordMatches++;
            }
        }

        return (wordMatches / words.length) * 50;
    }

    private async launchApplication(app: DesktopEntry): Promise<void> {
        try {
            // Verifica se a aplicação já está rodando
            const windowInfo = await this.findApplicationWindow(app);

            // Se Ctrl foi pressionado ou não há janela ativa, abre nova instância
            const ctrlPressed = await this.isCtrlPressed();

            if (ctrlPressed || !windowInfo) {
                // Abre nova instância
                await this.startNewInstance(app);
            } else {
                // Foca na janela existente
                await this.focusWindow(windowInfo.windowId);
            }
        } catch (error) {
            console.error("Error launching application:", error);
            // Fallback: tenta abrir nova instância
            await this.startNewInstance(app);
        }
    }

    private async findApplicationWindow(app: DesktopEntry): Promise<{ windowId: string; pid: string } | null> {
        try {
            // Usa wmctrl para listar janelas
            const { stdout } = await execAsync("wmctrl -lp");
            const lines = stdout.split("\n").filter((line) => line.trim());

            for (const line of lines) {
                const parts = line.split(/\s+/);
                if (parts.length < 4) continue;

                const windowId = parts[0];
                const pid = parts[2];
                const windowTitle = parts.slice(4).join(" ");

                // Verifica se a janela pertence à aplicação
                if (await this.isApplicationWindow(app, pid, windowTitle)) {
                    return { windowId, pid };
                }
            }

            return null;
        } catch (error) {
            return null;
        }
    }

    private async isApplicationWindow(app: DesktopEntry, pid: string, windowTitle: string): Promise<boolean> {
        try {
            // Obtém o comando do processo
            const { stdout } = await execAsync(`ps -p ${pid} -o comm=`);
            const processName = stdout.trim();

            // Extrai o nome do executável do comando Exec
            const execName = path.basename(app.exec.split(" ")[0]);

            // Verifica se o processo corresponde
            if (processName === execName || processName.includes(execName)) {
                return true;
            }

            // Verifica WMClass se disponível
            if (app.wmClass || app.startupWMClass) {
                const wmClass = app.wmClass || app.startupWMClass;
                if (windowTitle.toLowerCase().includes(wmClass.toLowerCase())) {
                    return true;
                }
            }

            // Verifica se o título da janela contém o nome da aplicação
            if (windowTitle.toLowerCase().includes(app.name.toLowerCase())) {
                return true;
            }

            return false;
        } catch (error) {
            return false;
        }
    }

    private async focusWindow(windowId: string): Promise<void> {
        try {
            await execAsync(`wmctrl -ia ${windowId}`);
        } catch (error) {
            console.error("Error focusing window:", error);
        }
    }

    private async startNewInstance(app: DesktopEntry): Promise<void> {
        try {
            // Usa nohup para não bloquear o processo
            exec(`nohup ${app.exec} > /dev/null 2>&1 &`);
        } catch (error) {
            console.error("Error starting new instance:", error);
        }
    }

    private async isCtrlPressed(): Promise<boolean> {
        // Esta função precisa ser implementada no contexto do Electron
        // para verificar se Ctrl está pressionado no momento da ação
        // Por enquanto, retorna false como padrão

        // No contexto do Electron, você pode usar:
        // const { globalShortcut } = require('electron');
        // ou verificar o estado das teclas no renderer process

        return false;
    }
}

// Função para instalar dependências necessárias (executar uma vez)
export async function installDependencies(): Promise<void> {
    try {
        // Verifica se wmctrl está instalado
        await execAsync("which wmctrl");
    } catch (error) {
        console.log("Installing wmctrl...");
        try {
            await execAsync("sudo apt-get update && sudo apt-get install -y wmctrl");
            console.log("wmctrl installed successfully");
        } catch (installError) {
            console.error("Failed to install wmctrl. Please install manually: sudo apt-get install wmctrl");
        }
    }
}

export default new AppLauncherPlugin();