// Live vs demo mode.
// Live (the deployed site): real catalogue from the API, no simulated readings or sample packs.
// Demo (Claude artifact, a local file, or any URL with ?demo): bundled sample + real data,
// sample packs and simulated readings for presenting every safety state.
export const DEMO: boolean = (() => {
  try {
    if (typeof location === "undefined") return true;
    if (!/^https?:$/.test(location.protocol) || (window as any).claude) return true;
    return new URLSearchParams(location.search).has("demo");
  } catch {
    return true;
  }
})();
