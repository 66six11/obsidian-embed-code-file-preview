import {App, Notice, PluginSettingTab, Setting} from "obsidian";
import { PluginConfig, DEFAULT_CONFIG, LanguageOption, validateConfig } from "./config";
import CodeFileEmbedPlugin from "./main";

export class ConfigSettingsTab extends PluginSettingTab {
	private tempConfig: PluginConfig;
	private plugin: CodeFileEmbedPlugin;
	private languageOptions: LanguageOption[];

	constructor(app: App, plugin: CodeFileEmbedPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.tempConfig = structuredClone(plugin.config);
		this.languageOptions = this.getLanguageOptions();
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('h2', { text: '代码嵌入配置' });

		this.renderGlobalSettings();
		this.renderMappings();
		this.renderControlButtons();
	}

	private renderGlobalSettings() {

	}

	private renderMappings() {
		this.containerEl.createEl('h3', { text: '文件类型映射' });

		this.tempConfig.mappings.forEach((mapping, index) => {
			const setting = new Setting(this.containerEl)
				.addText(text => text
					.setPlaceholder('文件扩展名')
					.setValue(mapping.extension)
					.onChange(value => {
						if (value) {
							this.tempConfig.mappings[index].extension = value.replace(/^\./, '').trim();
							this.updateDisplayName(index);
						}
					}))
				// 修改为文本输入框 + 数据列表
				.addText(text => {
					const input = text.inputEl;
					// 创建数据列表提供建议
					const datalistId = `prism-lang-list-${index}`;
					input.setAttribute('list', datalistId);

					// 添加预设语言选项
					const datalist = document.createElement('datalist');
					datalist.id = datalistId;
					this.languageOptions.forEach(([value, name]) => {
						const option = document.createElement('option');
						option.value = value;
						option.textContent = name;
						datalist.appendChild(option);
					});
					input.insertAdjacentElement('afterend', datalist);

					text
						.setPlaceholder('输入 Prism 语言（如 javascript）')
						.setValue(mapping.prismLanguage)
						.onChange(value => {
							this.tempConfig.mappings[index].prismLanguage = value.trim();
							this.updateDisplayName(index);
						});
				})
				.addExtraButton(btn => {
					btn.setIcon('trash')
						.setTooltip('删除')
						.onClick(() => {
							this.tempConfig.mappings.splice(index, 1);
							this.rerender();
						});
				});

			setting.controlEl.prepend(
				createSpan({
					text: '文件扩展名：',
					cls: 'mapping-arrow',
					attr: { 'aria-hidden': 'true' }
				})
			);
		});
	}

	// 更新显示名称逻辑
	private updateDisplayName(index: number) {
		const mapping = this.tempConfig.mappings[index];
		// 优先匹配预设语言名称
		const matched = this.languageOptions.find(
			([value]) => value === mapping.prismLanguage
		);
		mapping.displayName = matched?.[1] || mapping.prismLanguage; // 未匹配时直接使用输入值
	}

	// 移除语言有效性校验
	private validate(): boolean {
		// 仅保留扩展名重复校验
		const extensions = this.tempConfig.mappings.map(m => m.extension);
		return new Set(extensions).size === extensions.length;
	}
	private renderControlButtons() {
		new Setting(this.containerEl)
			.addButton(btn => btn
				.setButtonText('添加映射')
				.setCta()
				.onClick(() => {
					this.tempConfig.mappings.push({
						extension: 'new',
						prismLanguage: 'text',
						displayName: 'Text'
					});
					this.rerender();
				}))
			.addButton(btn => btn
				.setButtonText('保存')
				.setCta()
				.onClick(async () => {
					if (this.validate()) {
						this.plugin.config = structuredClone(this.tempConfig);
						await this.plugin.saveConfig();
						this.plugin.refresh();
						new Notice('配置已保存');
					}
				}))
			.addButton(btn => btn
				.setButtonText('重置')
				.onClick(() => {
					this.tempConfig = structuredClone(this.plugin.config);
					this.rerender();
				}));
	}

	// private updateDisplayName(index: number) {
	// 	const mapping = this.tempConfig.mappings[index];
	// 	const [, displayName] = this.languageOptions.find(
	// 		([value]) => value === mapping.prismLanguage
	// 	) || ['text', 'Text'];
	//
	// 	mapping.displayName = displayName;
	// }
	//
	// private validate(): boolean {
	// 	// 扩展名校验
	// 	const extensions = this.tempConfig.mappings.map(m => m.extension);
	// 	if (new Set(extensions).size !== extensions.length) {
	// 		new Notice('错误：存在重复的扩展名');
	// 		return false;
	// 	}
	//
	// 	// 语言有效性校验
	// 	const invalid = this.tempConfig.mappings.some(m =>
	// 		!this.languageOptions.some(([value]) => value === m.prismLanguage)
	// 	);
	//
	// 	if (invalid) {
	// 		new Notice('错误：存在无效的语法类型');
	// 		return false;
	// 	}
	//
	// 	return true;
	// }

	private getLanguageOptions(): LanguageOption[] {
		return [
			['', '不显示'],
			['text', '纯文本'],
			['python', 'Python'],
			['glsl', 'GLSL'],
			['javascript', 'JavaScript'],
			['typescript', 'TypeScript'],
			['css', 'CSS'],
			['html', 'HTML']
		];
	}

	private rerender() {
		this.display();
	}
}
