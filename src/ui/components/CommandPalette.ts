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

  attributeChangedCallback(name: string, _old: string, value: string | null): void {
    switch (name) {
      case 'open':
        this._open = value !== null && value !== 'false';
        break;
      case 'placeholder':
        this._placeholder = value || 'Type a command or search...';
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
    this._commands = [...value];
    this._filteredCommands = [...value];
    this._selectedIndex = this.firstSelectableIndex();
    if (this._open) this.render();
  }

  get commands(): CommandPaletteCommand[] {
    return [...this._commands];
  }

  addCommand(command: CommandPaletteCommand): void {
    this._commands.push(command);
    this._filteredCommands = [...this._commands];
    this._selectedIndex = this.firstSelectableIndex();
    if (this._open) this.render();
  }

  removeCommand(id: string): void {
    this._commands = this._commands.filter((command) => command.id !== id);
    this._filteredCommands = [...this._commands];
    this._selectedIndex = this.firstSelectableIndex();
    if (this._open) this.render();
  }

  show(): void {
    if (this._open) return;
    this._previousFocus = document.activeElement as HTMLElement | null;
    this._open = true;
    this.setAttribute('open', '');
    this.render();
    queueMicrotask(() => this._input?.focus());
  }

  hide(): void {
    if (!this._open) return;
    this._open = false;
    this.removeAttribute('open');
    this.render();
    this._previousFocus?.focus();
    this._previousFocus = null;
    this._onClose?.();
  }

  toggle(): void {
    if (this._open) this.hide();
    else this.show();
  }

  private firstSelectableIndex(): number {
    const index = this._filteredCommands.findIndex((command) => !command.disabled);
    return index >= 0 ? index : 0;
  }

  private moveSelection(delta: -1 | 1): void {
    if (this._filteredCommands.length === 0) return;

    let next = this._selectedIndex;
    for (let attempts = 0; attempts < this._filteredCommands.length; attempts += 1) {
      next = (next + delta + this._filteredCommands.length) % this._filteredCommands.length;
      if (!this._filteredCommands[next]?.disabled) {
        this._selectedIndex = next;
        this.updateSelection();
        return;
      }
    }
  }

  private handleGlobalKeyDown = (event: KeyboardEvent): void => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !this._open) {
      const active = document.activeElement;
      if (
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          (active as HTMLElement).isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      this.show();
      return;
    }

    if (!this._open) return;

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        this.hide();
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.moveSelection(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.moveSelection(-1);
        break;
      case 'Enter':
        event.preventDefault();
        this.executeSelected();
        break;
    }
  };

  private handleInput = (event: Event): void => {
    const query = (event.target as HTMLInputElement).value.toLowerCase().trim();
    this._filteredCommands = query
      ? this._commands.filter(
          (command) =>
            command.label.toLowerCase().includes(query) ||
            command.description?.toLowerCase().includes(query) ||
            command.id.toLowerCase().includes(query),
        )
      : [...this._commands];
    this._selectedIndex = this.firstSelectableIndex();
    this.renderList();
  };

  private updateSelection(): void {
    const items = this._listContainer?.querySelectorAll<HTMLElement>('.command-item');
    items?.forEach((item, index) => {
      const selected = index === this._selectedIndex;
      item.classList.toggle('selected', selected);
      item.setAttribute('aria-selected', String(selected));
      if (selected) item.scrollIntoView({ block: 'nearest' });
    });
  }

  private executeSelected(): void {
    const command = this._filteredCommands[this._selectedIndex];
    if (!command || command.disabled) return;
    void Promise.resolve(command.action()).catch((error: unknown) => {
      console.error('[CommandPalette] command failed:', error);
    });
    this.hide();
  }

  private renderList(): void {
    if (!this._listContainer) return;
    this._listContainer.innerHTML = '';

    if (this._filteredCommands.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'command-empty';
      empty.textContent = 'No commands found';
      this._listContainer.appendChild(empty);
      return;
    }

    const categories = new Map<string, CommandPaletteCommand[]>();
    for (const command of this._filteredCommands) {
      const category = command.category || 'Commands';
      const commands = categories.get(category) ?? [];
      commands.push(command);
      categories.set(category, commands);
    }

    let globalIndex = 0;
    for (const [category, commands] of categories) {
      const categoryHeader = document.createElement('div');
      categoryHeader.className = 'command-category';
      categoryHeader.textContent = category;
      this._listContainer.appendChild(categoryHeader);

      for (const command of commands) {
        const itemIndex = globalIndex;
        const item = document.createElement('div');
        item.className = 'command-item';
        item.dataset.commandId = command.id;
        item.setAttribute('role', 'option');
        item.setAttribute('aria-disabled', String(Boolean(command.disabled)));
        item.setAttribute('aria-selected', String(itemIndex === this._selectedIndex));
        if (command.disabled) item.classList.add('disabled');

        const labelContainer = document.createElement('div');
        labelContainer.className = 'command-copy';

        const label = document.createElement('span');
        label.className = 'command-label';
        label.textContent = command.label;
        labelContainer.appendChild(label);

        if (command.description) {
          const description = document.createElement('span');
          description.className = 'command-description';
          description.textContent = command.description;
          labelContainer.appendChild(description);
        }
        item.appendChild(labelContainer);

        if (command.shortcut) {
          const shortcut = document.createElement('kbd');
          shortcut.textContent = command.shortcut;
          item.appendChild(shortcut);
        }

        item.addEventListener('click', () => {
          if (command.disabled) return;
          this._selectedIndex = itemIndex;
          this.executeSelected();
        });
        item.addEventListener('mouseenter', () => {
          if (command.disabled) return;
          this._selectedIndex = itemIndex;
          this.updateSelection();
        });

        this._listContainer.appendChild(item);
        globalIndex += 1;
      }
    }
    this.updateSelection();
  }

  render(): void {
    this.shadow.innerHTML = '';
    this._input = null;
    this._listContainer = null;
    if (!this._open) return;

    const style = this.createStyleSheet(`
      :host {
        position: fixed;
        inset: 0;
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
      }
      .palette {
        position: relative;
        z-index: 1;
        pointer-events: auto;
        width: min(720px, calc(100vw - 48px));
        max-height: 76vh;
        background: var(--nms-color-surface-base);
        border: 1px solid var(--nms-color-surface-border);
        border-radius: var(--nms-panel-border-radius);
        box-shadow: 0 24px 64px rgba(0,0,0,0.48);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        font-family: var(--nms-font-family);
      }
      .input-wrapper {
        position: relative;
        padding: var(--nms-spacing-x16);
        border-bottom: 1px solid var(--nms-color-surface-border);
      }
      .search-icon {
        position: absolute;
        left: 28px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--nms-color-text-muted);
        pointer-events: none;
      }
      .search-input {
        width: 100%;
        box-sizing: border-box;
        padding: var(--nms-spacing-x12) 56px var(--nms-spacing-x12) 44px;
        background: var(--nms-color-surface-raised);
        border: 1px solid var(--nms-color-surface-border);
        border-radius: var(--nms-panel-border-radius);
        color: var(--nms-color-text-primary);
        font-family: inherit;
        font-size: var(--nms-font-size-label);
        outline: none;
      }
      .search-input:focus { border-color: var(--nms-color-interaction-focus); }
      .shortcut-hint {
        position: absolute;
        right: 28px;
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
        padding: var(--nms-spacing-x8) var(--nms-spacing-x12);
        font-size: var(--nms-font-size-meta);
        font-weight: 600;
        color: var(--nms-color-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        user-select: none;
      }
      .command-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--nms-spacing-x12);
        padding: var(--nms-spacing-x8) var(--nms-spacing-x12);
        border-radius: var(--nms-panel-border-radius);
        cursor: pointer;
      }
      .command-item.selected {
        background: var(--nms-color-interaction-focus);
        color: var(--nms-color-space-void);
      }
      .command-item.disabled { opacity: 0.5; cursor: not-allowed; }
      .command-copy { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
      .command-label { font-size: var(--nms-font-size-label); font-weight: 500; }
      .command-description { font-size: var(--nms-font-size-meta); color: var(--nms-color-text-muted); }
      .command-item.selected .command-description { color: rgba(5,7,11,0.72); }
      .command-empty {
        padding: var(--nms-spacing-x24);
        text-align: center;
        color: var(--nms-color-text-muted);
        font-size: var(--nms-font-size-label);
      }
      kbd {
        flex: 0 0 auto;
        font-family: inherit;
        font-size: var(--nms-font-size-meta);
        padding: 2px 6px;
        background: var(--nms-color-surface-border);
        border-radius: 4px;
        color: var(--nms-color-text-secondary);
      }
      .command-item.selected kbd {
        background: rgba(5,7,11,0.2);
        color: var(--nms-color-space-void);
      }
    `);
    this.shadow.appendChild(style);

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.addEventListener('click', () => this.hide());
    this.shadow.appendChild(overlay);

    const palette = document.createElement('div');
    palette.className = 'palette';
    palette.setAttribute('role', 'dialog');
    palette.setAttribute('aria-modal', 'true');
    palette.setAttribute('aria-label', 'Command palette');

    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'input-wrapper';

    const searchIcon = document.createElement('span');
    searchIcon.className = 'search-icon';
    searchIcon.textContent = '⌘';
    searchIcon.setAttribute('aria-hidden', 'true');
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
    shortcutHint.setAttribute('aria-hidden', 'true');
    inputWrapper.appendChild(shortcutHint);
    palette.appendChild(inputWrapper);

    const results = document.createElement('div');
    results.className = 'results';
    results.setAttribute('role', 'listbox');
    results.setAttribute('aria-label', 'Commands');
    this._listContainer = results;
    palette.appendChild(results);
    this.shadow.appendChild(palette);

    this.renderList();
  }

  get isOpen(): boolean {
    return this._open;
  }

  set isOpen(value: boolean) {
    if (value) this.show();
    else this.hide();
  }
}

defineComponent('nms-command-palette', CommandPalette);
