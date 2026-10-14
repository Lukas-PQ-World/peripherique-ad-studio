// Pläne, Add-ons und Rechte – identisch zu ad-studio-api.js halten.
export const INF = 1e9;
export const PLANS = {
  free: { label: 'Free', price: 0, projects: 1, seats: 1, ki: 20, publish: false, analytics: false, approval: false, whitelabel: false, exports: ['mp4', 'jpg'], watermark: true },
  starter: { label: 'Starter', price: 29, projects: 5, seats: 3, ki: 200, publish: true, analytics: true, approval: false, whitelabel: false, exports: ['mp4', 'jpg', 'gif'], watermark: false },
  pro: { label: 'Pro', price: 79, projects: INF, seats: 10, ki: 1000, publish: true, analytics: true, approval: true, whitelabel: false, exports: ['mp4', 'mov', 'webm', 'gif', 'jpg'], watermark: false },
  agency: { label: 'Agency', price: 199, projects: INF, seats: 30, ki: 5000, publish: true, analytics: true, approval: true, whitelabel: true, exports: ['mp4', 'mov', 'webm', 'gif', 'jpg'], watermark: false },
};
export const ADDONS = { ki500: { label: '+500 KI-Aktionen', price: 9, mode: 'payment' }, seat: { label: '+1 Team-Platz', price: 9, mode: 'subscription' }, whitelabel: { label: 'White-Label', price: 49, mode: 'subscription', minPlan: 'pro' } };
export const ROLES = ['owner', 'admin', 'editor', 'reviewer', 'viewer'];
export const PERMS = {
  billing: ['owner'], team: ['owner', 'admin'], integrations: ['owner', 'admin'], publish: ['owner', 'admin'],
  'project.create': ['owner', 'admin', 'editor'], 'project.delete': ['owner', 'admin'], 'ad.edit': ['owner', 'admin', 'editor'], 'ad.approve': ['owner', 'admin', 'reviewer'],
};
export const TRIAL_DAYS = 14;
export const can = (u, perm) => !!u && (!!u.superadmin || (PERMS[perm] || []).includes(u.role));
export const effPlan = o => (o.trial_ends && !o.paid && Date.now() > o.trial_ends) ? 'free' : (o.plan || 'free');
export function limitsOf(o) {
  const P = PLANS[effPlan(o)] || PLANS.free, ad = JSON.parse(o.addons || '{}');
  return { ...P, plan: effPlan(o), seats: P.seats + (ad.seat || 0), ki: P.ki + 500 * (ad.ki500 || 0), whitelabel: P.whitelabel || !!ad.whitelabel };
}
// Stripe-Preis-IDs aus der .env, z. B. STRIPE_PRICE_PRO_MONTHLY=price_…
export const priceId = (key, cycle) => process.env[`STRIPE_PRICE_${key.toUpperCase()}${cycle ? '_' + cycle.toUpperCase() : ''}`];
