import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { createAppConfig } from './app/app.config';

bootstrapApplication(App, createAppConfig()).catch((error) => console.error(error));
