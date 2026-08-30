import { BaseComponent, defineComponent } from './BaseComponent.ts';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastProperties extends Record<string, unknown> {
  type?: ToastType;
  title?: string;
  message: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
  onClose?: () => void;
}

const TYPE_STYLES = {
  info: { borderColor: 'var(--nms-color-interaction-focus)', iconColor: 'var(--nms-color-interaction-focus)' },
  success: { borderColor: 'var(--nms-color-interaction-commit)', iconColor: 'var(--nms-color-interaction-commit)' },
  warning: { borderColor: 'var(--nms-color-epistemic-uncertain)', iconColor: 'var(--nms-color-epistemic-uncertain)' },
  error: { borderColor: 'var(--nms-color-danger-destructive)', iconColor: 'var(--nms-color-danger-destructive)' },
} as const;

const ICONS = {
  info: 'ℹ',
  success: '✓',
  warning: '⚠',
  error: '✕',
} as const;

export class Toast extends BaseComponent {
  static observedAttributes = ['type', 'title', 'duration'];

  private _type: ToastType = 'info';
  private _title = '';
  private _message = '';
  private _duration = 5000;
  private _action: { label: string; onClick: () => void } | null = null;
  private _onClose: (() => void) | null = null;
  private _timer: ReturnType<typeof setTimeout> | null = null;

  attributeChangedCallback(name: string, _old: string, value: string): void {
    switch (name) {
      case 'type':
        this._type = (value as ToastType) || 'info';
        break;
      case 'title':
        this._title = value;
        break;
      case 'duration':
        this._duration = parseInt(value, 10) || 5000;
        break;
    }
    this.render();
  }

  connectedCallback(): void {
    this._type = (this.getAttribute('type') as ToastType) || 'info';
    this._title = this.getAttribute('title') || '';
    this._duration = parseInt(this.getAttribute('duration') || '5000', 10);
    this._message = this.textContent?.trim() || this.getAttribute('message') || '';
    super.connectedCallback();
    this.startAutoClose();
  }

  disconnectedCallback(): void {
    if (this._timer) clearTimeout(this._timer);
  }

  set action(value: { label: string; onClick: () => void } | null) {
    this._action = value;
    this.render();
  }

  set onClose(value: (() => void) | null) {
    this._onClose = value;
  }

  private startAutoClose(): void {
    if (this._duration <= 0) return;
    this._timer = setTimeout(() => this.close(), this._duration);
  }

  close(): void {
    if (this._timer) clearTimeout(this._timer);
    this.style.animation = 'slideOut 0.2s ease forwards';
    setTimeout(() => {
      this.remove();
      this.dispatchEvent(new CustomEvent('toast-close'));
      this._onClose?.();
    }, 200);
  }

  render(): void {
    this.shadow.innerHTML = '';

    const styles = TYPE_STYLES[this._type];
    const icon = ICONS[this._type];

    const style = this.createStyleSheet(`
      :host {
        display: flex;
        align-items: flex-start;
        gap: var(--nms-spacing-x12);
        padding: var(--nms-spacing-x16);
        background: var(--nms-color-surface-base);
        border-left: 4px solid ${styles.borderColor};
        border-radius: var(--nms-panel-border-radius);
        box-shadow: 0 8px 32px rgba(0,0,0,0.32);
        animation: slideIn 0.25s ease;
        font-family: var(--nms-font-family);
        min-width: 280px;
        max-width: 420px;
      }
      @keyframes slideIn {
        from { opacity: 0; transform: translateX(100%); }
        to { opacity: 1; transform: translateX(0); }
      }
      @keyframes slideOut {
        from { opacity: 1; transform: translateX(0); }
        to { opacity: 0; transform: translateX(100%); }
      }
      .icon {
        font-size: var(--nms-font-size-title);
        color: ${styles.iconColor};
        flex-shrink: 0;
        margin-top: 2px;
      }
      .content {
        flex: 1;
        min-width: 0;
      }
      .title {
        font-size: var(--nms-font-size-label);
        font-weight: 600;
        color: var(--nms-color-text-primary);
        margin-bottom: var(--nms-spacing-x4);
      }
      .message {
        font-size: var(--nms-font-size-body);
        color: var(--nms-color-text-secondary);
        line-height: 1.5;
      }
      .action {
        margin-top: var(--nms-spacing-x12);
      }
      .close {
        background: none;
        border: none;
        color: var(--nms-color-text-muted);
        cursor: pointer;
        padding: var(--nms-spacing-x4);
        font-size: var(--nms-font-size-heading);
        line-height: 1;
        flex-shrink: 0;
        opacity: 0.6;
        transition: opacity 0.15s ease;
      }
      .close:hover {
        opacity: 1;
        color: var(--nms-color-text-primary);
      }
      .close:focus-visible {
        outline: 2px solid var(--nms-color-interaction-focus);
        outline-offset: 2px;
        border-radius: 4px;
      }
    `);

    this.shadow.appendChild(style);

    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.gap = 'var(--nms-spacing-x12)';

    const iconEl = document.createElement('span');
    iconEl.className = 'icon';
    iconEl.textContent = icon;
    iconEl.setAttribute('aria-hidden', 'true');
    wrapper.appendChild(iconEl);

    const content = document.createElement('div');
    content.className = 'content';

    if (this._title) {
      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = this._title;
      content.appendChild(title);
    }

    const message = document.createElement('div');
    message.className = 'message';
    message.textContent = this._message;
    content.appendChild(message);

    if (this._action) {
      const actionBtn = document.createElement('button');
      actionBtn.className = 'action';
      actionBtn.textContent = this._action.label;
      actionBtn.style.cssText = `
        font: inherit;
        font-size: var(--nms-font-size-meta);
        font-weight: 500;
        color: ${styles.iconColor};
        background: none;
        border: 1px solid ${styles.borderColor};
        border-radius: var(--nms-panel-border-radius);
        padding: var(--nms-spacing-x4) var(--nms-spacing-x12);
        cursor: pointer;
        transition: all 0.12s ease;
      `;
      actionBtn.addEventListener('mouseenter', () => {
        actionBtn.style.background = styles.borderColor;
        actionBtn.style.color = 'var(--nms-color-space-void)';
      });
      actionBtn.addEventListener('mouseleave', () => {
        actionBtn.style.background = 'none';
        actionBtn.style.color = styles.iconColor;
      });
      actionBtn.addEventListener('click', () => {
        this._action!.onClick();
        this.close();
      });
      content.appendChild(actionBtn);
    }

    wrapper.appendChild(content);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'close';
    closeBtn.textContent = '✕';
    closeBtn.setAttribute('aria-label', 'Dismiss notification');
    closeBtn.addEventListener('click', () => this.close());
    wrapper.appendChild(closeBtn);

    this.shadow.appendChild(wrapper);
  }

  get type(): ToastType {
    return this._type;
  }

  set type(value: ToastType) {
    this._type = value;
    this.setAttribute('type', value);
    this.render();
  }

  get title(): string {
    return this._title;
  }

  set title(value: string) {
    this._title = value;
    this.setAttribute('title', value);
    this.render();
  }

  get message(): string {
    return this._message;
  }

  set message(value: string) {
    this._message = value;
    this.setAttribute('message', value);
    this.textContent = value;
    this.render();
  }

  get duration(): number {
    return this._duration;
  }

  set duration(value: number) {
    this._duration = value;
    this.setAttribute('duration', String(value));
  }
}

defineComponent('nms-toast', Toast);