import { Notice } from "obsidian";

// 配置类型定义
export interface LanguageMapping {
	extension: string;
	prismLanguage: string;
	displayName: string;
}

export interface PluginConfig {
	mappings: LanguageMapping[];
	configVersion: number;
}

// 默认配置
export const DEFAULT_CONFIG: PluginConfig = {
	mappings: [
		{
			extension: 'py',
			prismLanguage: 'python',
			displayName: 'Python'
		},
		{
			extension: 'shader',
			prismLanguage: 'glsl',
			displayName: 'GLSL'
		}
	],
	configVersion: 1
};

// 配置验证器
export function validateConfig(config: Partial<PluginConfig>): PluginConfig {
	const validated = {
		...DEFAULT_CONFIG,
		...config,
		mappings: (config.mappings || []).filter(m =>
			m.extension && m.prismLanguage && m.displayName
		)
	};

	// 版本迁移逻辑（示例）
	if (config.configVersion === 1) {
		// 未来升级时可在此添加迁移代码
	}

	return validated;
}

// 语言选项类型
export type LanguageOption = [value: string, name: string];
