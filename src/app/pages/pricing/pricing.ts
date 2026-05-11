import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface PlanCard {
  name: string;
  price: number;
  format: string;
  hasPdf: boolean;
  wallLabel?: string;
}

@Component({
  selector: 'app-pricing',
  imports: [CommonModule],
  templateUrl: './pricing.html',
  styleUrl: './pricing.scss',
})
export class Pricing {
  roofPlans: PlanCard[] = [
    { name: 'Roof ESX Only', price: 12, format: 'ESX File Format', hasPdf: false },
    { name: 'Roof ESX + PDF', price: 20, format: 'ESX File Format', hasPdf: true },
    { name: 'Roof XML Only', price: 12, format: 'XML File Format', hasPdf: false },
    { name: 'Roof XML + PDF', price: 20, format: 'XML File Format', hasPdf: true },
  ];

  wallPlans: PlanCard[] = [
    { name: 'Wall ESX Only (X1)', price: 36, format: 'ESX File Format', hasPdf: false, wallLabel: 'Single Wall (X1)' },
    { name: 'Wall ESX + PDF (X1)', price: 48, format: 'ESX File Format', hasPdf: true, wallLabel: 'Single Wall (X1)' },
    { name: 'Wall ESX Only (X2)', price: 36, format: 'ESX File Format', hasPdf: false, wallLabel: 'Single Wall (X2)' },
    { name: 'Wall ESX + PDF (X2)', price: 48, format: 'ESX File Format', hasPdf: true, wallLabel: 'Single Wall (X2)' },
  ];
}
