// services/IconManager.ts
import * as fs from "fs";
import * as path from "path";

export interface IconSearchOptions {
    preferredSizes?: string[];
    preferredThemes?: string[];
    fallbackEmoji?: string;
    fallbackColor?: string;
    appType?: AppType;
}

export type AppType =
    | "browser"
    | "terminal"
    | "editor"
    | "file-manager"
    | "media"
    | "office"
    | "chat"
    | "development"
    | "system"
    | "application";

class IconManager {
    private static instance: IconManager;
    private iconCache = new Map<string, string>();

    // Configurações padrão
    private readonly DEFAULT_ICON_DIRS = [
        "/usr/share/icons",
        "/usr/share/pixmaps",
        `${process.env.HOME}/.local/share/icons`,
        `${process.env.HOME}/.icons`,
    ];

    private readonly DEFAULT_SIZES = ["48", "32", "24", "16"];
    private readonly DEFAULT_EXTENSIONS = [".png", ".svg", ".xpm", ".jpg", ".jpeg"];
    private readonly DEFAULT_THEMES = ["hicolor", "Adwaita", "ubuntu-mono-light", "Humanity", "breeze", "Papirus"];

    private constructor() {}

    public static getInstance(): IconManager {
        if (!IconManager.instance) {
            IconManager.instance = new IconManager();
        }
        return IconManager.instance;
    }

    /**
     * Busca ícone por nome ou identificador da aplicação
     */
    public getIcon(iconIdentifier: string, options: IconSearchOptions = {}): string {
        if (!iconIdentifier) {
            return this.getDefaultIcon(options.appType, options.fallbackEmoji, options.fallbackColor);
        }

        const cacheKey = this.generateCacheKey(iconIdentifier, options);

        // Verifica cache
        if (this.iconCache.has(cacheKey)) {
            return this.iconCache.get(cacheKey)!;
        }

        let iconBase64 = "";

        // Tenta encontrar ícone real
        const iconPath = this.findIconPath(iconIdentifier, options);
        if (iconPath && fs.existsSync(iconPath)) {
            try {
                iconBase64 = this.convertToBase64(iconPath);
            } catch (error) {
                console.error(`Error converting icon ${iconPath}:`, error);
            }
        }

        // Se não encontrou, usa ícone padrão
        if (!iconBase64) {
            iconBase64 = this.getDefaultIcon(options.appType, options.fallbackEmoji, options.fallbackColor);
        }

        // Salva no cache
        this.iconCache.set(cacheKey, iconBase64);
        return iconBase64;
    }

    /**
     * Busca ícone especificamente para aplicações (com mapeamentos predefinidos)
     */
    public getAppIcon(appIdentifier: string, appType?: AppType, fallbackEmoji?: string): string {
        const mappedIconName = this.mapAppIdentifierToIcon(appIdentifier);
        const detectedAppType = appType || this.detectAppType(appIdentifier);

        return this.getIcon(mappedIconName, {
            appType: detectedAppType,
            fallbackEmoji,
            fallbackColor: this.getColorForAppType(detectedAppType),
        });
    }

    /**
     * Busca ícone por className (para janelas)
     */
    public getWindowIcon(className: string, appName?: string): string {
        const identifier = className || appName || "";
        const appType = this.detectAppType(identifier);

        return this.getAppIcon(identifier, appType);
    }

    /**
     * Limpa o cache de ícones
     */
    public clearCache(): void {
        this.iconCache.clear();
    }

    /**
     * Pré-carrega ícones mais comuns
     */
    public async preloadCommonIcons(): Promise<void> {
        const commonApps = [
            "firefox",
            "google-chrome",
            "chromium",
            "code",
            "nautilus",
            "gnome-terminal",
            "spotify",
            "discord",
            "slack",
            "vlc",
        ];

        for (const app of commonApps) {
            this.getAppIcon(app);
        }
    }

    // ===== MÉTODOS PRIVADOS =====

    private generateCacheKey(identifier: string, options: IconSearchOptions): string {
        return `${identifier}:${JSON.stringify(options)}`;
    }

    private findIconPath(iconName: string, options: IconSearchOptions = {}): string {
        // Se é um caminho absoluto e existe
        if (path.isAbsolute(iconName) && fs.existsSync(iconName)) {
            return iconName;
        }

        const sizes = options.preferredSizes || this.DEFAULT_SIZES;
        const themes = options.preferredThemes || this.DEFAULT_THEMES;

        for (const baseDir of this.DEFAULT_ICON_DIRS) {
            if (!fs.existsSync(baseDir)) continue;

            // Busca em temas específicos
            for (const theme of themes) {
                const themeDir = path.join(baseDir, theme);
                if (!fs.existsSync(themeDir)) continue;

                // Busca por tamanhos específicos
                for (const size of sizes) {
                    const sizeDir = path.join(themeDir, `${size}x${size}`, "apps");
                    const iconPath = this.searchInDirectory(sizeDir, iconName);
                    if (iconPath) return iconPath;
                }

                // Busca em scalable
                const scalableDir = path.join(themeDir, "scalable", "apps");
                const scalableIcon = this.searchInDirectory(scalableDir, iconName);
                if (scalableIcon) return scalableIcon;

                // Busca em outros diretórios comuns
                const otherDirs = ["actions", "devices", "mimetypes", "places", "status"];
                for (const subDir of otherDirs) {
                    for (const size of sizes) {
                        const dir = path.join(themeDir, `${size}x${size}`, subDir);
                        const iconPath = this.searchInDirectory(dir, iconName);
                        if (iconPath) return iconPath;
                    }
                }
            }

            // Busca direta no diretório base
            const directIcon = this.searchInDirectory(baseDir, iconName);
            if (directIcon) return directIcon;
        }

        return "";
    }

    private searchInDirectory(directory: string, iconName: string): string {
        if (!fs.existsSync(directory)) return "";

        for (const ext of this.DEFAULT_EXTENSIONS) {
            const iconPath = path.join(directory, iconName + ext);
            if (fs.existsSync(iconPath)) {
                return iconPath;
            }
        }

        return "";
    }

    private convertToBase64(filePath: string): string {
        const fileBuffer = fs.readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase();

        const mimeTypes: { [key: string]: string } = {
            ".svg": "image/svg+xml",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".xpm": "image/x-xpixmap",
            ".gif": "image/gif",
        };

        const mimeType = mimeTypes[ext] || "image/png";
        return `data:${mimeType};base64,${fileBuffer.toString("base64")}`;
    }

    private mapAppIdentifierToIcon(identifier: string): string {
        const mappings: { [key: string]: string } = {
            // Navegadores
            "Google-chrome": "google-chrome",
            "google-chrome": "google-chrome",
            Chrome: "google-chrome",
            Firefox: "firefox",
            firefox: "firefox",
            Chromium: "chromium",
            chromium: "chromium",
            "Microsoft-edge": "microsoft-edge",
            "Brave-browser": "brave-browser",
            brave: "brave-browser",

            // Editores
            Code: "visual-studio-code",
            code: "visual-studio-code",
            "code-oss": "visual-studio-code",
            Atom: "atom",
            atom: "atom",
            Sublime_text: "sublime-text",
            sublime_text: "sublime-text",
            Vim: "vim",
            vim: "vim",
            Emacs: "emacs",
            emacs: "emacs",
            Gedit: "org.gnome.gedit",
            gedit: "org.gnome.gedit",

            // Gerenciadores de arquivo
            Nautilus: "org.gnome.Nautilus",
            nautilus: "org.gnome.Nautilus",
            "org.gnome.Nautilus": "org.gnome.Nautilus",
            Thunar: "thunar",
            thunar: "thunar",
            Dolphin: "system-file-manager",
            dolphin: "system-file-manager",
            Nemo: "nemo",
            nemo: "nemo",

            // Terminais
            "Gnome-terminal": "org.gnome.Terminal",
            "gnome-terminal": "org.gnome.Terminal",
            "org.gnome.Terminal": "org.gnome.Terminal",
            terminal: "org.gnome.Terminal",
            Konsole: "konsole",
            konsole: "konsole",
            Xterm: "xterm",
            xterm: "xterm",
            Alacritty: "Alacritty",
            alacritty: "Alacritty",
            Kitty: "kitty",
            kitty: "kitty",

            // Comunicação
            Slack: "slack",
            slack: "slack",
            Discord: "discord",
            discord: "discord",
            TelegramDesktop: "telegram",
            Telegram: "telegram",
            telegram: "telegram",
            Teams: "teams",
            teams: "teams",
            WhatsApp: "whatsapp",
            whatsapp: "whatsapp",
            Skype: "skype",
            skype: "skype",

            // Mídia
            Spotify: "spotify",
            spotify: "spotify",
            Vlc: "vlc",
            vlc: "vlc",
            Rhythmbox: "rhythmbox",
            rhythmbox: "rhythmbox",
            Audacity: "audacity",
            audacity: "audacity",
            Mpv: "mpv",
            mpv: "mpv",

            // Design
            Gimp: "gimp",
            gimp: "gimp",
            Inkscape: "inkscape",
            inkscape: "inkscape",
            Blender: "blender",
            blender: "blender",
            Krita: "krita",
            krita: "krita",
            "Figma-linux": "figma-linux",

            // Desenvolvimento
            Postman: "postman",
            postman: "postman",
            Insomnia: "insomnia",
            insomnia: "insomnia",
            DBeaver: "dbeaver",
            dbeaver: "dbeaver",
            Docker: "docker",
            docker: "docker",

            // Sistema
            "Gnome-system-monitor": "org.gnome.SystemMonitor",
            "gnome-system-monitor": "org.gnome.SystemMonitor",
            "Gnome-calculator": "org.gnome.Calculator",
            "gnome-calculator": "org.gnome.Calculator",

            // Office
            "libreoffice-writer": "libreoffice-writer",
            "libreoffice-calc": "libreoffice-calc",
            "libreoffice-impress": "libreoffice-impress",
            Thunderbird: "thunderbird",
            thunderbird: "thunderbird",
        };

        const mapped = mappings[identifier];
        if (mapped) return mapped;

        // Se não encontrou mapeamento direto, tenta limpar o nome
        const cleaned = identifier
            .toLowerCase()
            .replace(/^org\.gnome\./, "")
            .replace(/^com\./, "")
            .replace(/^io\./, "")
            .replace(/-desktop$/, "")
            .replace(/-browser$/, "");

        return cleaned || identifier.toLowerCase();
    }

    private detectAppType(identifier: string): AppType {
        const name = identifier.toLowerCase();

        const typePatterns: { [key in AppType]: string[] } = {
            browser: ["chrome", "firefox", "browser", "chromium", "edge", "brave", "safari"],
            terminal: ["terminal", "konsole", "xterm", "alacritty", "kitty", "gnome-terminal"],
            editor: ["code", "vim", "emacs", "atom", "sublime", "gedit", "nano"],
            "file-manager": ["nautilus", "thunar", "dolphin", "nemo", "files", "pcmanfm"],
            media: ["spotify", "vlc", "rhythmbox", "audacity", "mpv", "totem", "banshee"],
            office: ["libreoffice", "writer", "calc", "impress", "office", "onlyoffice"],
            chat: ["slack", "discord", "telegram", "whatsapp", "teams", "skype", "zoom"],
            development: ["postman", "insomnia", "dbeaver", "docker", "git", "github"],
            system: ["monitor", "calculator", "settings", "control", "system"],
            application: [],
        };

        for (const [type, patterns] of Object.entries(typePatterns)) {
            if (patterns.some((pattern) => name.includes(pattern))) {
                return type as AppType;
            }
        }

        return "application";
    }

    private getColorForAppType(appType: AppType): string {
        const colors: { [key in AppType]: string } = {
            browser: "#4285F4",
            terminal: "#2D3748",
            editor: "#3182CE",
            "file-manager": "#38A169",
            media: "#E53E3E",
            office: "#D69E2E",
            chat: "#805AD5",
            development: "#718096",
            system: "#4A5568",
            application: "#4A5568",
        };

        return colors[appType];
    }

    private getDefaultIcon(appType: AppType = "application", customEmoji?: string, customColor?: string): string {
        const emojis: { [key in AppType]: string } = {
            browser: "🌐",
            terminal: "⌨️",
            editor: "📝",
            "file-manager": "📁",
            media: "🎵",
            office: "📄",
            chat: "💬",
            development: "⚙️",
            system: "🖥️",
            application: "📱",
        };

        const emoji = customEmoji || emojis[appType];
        const color = customColor || this.getColorForAppType(appType);

        return this.createSvgIcon(emoji, color);
    }

    private createSvgIcon(emoji: string, color: string): string {
        const svg = `
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="48" height="48" rx="8" fill="${color}"/>
                <text x="24" y="32" font-family="system-ui, -apple-system" font-size="20" fill="white" text-anchor="middle">${emoji}</text>
            </svg>
        `.trim();

        return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
    }
}

export default IconManager.getInstance();