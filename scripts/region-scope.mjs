function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

const GLOBAL_SCOPE = /\b(?:global|worldwide|all regions|all customers|multiple regions|across regions)\b/i;
const US_NAMED_SCOPE = /\b(?:united states|u\.s\.|usa|north america|americas|us customers?|us cells?|us[- ](?:east|west|central|north|south)(?:[- ]\d+)?|us(?:e|w|c)\d+)\b/i;
const US_TOKEN = /(?:^|[\s(,:])US(?:$|[\s),:./-])/;
const US_STATE = new Set('AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC PR VI GU AS MP'.split(' '));

const NON_US_NAMED_SCOPE = /\b(?:emea|europe|european|united kingdom|apac|asia(?: pacific)?|australia|new zealand|canada|latin america|latam|middle east|africa|germany|france|spain|portugal|italy|poland|sweden|norway|finland|denmark|netherlands|belgium|switzerland|austria|ireland|greece|serbia|croatia|romania|bulgaria|czechia|czech republic|hungary|ukraine|japan|singapore|india|brazil|china|beijing|hong kong|korea|south korea|taiwan|thailand|malaysia|indonesia|philippines|vietnam|bangladesh|pakistan|sri lanka|kazakhstan|azerbaijan|jordan|ghana|chile|argentina|paraguay|uruguay|peru|colombia|ecuador|venezuela|mexico|costa rica|panama|dominican republic|jamaica|bahamas|barbados|trinidad|bahrain|manama|saudi arabia|qatar|oman|kuwait|iraq|israel|dubai|uae|united arab emirates|istanbul|türkiye|turkey|egypt|morocco|algeria|tunisia|kenya|nigeria|south africa|madagascar|london|amsterdam|berlin|tokyo|sydney|frankfurt|paris|madrid|milan|warsaw|stockholm|kochi|kuala lumpur|mumbai|hyderabad|delhi|almaty|baghdad|amman|accra|athens|arica|algiers|astara|asunción|annaba|belgrade|baku|antananarivo)\b/i;

const US_AWS_REGION = /\bus-(?:east|west)-\d+\b|\bus-gov-(?:east|west)-\d+\b|\bus-iso(?:b)?-(?:east|west)-\d+\b/i;
const NON_US_AWS_REGION = /\b(?:af|ap|ca|eu|me|sa)-(?:central|east|north|northeast|northwest|south|southeast|southwest|west)-\d+\b/i;
const US_GCP_REGION = /\bus-(?:central|east|west|south)\d+\b/i;
const NON_US_GCP_REGION = /\b(?:asia|australia|europe|northamerica-northeast|southamerica|me|africa)-[a-z0-9-]*\d\b/i;
const US_AZURE_REGION = /\b(?:azure[- _]?)?(?:centralus|eastus2?|westus2?|westus3|northcentralus|southcentralus|westcentralus)\b/i;
const NON_US_AZURE_REGION = /\bazure[- _]?(?:australia|brazil|canada|centralindia|eastasia|france|germany|japan|korea|northcentralindia|northeurope|norway|qatar|southafrica|southcentralindia|southeastasia|sweden|switzerland|uae|uksouth|ukwest|westeurope|westindia|poland|italy|israel|mexico|newzealand|spain|chile)[a-z0-9-]*\b/i;
const NON_US_VENDOR_CELL = /\b(?:aue|gbe|cae|de|eu|uk|ap|sg|jp)\d+(?:[-_a-z0-9]*)\b/i;

function popLocationScope(value) {
  const text = clean(value);
  const matches = [...text.matchAll(/,\s*([^,()]{2,60}?)(?:,\s*([^,()]{2,60}?))?\s*-\s*\([A-Z0-9]{3,4}\)/g)];
  for (const match of matches) {
    const parts = [match[1], match[2]].map(clean).filter(Boolean);
    if (parts.some(part => /^(?:united states|usa)$/i.test(part))) return 'us';
    const last = parts.at(-1) || '';
    if (/^[A-Z]{2}$/.test(last)) return US_STATE.has(last) ? 'us' : 'non-us';
    if (last) return 'non-us';
  }
  return '';
}

export function hasExplicitUsScope(value) {
  const text = clean(value);
  if (!text) return false;
  if (US_NAMED_SCOPE.test(text) || US_TOKEN.test(text) || US_AWS_REGION.test(text) || US_GCP_REGION.test(text) || US_AZURE_REGION.test(text)) return true;
  return popLocationScope(text) === 'us';
}

export function hasExplicitNonUsScope(value) {
  const text = clean(value);
  if (!text) return false;
  if (NON_US_NAMED_SCOPE.test(text) || NON_US_AWS_REGION.test(text) || NON_US_GCP_REGION.test(text) || NON_US_AZURE_REGION.test(text) || NON_US_VENDOR_CELL.test(text)) return true;
  return popLocationScope(text) === 'non-us';
}

export function regionScopeRelevant(title, details = '', scope = 'us') {
  if (scope === 'global') return true;
  const heading = clean(title);
  const body = clean(details).slice(0, 3000);

  if (GLOBAL_SCOPE.test(heading) || hasExplicitUsScope(heading)) return true;
  if (hasExplicitNonUsScope(heading)) return false;
  if (GLOBAL_SCOPE.test(body) || hasExplicitUsScope(body)) return true;
  return !hasExplicitNonUsScope(body);
}
