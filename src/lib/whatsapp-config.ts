import type { Client } from './types';

/**
 * Generates a WhatsApp link.
 * @param client The client object containing the contact number.
 * @returns A fully formed https://wa.me link.
 */
export const generateWhatsappLink = (client: Client): string => {
    // Clean the phone number, removing non-digit characters.
    let fullPhone = client.contact.replace(/\D/g, '');
    
    // If the number has 10 or 11 digits (local Brazilian format with area code), add Brazil's country code.
    if ((fullPhone.length === 10 || fullPhone.length === 11) && !fullPhone.startsWith('55')) {
       fullPhone = `55${fullPhone}`;
    }

    return `https://wa.me/${fullPhone}`;
};
