import { Plugin, PluginResult } from "../../interfaces/plugin";
import { exec } from "child_process";
import { promisify } from "util";
import IconManager from "../../core/utils/IconManager";

const execAsync = promisify(exec);

interface WindowInfo {
    windowId: string;
    desktop: string;
    title: string;
    appName?: string;
    className?: string;
    pid?: string;
}

class WindowListPlugin implements Plugin {
    id = "window-list";
    name = "Janela Ativa";
    priority = 1;

    async search(query: string): Promise<PluginResult[]> {
        console.log("plugin window-list search:", query);

        try {
            // Obter lista básica de janelas
            const { stdout: wmctrlOutput } = await execAsync("wmctrl -l");
            console.log("wmctrl output:", wmctrlOutput);

            const windows: WindowInfo[] = [];

            for (const line of wmctrlOutput.split("\n")) {
                if (!line.trim()) continue;

                const parts = line.trim().split(/\s+/);
                const windowId = parts[0];
                const desktop = parts[1];
                const title = parts.slice(3).join(" ");

                if (!windowId || !title || !desktop) continue;

                // Obter informações adicionais da janela
                const windowInfo = await getWindowDetails(windowId);

                windows.push({
                    windowId,
                    desktop,
                    title: title.trim(),
                    ...windowInfo,
                });
            }

            const results = windows
                .map((window) => {
                    const formattedTitle = formatWindowTitle(window);

                    return {
                        pluginId: this.id,
                        title: formattedTitle,
                        description: `Desktop ${window.desktop}`,
                        icon: IconManager.getAppIcon(window.className || window.appName || "unknown"),
                        action: () => exec(`wmctrl -ia ${window.windowId}`),
                    };
                })
                .filter((window) => {
                    return (
                        window &&
                        window.title.length > 0 &&
                        !window.title.includes("@!") &&
                        window.title.toLowerCase().includes(query.toLowerCase().trim())
                    );
                });

            console.log("Search results:", results);
            return results;
        } catch (error) {
            console.error("Erro ao buscar janelas:", error);
            return [];
        }
    }
}

async function getWindowDetails(windowId: string): Promise<Partial<WindowInfo>> {
    try {
        // Tentar obter informações detalhadas usando xprop
        const { stdout: xpropOutput } = await execAsync(`xprop -id ${windowId} WM_CLASS _NET_WM_PID WM_NAME`);

        const details: Partial<WindowInfo> = {};

        // Extrair WM_CLASS (contém o nome da aplicação)
        const wmClassMatch = xpropOutput.match(/WM_CLASS\(STRING\) = "([^"]*)", "([^"]*)"/);
        if (wmClassMatch) {
            details.className = wmClassMatch[2]; // Segunda parte é geralmente o nome da aplicação
        }

        // Extrair PID
        const pidMatch = xpropOutput.match(/_NET_WM_PID\(CARDINAL\) = (\d+)/);
        if (pidMatch) {
            details.pid = pidMatch[1];

            // Tentar obter o nome do processo usando o PID
            try {
                const { stdout: psOutput } = await execAsync(`ps -p ${details.pid} -o comm=`);
                details.appName = psOutput.trim();
            } catch (e) {
                // Falha silenciosa se não conseguir obter o nome do processo
            }
        }

        return details;
    } catch (error) {
        // Se xprop falhar, tentar uma abordagem alternativa
        return getWindowDetailsAlternative(windowId);
    }
}

async function getWindowDetailsAlternative(windowId: string): Promise<Partial<WindowInfo>> {
    try {
        // Usar xdotool como alternativa
        const { stdout: xdotoolOutput } = await execAsync(`xdotool getwindowpid ${windowId}`);
        const pid = xdotoolOutput.trim();

        if (pid) {
            const { stdout: psOutput } = await execAsync(`ps -p ${pid} -o comm=`);
            return {
                pid,
                appName: psOutput.trim(),
            };
        }
    } catch (error) {
        console.log("Não foi possível obter detalhes alternativos para janela:", windowId);
    }

    return {};
}

function formatWindowTitle(window: WindowInfo): string {
    let appName = getAppDisplayName(window);
    let title = window.title;

    // Remover o nome do app do título se já estiver incluído
    if (appName && title.toLowerCase().includes(appName.toLowerCase())) {
        const regex = new RegExp(`^${appName}\\s*[-–—]?\\s*`, "i");
        title = title.replace(regex, "").trim();
    }

    // Se não temos um título limpo, usar apenas o nome do app
    if (!title || title === appName) {
        return capitalizeTitle(appName || window.title);
    }

    // Formato padrão: AppName - Título
    const formattedAppName = capitalizeTitle(appName || "Aplicativo");
    const formattedTitle = capitalizeTitle(title);

    return `${formattedAppName} - ${formattedTitle}`;
}

function getAppDisplayName(window: WindowInfo): string {
    // Prioridade: className > appName > extrair do título
    if (window.className) {
        return mapAppName(window.className);
    }

    if (window.appName) {
        return mapAppName(window.appName);
    }

    // Tentar extrair nome do app do título
    const titleParts = window.title.split(/[-–—]/);
    if (titleParts.length > 1) {
        return titleParts[0].trim();
    }

    return "";
}

function mapAppName(rawName: string): string {
    if (!rawName) return "";

    // Mapeamento de nomes de aplicativos para nomes mais amigáveis
    const appNameMap: { [key: string]: string } = {
        // Browsers
        "google-chrome": "Google Chrome",
        chrome: "Google Chrome",
        firefox: "Firefox",
        chromium: "Chromium",
        "microsoft-edge": "Microsoft Edge",
        brave: "Brave",

        // Editores de código
        code: "Visual Studio Code",
        "code-oss": "Visual Studio Code",
        atom: "Atom",
        sublime_text: "Sublime Text",
        vim: "Vim",
        emacs: "Emacs",

        // Gerenciadores de arquivo
        nautilus: "Arquivos",
        "org.gnome.nautilus": "Arquivos",
        thunar: "Thunar",
        dolphin: "Dolphin",
        nemo: "Nemo",
        pcmanfm: "PCManFM",

        // Terminais
        terminal: "Terminal",
        "gnome-terminal": "Terminal",
        konsole: "Konsole",
        xterm: "XTerm",
        alacritty: "Alacritty",
        warp: "Warp",
        "dev.warp.warp": "Warp",
        kitty: "Kitty",
        tilix: "Tilix",

        // Office
        "libreoffice-writer": "LibreOffice Writer",
        "libreoffice-calc": "LibreOffice Calc",
        "libreoffice-impress": "LibreOffice Impress",
        "onlyoffice-desktopeditors": "OnlyOffice",

        // Email
        thunderbird: "Thunderbird",
        evolution: "Evolution",

        // Comunicação
        slack: "Slack",
        discord: "Discord",
        teams: "Microsoft Teams",
        telegram: "Telegram",
        whatsapp: "WhatsApp",
        skype: "Skype",

        // Mídia
        spotify: "Spotify",
        vlc: "VLC Media Player",
        rhythmbox: "Rhythmbox",
        audacity: "Audacity",
        mpv: "MPV",

        // Design/Gráficos
        gimp: "GIMP",
        inkscape: "Inkscape",
        blender: "Blender",
        krita: "Krita",
        figma: "Figma",

        // Desenvolvimento
        postman: "Postman",
        insomnia: "Insomnia",
        dbeaver: "DBeaver",
        docker: "Docker Desktop",

        // Sistema
        "gnome-system-monitor": "Monitor do Sistema",
        "gnome-calculator": "Calculadora",
        gedit: "Editor de Texto",
        "org.gnome.gedit": "Editor de Texto",
        "org.gnome.calculator": "Calculadora",
        "org.gnome.texteditor": "Editor de Texto",
    };

    // Primeiro tenta mapear o nome completo
    const lowerName = rawName.toLowerCase();
    if (appNameMap[lowerName]) {
        return appNameMap[lowerName];
    }

    // Se é um nome com formato de domínio reverso (org.gnome.app, dev.app.name)
    if (rawName.includes(".")) {
        const parts = rawName.split(".");
        const appPart = parts[parts.length - 1]; // Última parte geralmente é o nome do app

        // Tenta mapear a última parte
        if (appNameMap[appPart.toLowerCase()]) {
            return appNameMap[appPart.toLowerCase()];
        }

        // Remove prefixos comuns e capitaliza
        const cleanName = cleanAppName(appPart);
        return capitalizeTitle(cleanName);
    }

    // Remove caracteres especiais e capitaliza
    const cleanName = cleanAppName(rawName);
    return capitalizeTitle(cleanName);
}

function cleanAppName(name: string): string {
    return name
        .replace(/[-_]/g, " ") // Substitui hífens e underscores por espaços
        .replace(/\b(app|desktop)\b/gi, "") // Remove palavras comuns
        .trim();
}

function capitalizeTitle(text: string): string {
    if (!text) return "";

    return text
        .trim()
        .split(" ")
        .map((word) => {
            if (word.length === 0) return word;
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(" ");
}

export default new WindowListPlugin();