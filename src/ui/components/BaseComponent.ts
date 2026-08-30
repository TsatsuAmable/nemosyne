export interface ComponentProperties {
  className?: string;
  style?: Partial<CSSStyleDeclaration>;
  'data-testid'?: string;
}

export abstract class BaseComponent extends HTMLElement {
  protected shadow: ShadowRoot;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  protected setStyles(styles: Partial<CSSStyleDeclaration>): void {
    Object.assign(this.style, styles);
  }

  protected createStyleSheet(css: string): HTMLStyleElement {
    const style = document.createElement('style');
    style.textContent = css;
    return style;
  }

  protected applyProperties(props: ComponentProperties): void {
    if (props.className) this.className = props.className;
    if (props.style) this.setStyles(props.style);
    if (props['data-testid']) this.setAttribute('data-testid', props['data-testid']);
  }

  connectedCallback(): void {
    this.render();
  }

  abstract render(): void;
}

export function defineComponent(name: string, constructor: CustomElementConstructor): void {
  if (!customElements.get(name)) {
    customElements.define(name, constructor);
  }
}