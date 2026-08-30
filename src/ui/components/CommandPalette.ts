import { BaseComponent, defineComponent } from './BaseComponent.ts';

export interface CommandPaletteCommand {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  category?: string;
  action: () => void | Promise<void>;
  disabled?: boolean;
}

export interface CommandPaletteProperties extends Record<string, unknown> {
  open?: boolean;
  placeholder?: string;
  onClose?: () => void;
}

export class CommandPalette extends BaseComponent {
  static observedAttributes = ['open', 'placeholder'];

  private _open = false;
  private _placeholder = 'Type a command or search...';
  private _onClose: (() => void) | null = null;
  private _commands: CommandPaletteCommand[] = [];
  private _filteredCommands: CommandPaletteCommand[] = [];
  private _selectedIndex = 0;
  private _previousFocus: HTMLElement | null = null;
  private _input: HTMLInputElement | null = null;
  private _listContainer: HTMLElement | null = null;

  attributeChangedCallback(name: string, _old: string, value: string): void {
    switch (name) {
      case 'open':
        this._open = value !== 'false';
        break;
      case 'placeholder':
        this._placeholder = value;
        break;
    }
    this.render();
  }

  connectedCallback(): void {
    this._open = this.hasAttribute('open');
    this._placeholder = this.getAttribute('placeholder') || 'Type a command or search...';
    super.connectedCallback();

    document.addEventListener('keydown', this.handleGlobalKeyDown);
  }

  disconnectedCallback(): void {
    document.removeEventListener('keydown', this.handleGlobalKeyDown);
  }

  set onClose(value: (() => void) | null) {
    this._onClose = value;
  }

  set commands(value: CommandPaletteCommand[]) {
    this._commands = value;
    this._filteredCommands = [...value];
    if (this._open) this.render();
  }

  get commands(): CommandPaletteCommand[] {
    return this._commands;
  }

  addCommand(command: CommandPaletteCommand): void {
    this._commands.push(command);
    this._filteredCommands = [...this._commands];
    if (this._open) this.render();
  }

  removeCommand(id: string): void {
    this._commands = this._commands.filter(c => c.id !== id);
    this._filteredCommands = [...this._commands];
    if (this._open) this.render();
  }

  show(): void {
    this._open = true;
    this.setAttribute('open', '');
    this._previousFocus = document.activeElement as HTMLElement;
    this.render();
    // Focus input after render
    setTimeout(() => this._input?.focus(), 0);
  }

  hide(): void {
    this._open = false;
    this.removeAttribute('open');
    this.render();
    if (this._previousFocus) {
      this._previousFocus.focus();
    }
    this._onClose?.();
  }

  toggle(): void {
    if (this._open) this.hide(); else this.show();
  }

  private handleGlobalKeyDown = (e: KeyboardEvent): void => {
    // Open with ⌘K / Ctrl+K
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && !this._open) {
      // Don't open if typing in an input
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || (active as HTMLElement).contentEditable === 'true')) {
        return;
      }
      e.preventDefault();
      this.show();
      return;
    }

    if (!this._open) return;

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        this.hide();
        break;
      case 'ArrowDown':
        e.preventDefault();
        this._selectedIndex = Math.min(this._selectedIndex + 1, this._filteredCommands.length - 1);
        this.updateSelection();
        break;
      case 'ArrowUp':
        e.preventDefault();
        this._selectedIndex = Math.max(this._selectedIndex - 1, 0);
        this.updateSelection();
        break;
      case 'Enter':
        e.preventDefault();
        this.executeSelected();
        break;
    }
  };

  private handleInput = (e: Event): void => {
    const input = e.target as HTMLInputElement;
    const query = input.value.toLowerCase().trim();

    if (!query) {
      this._filteredCommands = [...this._commands];
    } else {
      this._filteredCommands = this._commands.filter(cmd =>
        cmd.label.toLowerCase().includes(query) ||
        cmd.description?.toLowerCase().includes(query) ||
        cmd.id.toLowerCase().includes(query)
      );
    }
    this._selectedIndex = 0;
    this.renderList();
  };

  private updateSelection(): void {
    const items = this._listContainer?.querySelectorAll('.command-item');
    items?.forEach((item, index) => {
      item.classList.toggle('selected', index === this._selectedIndex);
      if (index === this._selectedIndex) {
        item.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  private executeSelected(): void {
    const cmd = this._filteredCommands[this._selectedIndex];
    if (cmd && !cmd.disabled) {
      cmd.action();
      this.hide();
    }
  }

  private renderList(): void {
    if (!this._listContainer) return;

    this._listContainer.innerHTML = '';

    if (this._filteredCommands.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'command-empty';
      empty.style.cssText = `
        padding: var(--nms-spacing-x24);
        text-align: center;
        color: var(--nms-color-text-muted);
        font-size: var(--nms-font-size-label);
      `;
      empty.textContent = 'No commands found';
      this._listContainer.appendChild(empty);
      return;
    }

    const categories = new Map<string, CommandPaletteCommand[]>();
    for (const cmd of this._filteredCommands) {
      const cat = cmd.category || 'Commands';
      if (!categories.has(cat)) categories.set(cat, []);
      categories.get(cat)!.push(cmd);
    }

    let globalIndex = 0;
    for (const [category, commands] of categories) {
      const catHeader = document.createElement('div');
      catHeader.className = 'command-category';
      catHeader.style.cssText = `
        padding: var(--nms-spacing-x8) var(--nms-spacing-x12);
        font-size: var(--nms-font-size-meta);
        font-weight: 600;
        color: var(--nms-color-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        border-bottom: 1px solid var(--nms-color-surface-border);
      `;
      catHeader.textContent = category;
      this._listContainer.appendChild(catHeader);

      for (const cmd of commands) {
        const item = document.createElement('div');
        item.className = 'command-item';
        item.dataset.commandId = cmd.id;
        const isSelected = globalIndex === this._selectedIndex;
        item.style.cssText = `
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--nms-spacing-x8) var(--nms-spacing-x12);
          cursor: ${cmd.disabled ? 'not-allowed' : 'pointer'};
          opacity: ${cmd.disabled ? '0.5' : '1'};
          transition: background 0.08s ease;
          ${isSelected ? 'background: var(--nms-color-interaction-focus); color: var(--nms-color-space-void);' : ''}
        `;
        if (isSelected) {
          item.setAttribute('aria-selected', 'true');
        }

        const labelContainer = document.createElement('div');
        labelContainer.style.display = 'flex';
        labelContainer.style.flexDirection = 'column';
        labelContainer.style.gap = '2px';

        const label = document.createElement('span');
        label.style.fontSize = 'var(--nms-font-size-label)';
        label.style.fontWeight = '500';
        label.textContent = cmd.label;
        labelContainer.appendChild(label);

        if (cmd.description) {
          const desc = document.createElement('span');
          desc.style.fontSize = 'var(--nms-font-size-meta)';
          desc.style.color = isSelected ? 'rgba(5,7,11,0.7)' : 'var(--nms-color-text-muted)';
          desc.textContent = cmd.description;
          labelContainer.appendChild(desc);
        }

        item.appendChild(labelContainer);

        if (cmd.shortcut) {
          const shortcut = document.createElement('kbd');
          shortcut.style.cssText = `
            font-family: var(--nms-font-family);
            font-size: var(--nms-font-size-meta);
            padding: 2px 6px;
            background: ${isSelected ? 'rgba(5,7,11,0.2)' : 'var(--nms-color-surface-border)'};
            border-radius: 4px;
            color: ${isSelected ? 'var(--nms-color-space-void)' : 'var(--nms-color-text-secondary)'};
          `;
          shortcut.textContent = cmd.shortcut;
          item.appendChild(shortcut);
        }

        item.addEventListener('click', () => {
          if (!cmd.disabled) {
            cmd.action();
            this.hide();
          }
        });

        item.addEventListener('mouseenter', () => {
          this._selectedIndex = globalIndex;
          this.updateSelection();
        });

        this._listContainer.appendChild(item);
        globalIndex++;
      }
    }
  }

  render(): void {
    this.shadow.innerHTML = '';

    if (!this._open) return;

    const style = this.createStyleSheet(`
      :host {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 2000;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding-top: 12vh;
        pointer-events: none;
      }
      .overlay {
        position: absolute;
        inset: 0;
        background: rgba(5, 7, 11, 0.6);
        backdrop-filter: blur(4px);
        animation: fadeIn 0.15s ease;
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      .palette {
        position: relative;
        z-index: 1;
        pointer-events: auto;
        width: min(720px, calc(100vw - 48px));
        background: var(--nms-color-surface-base);
        border: 1px solid var(--nms-color-surface-border);
        border-radius: var(--nms-panel-border-radius);
        box-shadow: 0 24px 64px rgba(0,0,0,0.48);
        animation: slideDown 0.2s ease;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        font-family: var(--nms-font-family);
      }
      @keyframes slideDown {
        from { opacity: 0; transform: translateY(-16px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .input-wrapper {
        position: relative;
        padding: var(--nms-spacing-x16);
        border-bottom: 1px solid var(--nms-color-surface-border);
      }
      .search-icon {
        position: absolute;
        left: var(--nms-spacing-x12);
        top: 50%;
        transform: translateY(-50%);
        color: var(--nms-color-text-muted);
        font-size: var(--nms-font-size-label);
        pointer-events: none;
      }
      .search-input {
        width: 100%;
        padding: var(--nms-spacing-x12) var(--nms-spacing-x16) var(--nms-spacing-x12) 44px;
        background: var(--nms-color-surface-raised);
        border: 1px solid var(--nms-color-surface-border);
        border-radius: 8px;
        color: var(--nms-color-text-primary);
        font-family: inherit;
        font-size: var(--nms-font-size-label);
        outline: none;
        box-sizing: border-box;
      }
      .search-input:focus {
        border-color: var(--nms-color-interaction-focus);
      }
      .shortcut-hint {
        position: absolute;
        right: var(--nms-spacing-x12);
        top: 50%;
        transform: translateY(-50%);
        font-size: var(--nms-font-size-meta);
        color: var(--nms-color-text-muted);
      }
      .results {
        max-height: 50vh;
        overflow-y: auto;
        padding: var(--nms-spacing-x8);
      }
      .command-category {
        user-select: none;
      }
      .command-item {
        border-radius: 6px;
        margin: 2px 0;
      }
      .command-item:hover:not([style*="opacity: 0.5"]) {
        background: var(--nms-color-surface-raised);
      }
      .command-empty {
        user-select: none;
      }
      kbd {
        font-family: inherit;
      }
    `);

    this.shadow.appendChild(style);

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.addEventListener('click', () => this.hide());
    this.shadow.appendChild(overlay);

    const palette = document.createElement('div');
    palette.className = 'palette';

    // Input wrapper
    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'input-wrapper';

    const searchIcon = document.createElement('span');
    searchIcon.className = 'search-icon';
    searchIcon.textContent = '⌘';
    inputWrapper.appendChild(searchIcon);

    const input = document.createElement('input');
    input.className = 'search-input';
    input.type = 'search';
    input.placeholder = this._placeholder;
    input.setAttribute('aria-label', 'Command palette search');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('spellcheck', 'false');
    input.addEventListener('input', this.handleInput);
    this._input = input;
    inputWrapper.appendChild(input);

    const shortcutHint = document.createElement('span');
    shortcutHint.className = 'shortcut-hint';
    shortcutHint.textContent = '⌘K';
    inputWrapper.appendChild(shortcutHint);

    palette.appendChild(inputWrapper);

    // Results list
    const results = document.createElement('div');
    results.className = 'results';
    this._listContainer = results;
    palette.appendChild(results);

    this.shadow.appendChild(palette);
  }

  get isOpen(): boolean {
    return this._open;
  }

  set isOpen(value: boolean) {
    this._open = value;
    this.toggleAttribute('open', value);
    if (value) this.show(); else this.hide();
  }
}

defineComponent('nms-command-palette', CommandPalette);