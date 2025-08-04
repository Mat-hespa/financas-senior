import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PwaService {
  private deferredPrompt: any;
  showInstallButton = false;

  constructor() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallButton = true;
    });

    window.addEventListener('appinstalled', () => {
      console.log('PWA foi instalada!');
      this.showInstallButton = false;
    });
  }

  async installApp() {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      console.log(`Usuário ${outcome} a instalação`);
      this.deferredPrompt = null;
      this.showInstallButton = false;
    }
  }

  isIos() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }

  isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches;
  }
}