import { Component, booleanAttribute, input, numberAttribute } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { LTextGroup } from './forms';
import { TPipe } from '../../content/i18n';

/**
 * One field in both languages, side by side: English | ქართული.
 * <app-ltext-field label="Title" [group]="form.controls.title" required />
 */
@Component({
  selector: 'app-ltext-field',
  imports: [ReactiveFormsModule, TPipe],
  template: `
    <fieldset class="ltext" [formGroup]="group()">
      <legend>
        {{ label() | t }}
        @if (required()) {
          <span class="req" aria-hidden="true">*</span>
        }
      </legend>
      <label>
        <span class="lang">{{ 'EN' | t }}</span>
        @if (multiline()) {
          <textarea
            formControlName="en"
            [rows]="rows()"
            [attr.aria-label]="'{label} (English)' | t: { label: label() | t }"
          ></textarea>
        } @else {
          <input
            type="text"
            formControlName="en"
            [attr.aria-label]="'{label} (English)' | t: { label: label() | t }"
          />
        }
      </label>
      <label>
        <span class="lang">{{ 'KA' | t }}</span>
        @if (multiline()) {
          <textarea
            formControlName="ka"
            [rows]="rows()"
            lang="ka"
            [attr.aria-label]="'{label} (Georgian)' | t: { label: label() | t }"
          ></textarea>
        } @else {
          <input
            type="text"
            formControlName="ka"
            lang="ka"
            [attr.aria-label]="'{label} (Georgian)' | t: { label: label() | t }"
          />
        }
      </label>
      @if (group().controls.en.invalid && group().controls.en.touched) {
        <span class="error">{{ 'Enter the English text.' | t }}</span>
      }
      @if (hint()) {
        <span class="hint">{{ hint() | t }}</span>
      }
    </fieldset>
  `,
})
export class LTextField {
  readonly label = input.required<string>();
  readonly group = input.required<LTextGroup>();
  readonly multiline = input(false, { transform: booleanAttribute });
  readonly rows = input(3, { transform: numberAttribute });
  readonly required = input(false, { transform: booleanAttribute });
  readonly hint = input('');
}
