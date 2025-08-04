import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule, Router, NavigationStart, NavigationEnd } from '@angular/router';
import { LoadingService } from '../services/loading.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'app-financas-senior';
  isLoading = false;

  constructor(
    private router: Router,
    private loadingService: LoadingService
  ) {
    this.loadingService.loading$.subscribe(loading => {
      this.isLoading = loading;
    });

    this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.loadingService.show();
      } else if (event instanceof NavigationEnd) {
        setTimeout(() => this.loadingService.hide(), 500);
      }
    });
  }
}