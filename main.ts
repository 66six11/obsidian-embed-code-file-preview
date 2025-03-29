import {Plugin, TFile, MarkdownPostProcessorContext, MarkdownView, Workspace} from 'obsidian';

import {PluginConfig, validateConfig} from "./config";
import {ConfigSettingsTab} from "./setting";
import Prism from './prism';


export default class CodeFileEmbedPlugin extends Plugin {
	config: PluginConfig;


	async onload() {

		await this.loadConfig();
		// if (!Prism.languages.glsl) {
		// 	throw new Error('GLSL 语法未正确加载');
		// }
		//获取配置中设置的所有语言
		// const commonLanguages = this.config.mappings.map(mapping => mapping.prismLanguage);
		//
		// await Promise.all(
		// 	commonLanguages.map(lang =>
		// 		require(`prismjs/components/prism-${lang}`)
		// 			.catch(() => console.warn(`跳过 ${lang} 预加载`))
		// 	)
		// );
		// 注册事件监听器

		// 注册事件监听器
		this.addSettingTab(new ConfigSettingsTab(this.app, this));

		// 注册Markdown后处理器
		this.registerMarkdownPostProcessor((element: HTMLElement, context: MarkdownPostProcessorContext) => {


			const extensions = this.config.mappings.map(mapping => mapping.extension);
			//动态选择器
			const selector = this.buildQuerySelectors(extensions);
			if (!selector) return;
			const imageLinks = element.querySelectorAll(selector);


			if (!imageLinks.length) return;
			imageLinks.forEach(async (img: HTMLElement) => {
				const filePath = img.getAttribute('src');
				if (!filePath) return;

				// 创建加载状态
				const loading = this.createLoadingBadge(img);

				// 克隆元素（会移除所有事件监听）
				// const clonedElement = img.cloneNode(true) as HTMLElement;
				// clonedElement.addEventListener('click',  (e) => {
				//
				// 	e.preventDefault();
				// 	e.stopPropagation();
				// 	e.stopImmediatePropagation();
				//
				// })
				//
				// const test = img.outerHTML;
				// console.log(test);
				//
				//
				// if (!img.parentNode) return;



				const activeFile = this.app.workspace.getActiveFile();
				if (!activeFile) return null;


				try {
					// 获取目标文件
					const targetFile = this.resolveFilePath(filePath, context);
					if (!targetFile) throw `文件未找到: ${filePath}`;


					// 读取文件内容
					const content = await this.app.vault.read(targetFile);
					const ext = this.config.mappings.find(mapping => mapping.extension === targetFile.extension)?.prismLanguage || 'none';
					// 替换为代码块
					const codeBlock = await this.replaceWithCodeBlock(content, ext);

					const toggleButton = this.createToggleButton(codeBlock);

					toggleButton.addEventListener('click', e => e.stopPropagation());
					const clonedElement = img.cloneNode(true) as HTMLElement;
					clonedElement.appendChild(toggleButton);

					clonedElement.appendChild(codeBlock);
					clonedElement.addEventListener('click',  (e) => {
						if (e.ctrlKey) {
							console.log('Ctrl+Click 触发');
							this.app.workspace.getLeaf().openFile(targetFile);
						} else {
							toggleButton.click();

						}
						e.preventDefault();
						e.stopPropagation();
						e.stopImmediatePropagation();

					})
					const test = img.outerHTML;
					console.log(test);


					if (!img.parentNode) return;
					img.parentNode.replaceChild(clonedElement,img);
					// 检测组合键

					Prism.highlightAll();

				} catch (err) {
					this.showError(img, err.toString());
				} finally {
					loading.remove();
				}

			});
		});

	}

	async loadConfig() {
		const saved = await this.loadData();
		this.config = validateConfig(saved || {});
	}

	async saveConfig() {
		await this.saveData(this.config);
		this.refresh(); // 新增：保存配置后刷新视图
	}

	refresh() {
		this.app.workspace.updateOptions();
		this.app.workspace.trigger('css-classes-change');
		this.app.workspace.getLeavesOfType('markdown').forEach(leaf => {
			const view = leaf.view as MarkdownView;
			if (view) {
				view.previewMode.rerender(true);
			}
		});
	}

	// 创建加载提示
	private createLoadingBadge(img: HTMLElement): HTMLElement {
		const badge = document.createElement('div');
		badge.textContent = '加载代码中...';
		badge.style.cssText = `
            position: absolute;
            background: rgba(0,0,0,0.7);
            color: white;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 0.8em;
        `;
		img.parentElement?.insertBefore(badge, img);
		return badge;
	}

	// 新增方法：构建动态选择器
	private buildQuerySelectors(extensions: string[]): string {
		return extensions
			.map(ext => {
				const escapedExt = CSS.escape(ext); // 转义特殊字符
				return `span[src$=".${escapedExt}"]`;
			})
			.join(', ');
	}

	// 解析文件路径（支持相对路径）
	private resolveFilePath(src: string, context: MarkdownPostProcessorContext): TFile | null {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) return null;

		const basePath = activeFile.parent?.path || '';
		const fullPath = `${basePath}/${src}`.replace(/\/+/g, '/');

		return this.app.vault.getFiles().find(f =>
			f.path === fullPath ||
			f.path.endsWith(`/${src}`)
		) || null;
	}

	// 生成代码块
	private async replaceWithCodeBlock(content: string, ext: string) {
		// 创建官方结构容器
		const container = document.createElement('div');
		container.className = 'el-pre'; // 外层容器类名

		// 创建pre元素（核心容器）
		const pre = document.createElement('pre');
		pre.className = `language-${ext}`;
		pre.tabIndex = 0; // 官方交互属性

		// 创建code元素（内容主体）
		const code = document.createElement('code');
		code.dataset.line = "0"; // 行号标记
		code.className = `language-${ext} is-loaded`; // 加载完成状态

		// 添加代码内容（需通过Prism处理）
		code.innerHTML = this.applyPrismHighlight(content, ext);

		// 创建复制按钮
		const copyButton = this.createCopyButton(content);


		// 组装结构
		pre.appendChild(code);
		pre.appendChild(copyButton);
		container.appendChild(pre);

		//禁止点击冒泡
		container.addEventListener('click', e => e.stopPropagation());
		//鼠标移入显示默认mouse样式
		container.style.cursor = 'default';

		// 触发Obsidian的渲染管线
		this.app.workspace.trigger('parse-style', container);
		return container;
	}

	//下拉按钮组件
	private createToggleButton(container: HTMLElement): HTMLElement {
		const button = document.createElement('div');
		const expand = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down-icon lucide-chevron-down"><path d="m6 9 6 6 6-6"/></svg>`;
		const collapse = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-up-icon lucide-chevron-up"><path d="m18 15-6-6-6 6"/></svg>`;
		button.className = 'code-toggle';

		button.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            cursor: pointer;
            color: var(--text-color);
            
           
		`;

		button.onclick = () => {
			if (container.style.display === 'none') {
				container.style.display = `block`;
				button.innerHTML = collapse;
			} else {
				container.style.display = `none`;
				button.innerHTML = expand;
			}
		}
		//默认不展开
		container.style.display = `none`;
		button.innerHTML = expand;
		return button;
	}

// 创建复制按钮组件
	private createCopyButton(content: string): HTMLElement {
		const copy = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-copy">
    <rect x="8" y="8" width="14" height="14" rx="2" ry="2"></rect>
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
  </svg>`
		const success = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon lucide-check"><path d="M20 6 9 17l-5-5"></path></svg>`
		const button = document.createElement('button');
		button.className = 'copy-code-button';
		button.innerHTML = copy;

		// 添加点击事件
		button.onclick = () => {
			navigator.clipboard.writeText(content).then(r => {
				console.log('复制成功', r);
			});
			button.innerHTML = success;
			button.style.display = 'inline-flex';
			button.style.color = 'var(--text-success)';
			// 2秒后恢复初始状态
			setTimeout(() => {
				button.innerHTML = copy;
				//保持显示状态，避免闪烁
				button.style.removeProperty('display');
				button.style.removeProperty('color');
			}, 2000);
		};

		return button;
	}

// 应用Prism语法高亮
	private applyPrismHighlight(content: string, lang: string): string {
		const grammar = Prism.languages[lang as keyof typeof Prism.languages];

		if (!grammar) console.warn(`Prism: 未找到 ${lang} 语言定义`);
		return grammar ?
			Prism.highlight(content, grammar, lang) :
			content; // 无对应语言时原样输出
	}

	// 错误提示
	private showError(img: HTMLElement, message: string) {
		const error = document.createElement('div');
		error.textContent = `⚠️ ${message}`;
		error.style.color = '#ff4444';
		img.replaceWith(error);
	}
}
