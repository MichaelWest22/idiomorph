(function () {
  function isInnerHTML(swapStyle) {
    if (swapStyle.startsWith("morph")) {
      swapStyle = swapStyle.replaceAll(";", ":").slice(5);
      if (swapStyle.startsWith(":innerHTML")) {
        return true;
      }
    } else if (
      htmx.config.morphByDefault === true &&
      swapStyle == "innerHTML"
    ) {
      return true;
    }
    return false;
  }

  let api;
  htmx.defineExtension("morph", {
    init: function (apiRef) {
      api = apiRef;
    },
    isInlineSwap: function (swapStyle) {
      return !isInnerHTML(swapStyle) && swapStyle.startsWith("morph");
    },
    handleSwap: function (swapStyle, target, fragment) {
      if (swapStyle.startsWith("morph") || htmx.config.morphByDefault) {
        return Idiomorph.morph(target, fragment.children, isInnerHTML(swapStyle));
      }
    },
    transformResponse: function (text, xhr, elt) {
      if (htmx.config.morphByDefault !== true) return text;
      return text
        .replace(/hx-swap-oob="(true|outerHTML)/gi, 'hx-swap-oob="morph')
        .replace(/hx-swap-oob='(true|outerHTML)/gi, "hx-swap-oob='morph");
    },
    onEvent: function (name, evt) {
      if (htmx.config.morphByDefault === true && name === "htmx:beforeSwap") {
        if (htmx.config.defaultSwapStyle === "outerHTML")
          htmx.config.defaultSwapStyle = "morph";
        let swapStyle =
          evt.detail.swapOverride ||
          api.getClosestAttributeValue(evt.detail.elt, "hx-swap");
        if (swapStyle && swapStyle.startsWith("outerHTML")) {
          evt.detail.swapOverride = swapStyle.replace(/outerHTML/, "morph");
        }
      }
    },
  });
})();
