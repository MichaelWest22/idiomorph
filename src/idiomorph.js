var Idiomorph = (function () {
  ("use strict");

  const generatedByIdiomorph = new WeakSet();

  function morph(oldNode, newContent, innerHTML = false) {
    oldNode = oldNode instanceof Document ? oldNode.documentElement : oldNode;
    const newNode = normalizeParent(newContent);
    const { persistentIds, idMap } = createIdMaps(oldNode, newNode);
    const pantry = document.createElement("div");
    pantry.hidden = true;
    document.body.insertAdjacentElement("afterend", pantry);
    const ctx = {
      target: oldNode,
      newContent: newNode,
      idMap: idMap,
      persistentIds: persistentIds,
      pantry: pantry,
    };

    if (innerHTML) {
      morphChildren(ctx, oldNode, newNode);
      ctx.pantry.remove();
      return Array.from(oldNode.childNodes);
    } else {
      const oldParent = oldNode.parentNode;
      const beforeStartPoint = oldNode.previousSibling;
      const endPoint = oldNode.nextSibling;

      morphChildren(ctx, oldParent, newNode, oldNode, endPoint);

      const nodes = [];
      let cursor = beforeStartPoint?.nextSibling || oldParent.firstChild;
      while (cursor && cursor != endPoint) {
        nodes.push(cursor);
        cursor = cursor.nextSibling;
      }
      ctx.pantry.remove();
      return nodes;
    }
  }

  function morphChildren(
    ctx,
    oldParent,
    newParent,
    insertionPoint = null,
    endPoint = null,
  ) {
    if (
      oldParent instanceof HTMLTemplateElement &&
      newParent instanceof HTMLTemplateElement
    ) {
      oldParent = oldParent.content;
      newParent = newParent.content;
    }
    insertionPoint ||= oldParent.firstChild;

    for (const newChild of newParent.childNodes) {
      if (insertionPoint && insertionPoint != endPoint) {
        const bestMatch = findBestMatch(
          ctx,
          newChild,
          insertionPoint,
          endPoint,
        );
        if (bestMatch) {
          if (bestMatch !== insertionPoint) {
            let cursor = insertionPoint;
            while (cursor && cursor !== bestMatch) {
              let tempNode = cursor;
              cursor = cursor.nextSibling;
              removeNode(ctx, tempNode);
            }
          }
          morphNode(bestMatch, newChild, ctx);
          insertionPoint = bestMatch.nextSibling;
          continue;
        }
      }

      if (newChild instanceof Element && ctx.persistentIds.has(newChild.id)) {
        const target =
          (ctx.target.id === newChild.id && ctx.target) ||
          ctx.target.querySelector(`[id="${newChild.id}"]`) ||
          ctx.pantry.querySelector(`[id="${newChild.id}"]`);
        const elementId = target.id;
        let element = target;
        while ((element = element.parentNode)) {
          let idSet = ctx.idMap.get(element);
          if (idSet) {
            idSet.delete(elementId);
            if (!idSet.size) {
              ctx.idMap.delete(element);
            }
          }
        }
        moveBefore(oldParent, target, insertionPoint);
        morphNode(target, newChild, ctx);
        insertionPoint = target.nextSibling;
        continue;
      }

      let insertedNode;
      if (ctx.idMap.has(newChild)) {
        const newEmptyChild = document.createElement(newChild.tagName);
        oldParent.insertBefore(newEmptyChild, insertionPoint);
        morphNode(newEmptyChild, newChild, ctx);
        insertedNode = newEmptyChild;
      } else {
        const newClonedChild = document.importNode(newChild, true);
        oldParent.insertBefore(newClonedChild, insertionPoint);
        insertedNode = newClonedChild;
      }
      if (insertedNode) {
        insertionPoint = insertedNode.nextSibling;
      }
    }

    while (insertionPoint && insertionPoint != endPoint) {
      const tempNode = insertionPoint;
      insertionPoint = insertionPoint.nextSibling;
      removeNode(ctx, tempNode);
    }
  }

  function findBestMatch(ctx, node, startPoint, endPoint) {
    let softMatch = null;
    let nextSibling = node.nextSibling;
    let siblingSoftMatchCount = 0;
    let displaceMatchCount = 0;

    const nodeMatchCount = ctx.idMap.get(node)?.size || 0;

    let cursor = startPoint;
    while (cursor && cursor != endPoint) {
      if (isSoftMatch(cursor, node)) {
        if (isIdSetMatch(ctx, cursor, node)) {
          return cursor;
        }

        if (softMatch === null) {
          if (!ctx.idMap.has(cursor)) {
            if (!nodeMatchCount) {
              return cursor;
            } else {
              softMatch = cursor;
            }
          }
        }
      }
      displaceMatchCount += ctx.idMap.get(cursor)?.size || 0;
      if (displaceMatchCount > nodeMatchCount) {
        break;
      }

      if (
        softMatch === null &&
        nextSibling &&
        isSoftMatch(cursor, nextSibling)
      ) {
        siblingSoftMatchCount++;
        nextSibling = nextSibling.nextSibling;

        if (siblingSoftMatchCount >= 2) {
          softMatch = undefined;
        }
      }

      if (cursor.contains(document.activeElement)) break;

      cursor = cursor.nextSibling;
    }

    return softMatch || null;
  }

  function isIdSetMatch(ctx, oldNode, newNode) {
    let oldSet = ctx.idMap.get(oldNode);
    let newSet = ctx.idMap.get(newNode);

    if (!newSet || !oldSet) return false;

    for (const id of oldSet) {
      if (newSet.has(id)) {
        return true;
      }
    }
    return false;
  }

  function isSoftMatch(oldNode, newNode) {
    const oldElt = oldNode;
    const newElt = newNode;

    return (
      oldElt.nodeType === newElt.nodeType &&
      oldElt.tagName === newElt.tagName &&
      (!oldElt.id || oldElt.id === newElt.id)
    );
  }

  function removeNode(ctx, node) {
    if (ctx.idMap.has(node)) {
      moveBefore(ctx.pantry, node, null);
    } else {
      node.parentNode?.removeChild(node);
    }
  }

  function moveBefore(parentNode, element, after) {
    if (parentNode.moveBefore) {
      try {
        parentNode.moveBefore(element, after);
      } catch (e) {
        parentNode.insertBefore(element, after);
      }
    } else {
      parentNode.insertBefore(element, after);
    }
  }

  function morphNode(oldNode, newContent, ctx) {
    morphAttributes(oldNode, newContent, ctx);
    if (oldNode.innerHTML !== newContent.innerHTML) {
      morphChildren(ctx, oldNode, newContent);
    }
    return oldNode;
  }

  function morphAttributes(oldNode, newNode, ctx) {
    let type = newNode.nodeType;

    if (type === 1) {
      const oldElt = oldNode;
      const newElt = newNode;

      const oldAttributes = oldElt.attributes;
      const newAttributes = newElt.attributes;
      for (const newAttribute of newAttributes) {
        if (oldElt.getAttribute(newAttribute.name) !== newAttribute.value) {
          oldElt.setAttribute(newAttribute.name, newAttribute.value);
        }
      }
      for (let i = oldAttributes.length - 1; 0 <= i; i--) {
        const oldAttribute = oldAttributes[i];

        if (!oldAttribute) continue;

        if (!newElt.hasAttribute(oldAttribute.name)) {
          oldElt.removeAttribute(oldAttribute.name);
        }
      }

      if (
        oldElt instanceof HTMLTextAreaElement &&
        newElt instanceof HTMLTextAreaElement &&
        oldElt.defaultValue != newElt.defaultValue
      ) {
        oldElt.value = newElt.value;
      }
    }

    if (type === 8 || type === 3) {
      if (oldNode.nodeValue !== newNode.nodeValue) {
        oldNode.nodeValue = newNode.nodeValue;
      }
    }
  }

  function populateIdMapWithTree(idMap, persistentIds, root, elements) {
    for (const elt of elements) {
      if (persistentIds.has(elt.id)) {
        let current = elt;
        while (current && current !== root) {
          let idSet = idMap.get(current);
          if (idSet == null) {
            idSet = new Set();
            idMap.set(current, idSet);
          }
          idSet.add(elt.id);
          current = current.parentElement;
        }
      }
    }
  }

  function createIdMaps(oldNode, newContent) {
    let oldIdElements = Array.from(oldNode.querySelectorAll("[id]"));
    if (oldNode.id) {
      oldIdElements.push(oldNode);
    }
    const newIdElements = newContent.querySelectorAll("[id]");

    const persistentIds = createPersistentIds(oldIdElements, newIdElements);

    let idMap = new Map();
    populateIdMapWithTree(
      idMap,
      persistentIds,
      oldNode.parentElement,
      oldIdElements,
    );
    populateIdMapWithTree(idMap, persistentIds, newContent, newIdElements);

    return { persistentIds, idMap };
  }

  function createPersistentIds(oldIdElements, newIdElements) {
    let duplicateIds = new Set();

    let oldIdTagNameMap = new Map();
    for (const { id, tagName } of oldIdElements) {
      if (oldIdTagNameMap.has(id)) {
        duplicateIds.add(id);
      } else {
        oldIdTagNameMap.set(id, tagName);
      }
    }

    let persistentIds = new Set();
    for (const { id, tagName } of newIdElements) {
      if (persistentIds.has(id)) {
        duplicateIds.add(id);
      } else if (oldIdTagNameMap.get(id) === tagName) {
        persistentIds.add(id);
      }
    }

    for (const id of duplicateIds) {
      persistentIds.delete(id);
    }
    return persistentIds;
  }

  function normalizeParent(newContent) {
    if (newContent == null) {
      return document.createElement("div");
    } else if (typeof newContent === "string") {
      let parser = new DOMParser();
      let responseDoc = parser.parseFromString(
        "<body><template>" + newContent + "</template></body>",
        "text/html",
      );
      let content = responseDoc.body.querySelector("template").content;
      generatedByIdiomorph.add(content);
      return normalizeParent(content);
    } else if (generatedByIdiomorph.has(newContent)) {
      return newContent;
    } else if (newContent instanceof Node) {
      const dummyParent = document.createElement("div");
      dummyParent.append(newContent);
      return dummyParent;
    } else {
      const dummyParent = document.createElement("div");
      for (const elt of [...newContent]) {
        dummyParent.append(elt);
      }
      return dummyParent;
    }
  }

  return {
    morph,
  };
})();
