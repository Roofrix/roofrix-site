import { Injectable } from '@angular/core';
import emailjs from '@emailjs/browser';

const EMAILJS_CONFIG = {
  serviceId: 'service_ukmbo8w',
  templateId: 'template_2g9gv38',
  publicKey: '3mVFH6dqA-9pzxCzl'
};

@Injectable({ providedIn: 'root' })
export class EmailNotificationService {

  sendNewOrderNotification(params: {
    orderNumber: string;
    customerName: string;
    customerEmail: string;
    totalPrice: number;
    itemCount: number;
    projectAddress: string;
  }): void {
    const templateParams = {
      order_number: params.orderNumber,
      customer_name: params.customerName,
      customer_email: params.customerEmail,
      total_price: params.totalPrice.toFixed(2),
      item_count: params.itemCount.toString(),
      project_address: params.projectAddress
    };

    emailjs.send(
      EMAILJS_CONFIG.serviceId,
      EMAILJS_CONFIG.templateId,
      templateParams,
      EMAILJS_CONFIG.publicKey
    ).then(
      () => console.log('[EMAIL] New order notification sent successfully'),
      (error) => console.error('[EMAIL] Failed to send order notification:', error)
    );
  }
}
