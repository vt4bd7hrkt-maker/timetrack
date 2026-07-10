/** Tiny runes-based router — enough for a 5-tab PWA, no URL churn in standalone mode. */
export const route = $state({ name: 'home', params: {} });

export function go(name, params = {}) {
  route.name = name;
  route.params = params;
  if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
}
