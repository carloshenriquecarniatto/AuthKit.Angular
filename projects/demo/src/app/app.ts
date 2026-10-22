import { Component, inject } from '@angular/core';
import { AuthKitEmailComponent, AuthKitService } from 'authkit';
import { NotesComponent } from './notes';

@Component({
  selector: 'app-root',
  imports: [AuthKitEmailComponent, NotesComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly auth = inject(AuthKitService);

  readonly session = this.auth.session;
  readonly email = this.auth.email;
  readonly isAuthenticated = this.auth.isAuthenticated;

  constructor() {
    void this.auth.initialize();
  }

  /** The service keeps the session signal in sync; nothing else to do here. */
  onSignedIn(): void {}

  async signOut(): Promise<void> {
    await this.auth.signOut();
  }
}
