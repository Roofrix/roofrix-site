import { Injectable } from '@angular/core';
import emailjs from '@emailjs/browser';

const EMAILJS_CONFIG = {
  serviceId: 'service_ukmbo8w',
  templateId: 'template_2g9gv38',
  publicKey: '3mVFH6dqA-9pzxCzl'
};

const RUSH_EMAILJS_CONFIG = {
  serviceId: 'service_uh1tv2c',
  templateId: 'template_yl4ysyo',
  publicKey: 'gJWOdcpR4c4RIdCvj'
};

@Injectable({ providedIn: 'root' })
export class EmailNotificationService {

  async sendNewOrderNotification(params: {
    orderNumber: string;
    customerName: string;
    customerEmail: string;
    totalPrice: number;
    itemCount: number;
    projectAddress: string;
  }): Promise<{ success: boolean; error?: string }> {
    const templateParams = {
      order_number: params.orderNumber,
      customer_name: params.customerName,
      customer_email: params.customerEmail,
      total_price: params.totalPrice.toFixed(2),
      item_count: params.itemCount.toString(),
      project_address: params.projectAddress
    };

    try {
      await emailjs.send(
        EMAILJS_CONFIG.serviceId,
        EMAILJS_CONFIG.templateId,
        templateParams,
        EMAILJS_CONFIG.publicKey
      );
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error?.text || 'Failed to send notification email' };
    }
  }

  async sendRushOrderNotification(params: {
    orderNumber: string;
    customerName: string;
    reportType: string;
    itemCount: number;
    projectAddress: string;
  }): Promise<{ success: boolean; error?: string }> {
    const templateParams = {
      order_number: params.orderNumber,
      customer_name: params.customerName,
      report_type: params.reportType,
      item_count: params.itemCount.toString(),
      project_address: params.projectAddress
    };

    try {
      await emailjs.send(
        RUSH_EMAILJS_CONFIG.serviceId,
        RUSH_EMAILJS_CONFIG.templateId,
        templateParams,
        RUSH_EMAILJS_CONFIG.publicKey
      );
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error?.text || 'Failed to send rush notification email' };
    }
  }
}
