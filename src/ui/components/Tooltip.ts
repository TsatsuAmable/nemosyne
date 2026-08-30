import { BaseComponent, defineComponent } from './BaseComponent.ts';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProperties extends Record<string, unknown> {
  content: string;
  position?: TooltipPosition;
  offset?: number;
  delay?: number;
  persistent?: boolean;
}

const POSITION_STYLES = {
  top: { transform: 'translateX(-50%) translateY(-8px)', top: 'calc(100% + 8px)', left: '50%', right: 'auto', bottom: 'auto' },
  bottom: { transform: 'translateX(-50%) translateY(8px)', bottom: 'calc(100% + 8px)', left: '50%', right: 'auto', top: 'auto' },
  left: { transform: 'translateY(-50%) translateX(-8px)', left: 'calc(100% + 8px)', top: '50%', bottom: 'auto', right: 'auto' },
  right: { transform: 'translateY(-50%) translateX(8px)', right: 'calc(100% + 8px)', top: '50%', bottom: 'auto', left: 'auto' },
} as const;

export class Tooltip extends BaseComponent {
  static observedAttributes = ['content', 'position', 'offset', 'delay', 'persistent'];

  private _content = '';
  private _position: TooltipPosition = 'top';
  private _offset = 8;
  private _delay = 150;
  private _persistent = false;
  private _showTimer: ReturnType<typeof setTimeout> | null = null;
  private _hideTimer: ReturnType<typeof setTimeout> | null = null;
  private _target: HTMLElement | null = null;

  attributeChangedCallback(name: string, _old: string, value: string): void {
    switch (name) {
      case 'content':
        this._content = value;
        break;
      case 'position':
        this._position = (value as TooltipPosition) || 'top';
        break;
      case 'offset':
        this._offset = parseInt(value, 10) || 8;
        break;
      case 'delay':
        this._delay = parseInt(value, 10) || 150;
        break;
      case 'persistent':
        this._persistent = value !== 'false';
        break;
    }
    this.updatePosition();
  }

  connectedCallback(): void {
    this._content = this.getAttribute('content') || this.textContent?.trim() || '';
    this._position = (this.getAttribute('position') as TooltipPosition) || 'top';
    this._offset = parseInt(this.getAttribute('offset') || '8', 10);
    this._delay = parseInt(this.getAttribute('delay') || '150', 10);
    this._persistent = this.hasAttribute('persistent');
    super.connectedCallback();

    this.style.position = 'absolute';
    this.style.zIndex = '9999';
    this.style.pointerEvents = 'none';
  }

  set target(element: HTMLElement | null) {
    if (this._target) {
      this._target.removeEventListener('mouseenter', this.show);
      this._target.removeEventListener('mouseleave', this.hide);
      this._target.removeEventListener('focus', this.show);
      this._target.removeEventListener('blur', this.hide);
    }
    this._target = element;
    if (element) {
      element.addEventListener('mouseenter', this.show);
      element.addEventListener('mouseleave', this.hide);
      element.addEventListener('focus', this.show);
      element.addEventListener('blur', this.hide);
    }
  }

  private show = (): void => {
    if (this._hideTimer) clearTimeout(this._hideTimer);
    this._showTimer = setTimeout(() => {
      this.style.display = 'block';
      this.updatePosition();
    }, this._delay);
  };

  private hide = (): void => {
    if (this._showTimer) clearTimeout(this._showTimer);
    if (!this._persistent) {
      this._hideTimer = setTimeout(() => {
        this.style.display = 'none';
      }, 100);
    }
  };

  private updatePosition(): void {
    if (!this._target || this.style.display === 'none') return;

    const targetRect = this._target.getBoundingClientRect();
    const styles = POSITION_STYLES[this._position];

    const getValue = (key: string): number => {
      switch (key) {
        case 'top': return targetRect.top;
        case 'bottom': return targetRect.bottom;
        case 'left': return targetRect.left;
        case 'right': return targetRect.right;
        default: return 0;
      }
    };

    if (styles.top !== 'auto') {
      this.style.top = `${getValue(styles.top) + this._offset}px`;
    } else {
      this.style.top = 'auto';
    }
    if (styles.bottom !== 'auto') {
      this.style.bottom = `${window.innerHeight - getValue(styles.bottom) + this._offset}px`;
    } else {
      this.style.bottom = 'auto';
    }
    if (styles.left !== 'auto') {
      this.style.left = `${getValue(styles.left) + this._offset}px`;
    } else {
      this.style.left = 'auto';
    }
    if (styles.right !== 'auto') {
      this.style.right = `${window.innerWidth - getValue(styles.right) + this._offset}px`;
    } else {
      this.style.right = 'auto';
    }
    this.style.transform = styles.transform;
  }

  render(): void {
    this.shadow.innerHTML = '';

    const style = this.createStyleSheet(`
      :host {
        display: none;
        max-width: 280px;
        padding: var(--nms-spacing-x8) var(--nms-spacing-x12);
        background: var(--nms-color-surface-raised);
        border: 1px solid var(--nms-color-surface-border);
        border-radius: var(--nms-panel-border-radius);
        font-family: var(--nms-font-family);
        font-size: var(--nms-font-size-meta);
        color: var(--nms-color-text-primary);
        line-height: 1.4;
        box-shadow: 0 8px 24px rgba(0,0,0,0.32);
        animation: fadeIn 0.15s ease;
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      .arrow {
        position: absolute;
        width: 0;
        height: 0;
        border: 6px solid transparent;
      }
    `);

    this.shadow.appendChild(style);

    const content = document.createElement('span');
    content.textContent = this._content;
    this.shadow.appendChild(content);
  }

  get content(): string {
    return this._content;
  }

  set content(value: string) {
    this._content = value;
    this.setAttribute('content', value);
    this.render();
  }

  get position(): TooltipPosition {
    return this._position;
  }

  set position(value: TooltipPosition) {
    this._position = value;
    this.setAttribute('position', value);
    this.render();
  }

  get offset(): number {
    return this._offset;
  }

  set offset(value: number) {
    this._offset = value;
    this.setAttribute('offset', String(value));
  }

  get delay(): number {
    return this._delay;
  }

  set delay(value: number) {
    this._delay = value;
    this.setAttribute('delay', String(value));
  }

  get persistent(): boolean {
    return this._persistent;
  }

  set persistent(value: boolean) {
    this._persistent = value;
    this.toggleAttribute('persistent', value);
  }
}

defineComponent('nms-tooltip', Tooltip);