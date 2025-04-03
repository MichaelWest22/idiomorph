(function () {
  function createMorphConfig(swapStyle) {
    if (swapStyle.startsWith("morph")) {
      swapStyle = swapStyle.replaceAll(";", ":").slice(5);
      if (swapStyle === "") {
        return { morphStyle: "outerHTML" };
      } else if (swapStyle.startsWith(":")) {
        return swapStyle.slice(1);
      }
    } else if (
      htmx.config.morphByDefault === true &&
      swapStyle == "innerHTML"
    ) {
      return { morphStyle: "innerHTML" };
    }
  }
  let api;
  htmx.defineExtension("morph", {
    init: function (apiRef) {
      api = apiRef;
    },
    isInlineSwap: function (swapStyle) {
      let config = createMorphConfig(swapStyle);
      config = Idiomorph.getConfig(config);
      return config?.morphStyle !== "innerHTML";
    },
    handleSwap: function (swapStyle, target, fragment) {
      let config = createMorphConfig(swapStyle);
      if (config) {
        return Idiomorph.morph(target, fragment.children, config);
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

  Idiomorph.addConfig("outerHTML", { morphStyle: "outerHTML" });
  Idiomorph.addConfig("innerHTML", { morphStyle: "innerHTML" });
  Idiomorph.addConfig("ignoreActive", { ignoreActive: true });
  Idiomorph.addConfig("keepInputValues", { keepInputValues: true });
  Idiomorph.addConfig("attributes", { morphStyle: "attributes" });
  Idiomorph.addConfig("removeAttributes", {
    morphStyle: "attributes",
    callbacks: {
      beforeAttributeUpdated: (attributeName, node, mutationType) => {
        if (mutationType === "update") return false;
      },
    },
  });
  Idiomorph.addConfig("addAttributes", {
    morphStyle: "attributes",
    callbacks: {
      beforeAttributeUpdated: (attributeName, node, mutationType) => {
        if (mutationType === "remove") return false;
      },
    },
  });
})();
