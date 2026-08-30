import { BaseComponent, defineComponent } from './BaseComponent.ts';

export class ToastManager extends BaseComponent {
  private _toasts: HTMLElement[] = [];

  connectedCallback(): void {
    this.style.cssText = `
      position: fixed;
      top: var(--nms-spacing-x24);
      right: var(--nms-spacing-x24);
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: var(--nms-spacing-x12);
      pointer-events: none;
      max-width: 420px;
    `;
    super.connectedCallback();
  }

  render(): void {
    // ToastManager renders its children (toasts) directly
    // No shadow DOM content needed
  }

  showToast(
    message: string,
    options: {
      type?: 'info' | 'success' | 'warning' | 'error';
      title?: string;
      duration?: number;
      action?: { label: string; onClick: () => void };
    } = {}
  ): HTMLElement {
    const toast = document.createElement('nms-toast');
    toast.setAttribute('type', options.type || 'info');
    if (options.title) toast.setAttribute('title', options.title);
    if (options.duration) toast.setAttribute('duration', String(options.duration));
    toast.textContent = message;

    if (options.action) {
      // We need to set the action after the element is created
      (toast as HTMLElement & { action?: { label: string; onClick: () => void } }).action = options.action;
    }

    toast.addEventListener('toast-close', () => this.removeToast(toast));
    this.appendChild(toast);
    this._toasts.push(toast);

    // Limit to 5 toasts
    if (this._toasts.length > 5) {
      const oldest = this._toasts.shift();
      oldest?.remove();
    }

    return toast;
  }

  private removeToast(toast: HTMLElement): void {
    const index = this._toasts.indexOf(toast);
    if (index !== -1) {
      this._toasts.splice(index, 1);
    }
  }

  info(message: string, title?: string): HTMLElement {
    return this.showToast(message, { type: 'info', title });
  }

  success(message: string, title?: string): HTMLElement {
    return this.showToast(message, { type: 'success', title });
  }

  warning(message: string, title?: string): HTMLElement {
    return this.showToast(message, { type: 'warning', title });
  }

  error(message: string, title?: string): HTMLElement {
    return this.showToast(message, { type: 'error', title });
  }
}

defineComponent('nms-toast-manager', ToastManager);