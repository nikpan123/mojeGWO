(() => {
  const prefix='/'+document.body.dataset.environment;
  window.mojeGwoURL=url=>typeof url==='string'&&/^\/(api|report)\//.test(url)?prefix+url:url;
  const originalFetch=window.fetch.bind(window);
  window.fetch=(input,options)=>originalFetch(window.mojeGwoURL(input),options);
})();
