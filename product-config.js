// Zentrale Produkt-Konfiguration für Solar-Tool
// Alle Berechnungsmethoden greifen auf diese Konfiguration zu

// Verpackungseinheiten (VE) - Anzahl pro Packung
export const VE = {
  Endklemmen: 100,
  Schrauben: 100,
  Dachhaken: 20,
  Mittelklemmen: 100,
  Endkappen: 50,
  Schienenverbinder: 50,
  Schiene_240_cm: 8,
  Schiene_360_cm: 8,
  Solarmodul: 1,
  MC4_Stecker: 1,
  Solarkabel: 1,
  Holzunterleger: 50  // NEU: VE von 50 statt 1
};

// Produktpreise
export const PRICE_MAP = {
  Solarmodul: 59.00,
  Endklemmen: 20.00,
  Schrauben: 5.00,
  Dachhaken: 15.00,
  Mittelklemmen: 18.00,
  Endkappen: 9.99,
  Schienenverbinder: 9.99,
  Schiene_240_cm: 8.99,
  Schiene_360_cm: 40.00,
  MC4_Stecker: 99.00,
  Solarkabel: 29.99,
  Holzunterleger: 0.50
};

// Webflow Produkt-IDs
export const PRODUCT_MAP = {
  Solarmodul: { productId:'685003af0e41d945fb0198d8', variantId:'685003af4a8e88cb58c89d46' },
  Endklemmen: { productId:'6853c34fe99f6e3d878db38b', variantId:'6853c350edab8f13fc18c1b9' },
  Schrauben: { productId:'6853c2782b14f4486dd26f52', variantId:'6853c2798bf6755ddde26a8e' },
  Dachhaken: { productId:'6853c1d0f350bf620389664c', variantId:'6853c1d04d7c01769211b8d6' },
  Mittelklemmen: { productId:'68531088654d1468dca962c', variantId:'6853c1084c04541622ba3e26' },
  Endkappen: { productId:'6853be0895a5a578324f9682', variantId:'6853be0805e96b5a16c705cd' },
  Schienenverbinder: { productId:'6853c2018bf6755ddde216a8', variantId:'6853c202c488ee61eb51a3dc' },
  Schiene_240_cm: { productId:'6853bd882f00db0c9a42d653', variantId:'6853bd88c4173dbe72bab10f' },
  Schiene_360_cm: { productId:'6853bc8f3f6abf360c605142', variantId:'6853bc902f00db0c9a423d97' },
  MC4_Stecker: { productId:'687fcc9f66078f7098826ccc', variantId:'687fcca02c6537b9a9493fa7' },
  Solarkabel: { productId:'687fd60dc599f5e95d783f99', variantId:'687fd60dd3a8ae1f00a6d6d1' },
  Holzunterleger: { productId:'xxx-holz', variantId:'xxx-holz-v' }
};

// Produktnamen-Mapping (alte Namen → neue Namen)
export const PRODUCT_NAME_MAP = {
  'Solarmodul': 'Ulica Solar Black Jade-Flow 450 W',
  'Schrauben': 'M10x25-Schraube',
  'Solarkabel': 'Solarkabel 100M',
  'Holzunterleger': 'Unterlegholz für Dachhaken'
};

// Produktbilder
export const PRODUCT_IMAGES = {
  Solarmodul: 'https://cdn.prod.website-files.com/68498852db79a6c114f111ef/6859af7eeb0350c3aa298572_Solar%20Panel.png',
  Endklemmen: 'https://cdn.prod.website-files.com/684989b78146a1d9194e7b47/6853c316b21cb7d04ba2ed22_DSC04815-min.jpg',
  Schrauben: 'https://cdn.prod.website-files.com/684989b78146a1d9194e7b47/6853c2704f5147533229ccde_DSC04796-min.jpg',
  Dachhaken: 'https://cdn.prod.website-files.com/684989b78146a1d9194e7b47/6853c1c8a2835b7879f46811_DSC04760-min.jpg',
  Mittelklemmen: 'https://cdn.prod.website-files.com/684989b78146a1d9194e7b47/6853c0d0c2d922d926976bd4_DSC04810-min.jpg',
  Endkappen: 'https://cdn.prod.website-files.com/684989b78146a1d9194e7b47/6853bdfbe7cffc653f6a4605_DSC04788-min.jpg',
  Schienenverbinder: 'https://cdn.prod.website-files.com/684989b78146a1d9194e7b47/6853c21f0c39e927fce0db3b_DSC04780-min.jpg',
  Schiene_240_cm: 'https://cdn.prod.website-files.com/684989b78146a1d9194e7b47/6853bce018164af4b4a187f1_DSC04825-min.jpg',
  Schiene_360_cm: 'https://cdn.prod.website-files.com/684989b78146a1d9194e7b47/6853bcd5726d1d33d4b86ba4_DSC04824-min.jpg',
  MC4_Stecker: 'https://cdn.prod.website-files.com/684989b78146a1d9194e7b47/687fcdab153f840ea15b5e7b_iStock-2186771695.jpg',
  Solarkabel: 'https://cdn.prod.website-files.com/684989b78146a1d9194e7b47/687fd566bdbb6de2e5f362f0_DSC04851.jpg',
  Holzunterleger: 'https://cdn.prod.website-files.com/68498852db79a6c114f111ef/6859af7eeb0350c3aa298572_Solar%20Panel.png'
};

// Hilfsfunktionen
export function getProductName(productKey) {
  return PRODUCT_NAME_MAP[productKey] || productKey;
}

export function getVE(productKey) {
  return VE[productKey] || 1;
}

export function getPrice(productKey) {
  return PRICE_MAP[productKey] || 0;
}

export function getProductInfo(productKey) {
  return PRODUCT_MAP[productKey] || null;
}

export function getProductImage(productKey) {
  return PRODUCT_IMAGES[productKey] || '';
}

// Berechne Packungen basierend auf Menge und VE
export function calculatePacks(quantity, productKey) {
  const ve = getVE(productKey);
  return Math.ceil(quantity / ve);
}

// Berechne Gesamtpreis für ein Produkt
export function calculateProductTotal(quantity, productKey) {
  const price = getPrice(productKey);
  const packs = calculatePacks(quantity, productKey);
  return packs * price;
} 