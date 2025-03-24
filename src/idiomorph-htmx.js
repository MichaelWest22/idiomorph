(function () {
  function createMorphConfig(swapStyle) {
    if (swapStyle.startsWith("morph")) {
      swapStyle = swapStyle.replaceAll(";", ":").slice(5);
      if (swapStyle === "") {
        return { morphStyle: "outerHTML" };
      } else if (swapStyle.startsWith(":")) {
        return swapStyle.slice(1);
      }
    }
  }

  htmx.defineExtension("morph", {
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
  });

  Idiomorph.addConfig("outerHTML", { morphStyle: "outerHTML" });
  Idiomorph.addConfig("innerHTML", { morphStyle: "innerHTML" });
  Idiomorph.addConfig("ignoreActive", { ignoreActive: true });
  Idiomorph.addConfig("syncInputValue", { syncInputValue: true });
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
