import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import { loadingBarInterceptor } from './loading';
import { sessionInterceptor } from './auth';
import { provideRouter, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
    ),
    provideHttpClient(withXhr(), withInterceptors([loadingBarInterceptor, sessionInterceptor])),
  ],
};
