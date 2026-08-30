import { BaseComponent, defineComponent } from './BaseComponent.ts';

export interface ModalProperties extends Record<string, unknown> {
  open?: boolean;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'full';
  onClose?: () => void;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
}

const SIZE_STYLES = {
  sm: 'max-width: 360px;',
  md: 'max-width: 520px;',
  lg: 'max-width: 760px;',
  full: 'max-width: calc(100vw - 48px); width: calc(100vw - 48px);',
} as const;

export class Modal extends BaseComponent {
  static observedAttributes = ['open', 'title', 'size'];

  private _open = false;
  private _title = '';
  private _size: 'sm' | 'md' | 'lg' | 'full' = 'md';
  private _onClose: (() => void) | null = null;
  private _closeOnOverlayClick = true;
  private _closeOnEscape = true;
  private _previousFocus: HTMLElement | null = null;
  private _focusableElements: HTMLElement[] = [];

  attributeChangedCallback(name: string, _old: string, value: string): void {
    switch (name) {
      case 'open':
        this._open = value !== 'false';
        break;
      case 'title':
        this._title = value;
        break;
      case 'size':
        this._size = (value as 'sm' | 'md' | 'lg' | 'full') || 'md';
        break;
    }
    this.render();
  }

  connectedCallback(): void {
    this._open = this.hasAttribute('open');
    this._title = this.getAttribute('title') || '';
    this._size = (this.getAttribute('size') as 'sm' | 'md' | 'lg' | 'full') || 'md';
    this._closeOnOverlayClick = this.getAttribute('close-on-overlay-click') !== 'false';
    this._closeOnEscape = this.getAttribute('close-on-escape') !== 'false';
    super.connectedCallback();

    document.addEventListener('keydown', this.handleKeyDown);
    if (this._open) this.trapFocus();
  }

  disconnectedCallback(): void {
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  set onClose(value: (() => void) | null) {
    this._onClose = value;
  }

  set closeOnOverlayClick(value: boolean) {
    this._closeOnOverlayClick = value;
  }

  set closeOnEscape(value: boolean) {
    this._closeOnEscape = value;
  }

  show(): void {
    this._open = true;
    this.setAttribute('open', '');
    this._previousFocus = document.activeElement as HTMLElement;
    this.render();
    this.trapFocus();
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

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (!this._open) return;

    if (e.key === 'Escape' && this._closeOnEscape) {
      e.preventDefault();
      this.hide();
      return;
    }

    if (e.key === 'Tab') {
      this.handleTabKey(e);
    }
  };

  private handleTabKey(e: KeyboardEvent): void {
    this.updateFocusableElements();
    if (this._focusableElements.length === 0) return;

    const first = this._focusableElements[0];
    const last = this._focusableElements[this._focusableElements.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  private updateFocusableElements(): void {
    const modal = this.shadow.querySelector('.modal-content');
    if (!modal) return;
    const elements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    this._focusableElements = Array.from(elements).filter(
      (el): el is HTMLElement => !el.hasAttribute('disabled') && el.offsetParent !== null
    );
  }

  private trapFocus(): void {
    this.updateFocusableElements();
    if (this._focusableElements.length > 0) {
      this._focusableElements[0].focus();
    }
  }

  render(): void {
    this.shadow.innerHTML = '';

    if (!this._open) return;

    const style = this.createStyleSheet(`
      :host {
        position: fixed;
        inset: 0;
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: var(--nms-spacing-x24);
      }
      .overlay {
        position: absolute;
        inset: 0;
        background: rgba(5, 7, 11, 0.8);
        backdrop-filter: blur(8px);
        animation: fadeIn 0.2s ease;
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      .modal-content {
        position: relative;
        z-index: 1;
        background: var(--nms-color-surface-base);
        border: 1px solid var(--nms-color-surface-border);
        border-radius: var(--nms-panel-border-radius);
        box-shadow: 0 24px 64px rgba(0,0,0,0.48);
        animation: slideUp 0.25s ease;
        max-height: calc(100vh - 48px);
        display: flex;
        flex-direction: column;
        ${SIZE_STYLES[this._size]}
        width: 100%;
      }
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(16px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--nms-spacing-x16) var(--nms-spacing-x24);
        border-bottom: 1px solid var(--nms-color-surface-border);
      }
      .title {
        font-size: var(--nms-font-size-heading);
        font-weight: 600;
        color: var(--nms-color-text-primary);
        margin: 0;
      }
      .close-btn {
        background: none;
        border: none;
        color: var(--nms-color-text-muted);
        cursor: pointer;
        padding: var(--nms-spacing-x4);
        font-size: var(--nms-font-size-heading);
        line-height: 1;
        border-radius: var(--nms-panel-border-radius);
        transition: all 0.12s ease;
      }
      .close-btn:hover {
        background: var(--nms-color-surface-raised);
        color: var(--nms-color-text-primary);
      }
      .close-btn:focus-visible {
        outline: 2px solid var(--nms-color-interaction-focus);
        outline-offset: 2px;
      }
      .body {
        padding: var(--nms-spacing-x24);
        overflow-y: auto;
        flex: 1;
      }
      .footer {
        display: flex;
        justify-content: flex-end;
        gap: var(--nms-spacing-x12);
        padding: var(--nms-spacing-x16) var(--nms-spacing-x24);
        border-top: 1px solid var(--nms-color-surface-border);
      }
      ::slotted([slot="footer"]) {
        display: flex;
        gap: var(--nms-spacing-x12);
      }
    `);

    this.shadow.appendChild(style);

    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    if (this._closeOnOverlayClick) {
      overlay.addEventListener('click', () => this.hide());
    }
    this.shadow.appendChild(overlay);

    const modal = document.createElement('div');
    modal.className = 'modal-content';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    if (this._title) modal.setAttribute('aria-labelledby', 'modal-title');

    const header = document.createElement('div');
    header.className = 'header';

    if (this._title) {
      const title = document.createElement('h2');
      title.id = 'modal-title';
      title.className = 'title';
      title.textContent = this._title;
      header.appendChild(title);
    }

    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.textContent = '✕';
    closeBtn.setAttribute('aria-label', 'Close dialog');
    closeBtn.addEventListener('click', () => this.hide());
    header.appendChild(closeBtn);

    modal.appendChild(header);

    const body = document.createElement('div');
    body.className = 'body';
    const bodySlot = document.createElement('slot');
    body.appendChild(bodySlot);
    modal.appendChild(body);

    const footer = document.createElement('div');
    footer.className = 'footer';
    const footerSlot = document.createElement('slot');
    footerSlot.setAttribute('name', 'footer');
    footer.appendChild(footerSlot);
    modal.appendChild(footer);

    this.shadow.appendChild(modal);
  }

  get isOpen(): boolean {
    return this._open;
  }

  set isOpen(value: boolean) {
    this._open = value;
    this.toggleAttribute('open', value);
    if (value) this.show(); else this.hide();
  }

  get title(): string {
    return this._title;
  }

  set title(value: string) {
    this._title = value;
    this.setAttribute('title', value);
    this.render();
  }

  get size(): 'sm' | 'md' | 'lg' | 'full' {
    return this._size;
  }

  set size(value: 'sm' | 'md' | 'lg' | 'full') {
    this._size = value;
    this.setAttribute('size', value);
    this.render();
  }
}

defineComponent('nms-modal', Modal);