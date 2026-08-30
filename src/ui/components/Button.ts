import { BaseComponent, defineComponent } from './BaseComponent.ts';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProperties extends Record<string, unknown> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  'aria-label'?: string;
  'aria-pressed'?: string;
  'aria-expanded'?: string;
}

const SIZE_STYLES = {
  sm: { padding: 'var(--nms-spacing-x4) var(--nms-spacing-x12)', fontSize: 'var(--nms-font-size-meta)', minHeight: '32px' },
  md: { padding: 'var(--nms-spacing-x8) var(--nms-spacing-x16)', fontSize: 'var(--nms-font-size-label)', minHeight: '40px' },
  lg: { padding: 'var(--nms-spacing-x12) var(--nms-spacing-x24)', fontSize: 'var(--nms-font-size-body)', minHeight: '48px' },
} as const;

export class Button extends BaseComponent {
  static observedAttributes = ['variant', 'size', 'disabled', 'loading'];

  private _variant: ButtonVariant = 'secondary';
  private _size: ButtonSize = 'md';
  private _disabled = false;
  private _loading = false;
  private _onClick: ((e: MouseEvent) => void) | null = null;

  attributeChangedCallback(name: string, _old: string, value: string): void {
    switch (name) {
      case 'variant':
        this._variant = (value as ButtonVariant) || 'secondary';
        break;
      case 'size':
        this._size = (value as ButtonSize) || 'md';
        break;
      case 'disabled':
        this._disabled = value !== 'false';
        break;
      case 'loading':
        this._loading = value !== 'false';
        break;
    }
    this.render();
  }

  connectedCallback(): void {
    this._variant = (this.getAttribute('variant') as ButtonVariant) || 'secondary';
    this._size = (this.getAttribute('size') as ButtonSize) || 'md';
    this._disabled = this.hasAttribute('disabled');
    this._loading = this.hasAttribute('loading');
    super.connectedCallback();
  }

  set onClick(handler: ((e: MouseEvent) => void) | null) {
    this._onClick = handler;
  }

  private getVariantStyles(): Record<string, string> {
    const base = {
      border: '1px solid var(--nms-color-surface-border)',
      borderRadius: 'var(--nms-panel-border-radius)',
      fontFamily: 'var(--nms-font-family)',
      fontWeight: '500',
      cursor: this._disabled || this._loading ? 'default' : 'pointer',
      transition: 'all 0.12s ease',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 'var(--nms-spacing-x8)',
      minHeight: SIZE_STYLES[this._size].minHeight,
      padding: SIZE_STYLES[this._size].padding,
      fontSize: SIZE_STYLES[this._size].fontSize,
    };

    if (this._disabled || this._loading) {
      return {
        ...base,
        background: 'var(--nms-color-surface-raised)',
        color: 'var(--nms-color-text-muted)',
        borderColor: 'var(--nms-color-surface-border)',
      };
    }

    switch (this._variant) {
      case 'primary':
        return {
          ...base,
          background: 'var(--nms-color-interaction-focus)',
          color: 'var(--nms-color-space-void)',
          borderColor: 'var(--nms-color-interaction-focus)',
        };
      case 'danger':
        return {
          ...base,
          background: 'var(--nms-color-danger-destructive)',
          color: 'var(--nms-color-text-primary)',
          borderColor: 'var(--nms-color-danger-destructive)',
        };
      case 'ghost':
        return {
          ...base,
          background: 'transparent',
          color: 'var(--nms-color-text-primary)',
          borderColor: 'transparent',
        };
      case 'secondary':
      default:
        return {
          ...base,
          background: 'var(--nms-color-surface-raised)',
          color: 'var(--nms-color-text-primary)',
          borderColor: 'var(--nms-color-surface-border)',
        };
    }
  }

  private getHoverStyles(): Record<string, string> {
    if (this._disabled || this._loading) return {};

    switch (this._variant) {
      case 'primary':
        return {
          background: 'var(--nms-color-interaction-commit)',
          borderColor: 'var(--nms-color-interaction-commit)',
        };
      case 'danger':
        return {
          background: 'var(--nms-color-epistemic-contradiction)',
          borderColor: 'var(--nms-color-epistemic-contradiction)',
        };
      case 'ghost':
        return {
          background: 'var(--nms-color-surface-raised)',
        };
      case 'secondary':
      default:
        return {
          background: 'var(--nms-color-surface-border)',
          borderColor: 'var(--nms-color-interaction-focus)',
        };
    }
  }

  render(): void {
    this.shadow.innerHTML = '';

    const variantStyles = this.getVariantStyles();
    const hoverStyles = this.getHoverStyles();

    const style = this.createStyleSheet(`
      :host {
        display: inline-flex;
      }
      button {
        ${Object.entries(variantStyles).map(([k, v]) => `${k}: ${v};`).join(' ')}
        border: none;
        font: inherit;
        width: 100%;
      }
      button:not(:disabled):hover {
        ${Object.entries(hoverStyles).map(([k, v]) => `${k}: ${v};`).join(' ')}
      }
      button:focus-visible {
        outline: 2px solid var(--nms-color-interaction-focus);
        outline-offset: 2px;
      }
      .spinner {
        width: 1em;
        height: 1em;
        border: 2px solid currentColor;
        border-right-color: transparent;
        border-radius: 50%;
        animation: spin 0.6s linear infinite;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      .content {
        display: inline-flex;
        align-items: center;
        gap: var(--nms-spacing-x8);
      }
      .content.loading {
        opacity: 0.7;
      }
    `);

    this.shadow.appendChild(style);

    const button = document.createElement('button');
    button.type = 'button';
    button.disabled = this._disabled || this._loading;
    if (this._onClick) {
      button.addEventListener('click', this._onClick);
    }

    if (this.hasAttribute('aria-label')) {
      button.setAttribute('aria-label', this.getAttribute('aria-label')!);
    }
    if (this.hasAttribute('aria-pressed')) {
      button.setAttribute('aria-pressed', this.getAttribute('aria-pressed')!);
    }
    if (this.hasAttribute('aria-expanded')) {
      button.setAttribute('aria-expanded', this.getAttribute('aria-expanded')!);
    }

    const content = document.createElement('span');
    content.className = `content${this._loading ? ' loading' : ''}`;

    if (this._loading) {
      const spinner = document.createElement('span');
      spinner.className = 'spinner';
      spinner.setAttribute('aria-hidden', 'true');
      content.appendChild(spinner);
    }

    const label = document.createElement('span');
    label.textContent = this.textContent || this.getAttribute('label') || '';
    content.appendChild(label);

    button.appendChild(content);
    this.shadow.appendChild(button);

    const slot = document.createElement('slot');
    slot.style.display = 'none';
    this.shadow.appendChild(slot);
  }

  get variant(): ButtonVariant {
    return this._variant;
  }

  set variant(value: ButtonVariant) {
    this._variant = value;
    this.setAttribute('variant', value);
    this.render();
  }

  get size(): ButtonSize {
    return this._size;
  }

  set size(value: ButtonSize) {
    this._size = value;
    this.setAttribute('size', value);
    this.render();
  }

  get disabled(): boolean {
    return this._disabled;
  }

  set disabled(value: boolean) {
    this._disabled = value;
    this.toggleAttribute('disabled', value);
    this.render();
  }

  get loading(): boolean {
    return this._loading;
  }

  set loading(value: boolean) {
    this._loading = value;
    this.toggleAttribute('loading', value);
    this.render();
  }
}

defineComponent('nms-button', Button);