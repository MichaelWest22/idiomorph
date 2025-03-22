(function () {
  function createMorphConfig(swapStyle) {
    if (swapStyle.startsWith("morph")) {
      swapStyle = swapStyle.replaceAll(";", ":").slice(5);
      if (swapStyle === "" || swapStyle === ":outerHTML") {
        return { morphStyle: "outerHTML" };
      } else if (swapStyle === ":innerHTML") {
        return { morphStyle: "innerHTML" };
      } else if (swapStyle === ":attributes") {
        return { morphStyle: "attributes" };
      } else if (swapStyle === ":removeAttributes") {
        return {
          morphStyle: "attributes",
          callbacks: {
            beforeAttributeUpdated: (attributeName, node, mutationType) => {
              if (mutationType === "update") return false;
            },
          },
        };
      } else if (swapStyle === ":addAttributes") {
        return {
          morphStyle: "attributes",
          callbacks: {
            beforeAttributeUpdated: (attributeName, node, mutationType) => {
              if (mutationType === "remove") return false;
            },
          },
        };
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
})();
