// Partial-reveal masking for contact info on the public site-search page.
// Full values are never sent to the client for the free view — masking
// happens server-side, in the controller, before the response is built.

// "test@gmail.com" -> "t***@g***.com"
export function maskEmail(email) {
    const [local, domain] = email.split('@');

    if (!domain) return email; // malformed, nothing sensible to mask

    const maskedLocal = `${local[0] || ''}***`;

    const domainParts = domain.split('.');
    const firstLabel = domainParts[0] || '';
    const maskedFirstLabel = `${firstLabel[0] || ''}***`;
    const rest = domainParts.slice(1).join('.');
    const maskedDomain = rest ? `${maskedFirstLabel}.${rest}` : maskedFirstLabel;

    return `${maskedLocal}@${maskedDomain}`;
}

// "07123456789" -> "07*** *** ***" (first 2 digits visible, rest in groups of 3 asterisks)
export function maskPhoneNumber(raw) {
    const hasPlus = raw.trim().startsWith('+');
    const digits = raw.replace(/\D/g, '');

    if (digits.length <= 2) return raw; // nothing meaningful to mask

    const visible = digits.slice(0, 2);
    const rest = digits.slice(2);

    const groups = [];
    for (let i = 0; i < rest.length; i += 3) {
        groups.push('*'.repeat(Math.min(3, rest.length - i)));
    }

    return `${hasPlus ? '+' : ''}${visible}${groups.join(' ')}`;
}
