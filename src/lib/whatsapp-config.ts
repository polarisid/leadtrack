import type { Client } from './types';

/**
 * Generates a WhatsApp link.
 * @param client The client object containing the contact number.
 * @param message An optional message to pre-fill.
 * @returns A fully formed https://wa.me link.
 */
export const generateWhatsappLink = (client: Client, message?: string): string => {
    // Clean the phone number, removing non-digit characters.
    let fullPhone = client.contact.replace(/\D/g, '');
    
    // If the number has 10 or 11 digits (local Brazilian format with area code), add Brazil's country code.
    if ((fullPhone.length === 10 || fullPhone.length === 11) && !fullPhone.startsWith('55')) {
       fullPhone = `55${fullPhone}`;
    }

    const baseUrl = `https://wa.me/${fullPhone}`;

    if (message) {
        return `${baseUrl}?text=${encodeURIComponent(message)}`;
    }

    return baseUrl;
};
