// BIN lookup with embedded data + optional online fallback
const BIN_DB = {
  '4': { brands: ['Visa'], prefix: '4' },
  '51': { brands: ['Mastercard'], prefix: '51' },
  '52': { brands: ['Mastercard'], prefix: '52' },
  '53': { brands: ['Mastercard'], prefix: '53' },
  '54': { brands: ['Mastercard'], prefix: '54' },
  '55': { brands: ['Mastercard'], prefix: '55' },
  '34': { brands: ['Amex'], prefix: '34' },
  '37': { brands: ['Amex'], prefix: '37' },
  '6011': { brands: ['Discover'], prefix: '6011' },
  '65': { brands: ['Discover'], prefix: '65' },
  // Country by BIN range (simplified)
  '40': { country: 'US' },
  '41': { country: 'US' },
  '42': { country: 'US' },
  '43': { country: 'US' },
  '44': { country: 'US' },
  '45': { country: 'US' },
  '46': { country: 'US' },
  '47': { country: 'US' },
  '48': { country: 'US' },
  '49': { country: 'US' },
  '5247': { country: 'MX' },
  '5248': { country: 'MX' },
  '5249': { country: 'MX' },
  '4031': { country: 'MX' },
  '4023': { country: 'MX' },
  '4045': { country: 'MX' },
  '4336': { country: 'MX' },
  '4393': { country: 'MX' },
  '4643': { country: 'MX' },
  '4098': { country: 'MX' },
  '4099': { country: 'MX' },
  '4550': { country: 'IT' },
  '4556': { country: 'IT' },
  '4557': { country: 'IT' },
  '4580': { country: 'IT' },
  '4587': { country: 'IT' },
  '4970': { country: 'IT' },
  '4974': { country: 'IT' },
  '5300': { country: 'FR' },
  '5301': { country: 'FR' },
  '5302': { country: 'FR' },
  '5306': { country: 'FR' },
  '5309': { country: 'FR' },
  '5200': { country: 'FR' },
  '4403': { country: 'FR' },
  '4404': { country: 'FR' },
  '5324': { country: 'FR' },
  '5335': { country: 'SG' },
  '5337': { country: 'SG' },
  '5338': { country: 'SG' },
  '5339': { country: 'SG' },
  '5340': { country: 'SG' },
  '4766': { country: 'SG' },
  '4767': { country: 'SG' },
  '4888': { country: 'SG' },
  '5289': { country: 'SG' },
  '5307': { country: 'SG' },
  '5310': { country: 'SG' },
  '5312': { country: 'SG' },
  '5313': { country: 'SG' },
};

function lookupBIN(cardNumber) {
  const bin6 = cardNumber.slice(0, 6);
  const bin4 = cardNumber.slice(0, 4);
  const bin2 = cardNumber.slice(0, 2);

  let brand = 'Unknown';
  let country = 'Unknown';

  // Brand
  if (BIN_DB[bin4]) brand = BIN_DB[bin4].brands[0];
  else if (BIN_DB[bin2]) brand = BIN_DB[bin2].brands[0];
  else if (cardNumber.startsWith('4')) brand = 'Visa';
  else if (cardNumber.startsWith('5')) brand = 'Mastercard';
  else if (cardNumber.startsWith('3')) brand = 'Amex';
  else if (cardNumber.startsWith('6')) brand = 'Discover';

  // Country
  if (BIN_DB[bin6]) country = BIN_DB[bin6].country;
  else if (BIN_DB[bin4]) country = BIN_DB[bin4].country;
  else if (BIN_DB[bin2]) country = BIN_DB[bin2].country;

  // Check if it's an Amazon Pay BIN (known Amazon-issued)
  const amazonBINS = ['521105', '424023', '521106', '424024', '536476', '424025'];
  const isAmazonIssued = amazonBINS.includes(bin6);

  return { bin: bin6, brand, country, isAmazonIssued };
}

module.exports = { lookupBIN };