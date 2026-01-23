import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import emailjs from '@emailjs/browser';

// EmailJS Configuration - Replace with your actual values from EmailJS dashboard
const EMAILJS_CONFIG = {
  serviceId: 'YOUR_SERVICE_ID',      // e.g., 'service_abc123'
  templateId: 'YOUR_TEMPLATE_ID',    // e.g., 'template_xyz789'
  publicKey: 'YOUR_PUBLIC_KEY'       // e.g., 'AbCdEfGhIjKlMnOp'
};

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './contact.html',
  styleUrl: './contact.scss',
})
export class Contact {
  private fb = inject(FormBuilder);

  contactForm: FormGroup;
  loading = false;
  submitted = false;
  errorMessage = '';

  constructor() {
    this.contactForm = this.fb.group({
      name: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      message: ['', [Validators.required, Validators.minLength(10)]]
    });
  }

  onSubmit(): void {
    if (this.contactForm.invalid) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    const templateParams = {
      from_name: this.contactForm.value.name,
      from_email: this.contactForm.value.email,
      message: this.contactForm.value.message,
      to_name: 'Roofrix Team'
    };

    emailjs.send(
      EMAILJS_CONFIG.serviceId,
      EMAILJS_CONFIG.templateId,
      templateParams,
      EMAILJS_CONFIG.publicKey
    )
    .then(() => {
      this.loading = false;
      this.submitted = true;
      this.contactForm.reset();
    })
    .catch((error) => {
      console.error('EmailJS Error:', error);
      this.loading = false;
      this.errorMessage = 'Failed to send message. Please try again later.';
    });
  }
}
