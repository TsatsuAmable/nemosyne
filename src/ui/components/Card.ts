import { BaseComponent, defineComponent } from './BaseComponent.ts';

export interface CardProperties extends Record<string, unknown> {
  elevated?: boolean;
  interactive?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const PADDING_MAP = {
  none: '0',
  sm: 'var(--nms-spacing-x8)',
  md: 'var(--nms-spacing-x16)',
  lg: 'var(--nms-spacing-x24)',
} as const;

export class Card extends BaseComponent {
  static observedAttributes = ['elevated', 'interactive', 'padding'] as const;

  private _elevated = false;
  private _interactive = false;
  private _padding: 'none' | 'sm' | 'md' | 'lg' = 'md';

  attributeChangedCallback(name: string, _old: string, value: string): void {
    switch (name) {
      case 'elevated':
        this._elevated = value !== 'false';
        break;
      case 'interactive':
        this._interactive = value !== 'false';
        break;
      case 'padding':
        this._padding = (value as 'none' | 'sm' | 'md' | 'lg') || 'md';
        break;
    }
    this.render();
  }

  connectedCallback(): void {
    this._elevated = this.hasAttribute('elevated');
    this._interactive = this.hasAttribute('interactive');
    this._padding = (this.getAttribute('padding') as 'none' | 'sm' | 'md' | 'lg') || 'md';
    super.connectedCallback();
  }

  render(): void {
    this.shadow.innerHTML = '';

    const style = this.createStyleSheet(`
      :host {
        display: block;
        background: var(--nms-color-surface-base);
        border: 1px solid var(--nms-color-surface-border);
        border-radius: var(--nms-panel-border-radius);
        padding: ${PADDING_MAP[this._padding]};
        box-shadow: ${this._elevated ? '0 8px 32px rgba(0,0,0,0.32)' : 'none'};
        transition: box-shadow 0.15s ease, border-color 0.15s ease;
        font-family: var(--nms-font-family);
        color: var(--nms-color-text-primary);
      }
      :host([interactive]) {
        cursor: pointer;
      }
      :host([interactive]:hover) {
        border-color: var(--nms-color-interaction-focus);
        box-shadow: ${this._elevated ? '0 12px 40px rgba(0,0,0,0.4), 0 0 0 1px var(--nms-color-interaction-focus)' : '0 0 0 1px var(--nms-color-interaction-focus)'};
      }
      :host([interactive]:focus-visible) {
        outline: 2px solid var(--nms-color-interaction-focus);
        outline-offset: 2px;
      }
      ::slotted(*) {
        color: inherit;
      }
    `);

    this.shadow.appendChild(style);

    const slot = document.createElement('slot');
    this.shadow.appendChild(slot);
  }

  get elevated(): boolean {
    return this._elevated;
  }

  set elevated(value: boolean) {
    this._elevated = value;
    this.toggleAttribute('elevated', value);
    this.render();
  }

  get interactive(): boolean {
    return this._interactive;
  }

  set interactive(value: boolean) {
    this._interactive = value;
    this.toggleAttribute('interactive', value);
    this.render();
  }

  get padding(): 'none' | 'sm' | 'md' | 'lg' {
    return this._padding;
  }

  set padding(value: 'none' | 'sm' | 'md' | 'lg') {
    this._padding = value;
    this.setAttribute('padding', value);
    this.render();
  }
}

defineComponent('nms-card', Card);