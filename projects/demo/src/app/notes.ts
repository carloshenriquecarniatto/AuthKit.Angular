import { Component, inject, signal } from '@angular/core';
import { AUTH_PROVIDER } from 'authkit';
import { SupabaseAuthProvider } from 'authkit';

interface Note {
  id: number;
  body: string;
}

/**
 * Minimal notes CRUD. RLS is the point: each user can only read and write their own rows, and
 * the policies live in security/pentest-notes.sql.
 */
@Component({
  selector: 'ak-demo-notes',
  template: `
    <h2>Your notes</h2>

    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }

    <form class="row" (submit)="add($event)">
      <input
        class="input"
        placeholder="Write a note"
        [value]="body()"
        (input)="body.set(valueOf($event))"
      />
      <button class="button" type="submit" [disabled]="busy() || !body().trim()">Add</button>
    </form>

    @if (notes().length === 0) {
      <p class="empty">No notes yet. Add one above.</p>
    } @else {
      <ul>
        @for (note of notes(); track note.id) {
          <li>
            <span>{{ note.body }}</span>
            <button class="remove" type="button" (click)="remove(note.id)">delete</button>
          </li>
        }
      </ul>
    }

    <p class="small">Each account sees only its own rows, enforced by Postgres RLS.</p>
  `,
  styles: [
    `
      h2 {
        font-size: 1rem;
        margin: 0 0 12px;
      }
      .row {
        display: flex;
        gap: 8px;
      }
      .input {
        flex: 1;
        padding: 0.65rem 0.8rem;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        font: inherit;
      }
      .button {
        padding: 0.65rem 1rem;
        border: 0;
        border-radius: 8px;
        background: #0f766e;
        color: #fff;
        font: inherit;
        cursor: pointer;
      }
      .button:disabled {
        opacity: 0.5;
        cursor: default;
      }
      ul {
        list-style: none;
        padding: 0;
        margin: 16px 0 0;
        display: grid;
        gap: 8px;
      }
      li {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 12px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
      }
      .remove {
        border: 0;
        background: none;
        color: #b91c1c;
        cursor: pointer;
        font: inherit;
      }
      .empty {
        color: #64748b;
        font-size: 0.9rem;
        margin: 16px 0 0;
      }
      .small {
        color: #94a3b8;
        font-size: 0.75rem;
        margin: 20px 0 0;
      }
      .error {
        color: #b91c1c;
        font-size: 0.85rem;
      }
    `,
  ],
})
export class NotesComponent {
  private readonly provider = inject(AUTH_PROVIDER) as SupabaseAuthProvider;

  readonly notes = signal<Note[]>([]);
  readonly body = signal('');
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);

  constructor() {
    void this.load();
  }

  valueOf(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  async load(): Promise<void> {
    const { data, error } = await this.provider.supabase
      .from('notes')
      .select('id,body')
      .order('id', { ascending: false });

    if (error) {
      this.error.set(error.message);
      return;
    }

    this.notes.set((data ?? []) as Note[]);
  }

  async add(event: Event): Promise<void> {
    event.preventDefault();
    const text = this.body().trim();
    const session = this.provider.currentSession;

    if (!text || !session) {
      return;
    }

    this.busy.set(true);
    this.error.set(null);

    const { error } = await this.provider.supabase
      .from('notes')
      .insert({ user_id: session.user.id, body: text });

    this.busy.set(false);

    if (error) {
      this.error.set(error.message);
      return;
    }

    this.body.set('');
    await this.load();
  }

  async remove(id: number): Promise<void> {
    const { error } = await this.provider.supabase.from('notes').delete().eq('id', id);

    if (error) {
      this.error.set(error.message);
      return;
    }

    await this.load();
  }
}
