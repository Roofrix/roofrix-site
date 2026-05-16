import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface PlanCard {
  name: string;
  price: number;
  features: string[];
  hasPdf: boolean;
  popular?: boolean;
}

@Component({
  selector: 'app-pricing',
  imports: [CommonModule],
  templateUrl: './pricing.html',
  styleUrl: './pricing.scss',
})
export class Pricing {
  roofPlans: PlanCard[] = [
    { name: 'Roof ESX Only', price: 12, hasPdf: false, features: ['Xactimate ESX File', 'Accurate roof measurements', 'Estimating ready'] },
    { name: 'Roof ESX + PDF', price: 20, hasPdf: true, popular: true, features: ['Xactimate ESX File', 'PDF Report Included', 'Ready for claim estimating'] },
    { name: 'Roof XML Only', price: 12, hasPdf: false, features: ['XML File Format', 'Accurate roof measurements', 'Workflow compatible'] },
    { name: 'Roof XML + PDF', price: 20, hasPdf: true, features: ['XML File Format', 'PDF Report Included', 'Insurance ready reports'] },
  ];

  wallPlans: PlanCard[] = [
    { name: 'Wall ESX Only - X1', price: 36, hasPdf: false, popular: true, features: ['Created in Xactimate Exterior Tab', 'Includes Roof & Wall Model', 'Xactimate ESX File', 'Accurate wall measurements'] },
    { name: 'Wall ESX + PDF (X1)', price: 48, hasPdf: true, features: ['Created in Xactimate Exterior Tab', 'Detailed PDF Report of Each Wall', 'Accurate wall measurements'] },
    { name: 'Wall ESX Only (X2)', price: 36, hasPdf: false, features: ['Created using Xactimate Room Tool', 'Xactimate ESX File', 'Accurate wall measurements'] },
    { name: 'Wall ESX + PDF (X2)', price: 48, hasPdf: true, features: ['Created using Xactimate Room Tool', 'Detailed PDF Report of Each Wall', 'Accurate wall measurements'] },
  ];
}
