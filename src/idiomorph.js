/**
 * @typedef {object} ConfigHead
 *
 * @property {'merge' | 'append' | 'morph' | 'none'} [style]
 * @property {boolean} [block]
 * @property {boolean} [ignore]
 * @property {function(Element): boolean} [shouldPreserve]
 * @property {function(Element): boolean} [shouldReAppend]
 * @property {function(Element): boolean} [shouldRemove]
 * @property {function(Element, {added: Node[], kept: Element[], removed: Element[]}): void} [afterHeadMorphed]
 */

/**
 * @typedef {object} ConfigCallbacks
 *
 * @property {function(Node): boolean} [beforeNodeAdded]
 * @property {function(Node): void} [afterNodeAdded]
 * @property {function(Element, Node): boolean} [beforeNodeMorphed]
 * @property {function(Element, Node): void} [afterNodeMorphed]
 * @property {function(Element): boolean} [beforeNodeRemoved]
 * @property {function(Element): void} [afterNodeRemoved]
 * @property {function(string, Element, "update" | "remove"): boolean} [beforeAttributeUpdated]
 */

/**
 * @typedef {object} Config
 *
 * @property {'outerHTML' | 'innerHTML'} [morphStyle]
 * @property {boolean} [ignoreActive]
 * @property {boolean} [ignoreActiveValue]
 * @property {ConfigCallbacks} [callbacks]
 * @property {ConfigHead} [head]
 */

/**
 * @typedef {function} NoOp
 *
 * @returns {void}
 */

/**
 * @typedef {object} ConfigHeadInternal
 *
 * @property {'merge' | 'append' | 'morph' | 'none'} style
 * @property {boolean} [block]
 * @property {boolean} [ignore]
 * @property {(function(Element): boolean) | NoOp} shouldPreserve
 * @property {(function(Element): boolean) | NoOp} shouldReAppend
 * @property {(function(Element): boolean) | NoOp} shouldRemove
 * @property {(function(Element, {added: Node[], kept: Element[], removed: Element[]}): void) | NoOp} afterHeadMorphed
 */

/**
 * @typedef {object} ConfigCallbacksInternal
 *
 * @property {(function(Node): boolean) | NoOp} beforeNodeAdded
 * @property {(function(Node): void) | NoOp} afterNodeAdded
 * @property {(function(Node, Node): boolean) | NoOp} beforeNodeMorphed
 * @property {(function(Node, Node): void) | NoOp} afterNodeMorphed
 * @property {(function(Node): boolean) | NoOp} beforeNodeRemoved
 * @property {(function(Node): void) | NoOp} afterNodeRemoved
 * @property {(function(string, Element, "update" | "remove"): boolean) | NoOp} beforeAttributeUpdated
 */

/**
 * @typedef {object} ConfigInternal
 *
 * @property {'outerHTML' | 'innerHTML'} morphStyle
 * @property {boolean} [ignoreActive]
 * @property {boolean} [ignoreActiveValue]
 * @property {ConfigCallbacksInternal} callbacks
 * @property {ConfigHeadInternal} head
 */

/**
 * @typedef {Object} IdSets
 * @property {Set<string>} persistentIds
 * @property {Map<Node, Set<string>>} idMap
 */

/**
 * @typedef {Function} Morph
 *
 * @param {Element | Document} oldNode
 * @param {Element | Node | HTMLCollection | Node[] | string | null} newContent
 * @param {Config} [config]
 * @returns {undefined | Node[]}
 */

// base IIFE to define idiomorph
/**
 *
 * @type {{defaults: ConfigInternal, morph: Morph}}
 */
var Idiomorph = (function () {
  "use strict";

  /**
   * @typedef {object} MorphContext
   *
   * @property {Element} target
   * @property {Element} newContent
   * @property {ConfigInternal} config
   * @property {ConfigInternal['morphStyle']} morphStyle
   * @property {ConfigInternal['ignoreActive']} ignoreActive
   * @property {ConfigInternal['ignoreActiveValue']} ignoreActiveValue
   * @property {Map<Node, Set<string>>} idMap
   * @property {Set<string>} persistentIds
   * @property {ConfigInternal['callbacks']} callbacks
   * @property {ConfigInternal['head']} head
   * @property {HTMLDivElement} pantry
   */

  //=============================================================================
  // AND NOW IT BEGINS...
  //=============================================================================

  const noOp = () => {};
  /**
   * Default configuration values, updatable by users now
   * @type {ConfigInternal}
   */
  const defaults = {
    morphStyle: "outerHTML",
    callbacks: {
      beforeNodeAdded: noOp,
      afterNodeAdded: noOp,
      beforeNodeMorphed: noOp,
      afterNodeMorphed: noOp,
      beforeNodeRemoved: noOp,
      afterNodeRemoved: noOp,
      beforeAttributeUpdated: noOp,
    },
    head: {
      style: "merge",
      shouldPreserve: (elt) => elt.getAttribute("im-preserve") === "true",
      shouldReAppend: (elt) => elt.getAttribute("im-re-append") === "true",
      shouldRemove: noOp,
      afterHeadMorphed: noOp,
    },
  };

  /**
   * =============================================================================
   * Core Morphing Algorithm - morph, morphChildren, morphNode
   * =============================================================================
   *
   * @param {Element | Document} oldNode
   * @param {Element | Node | HTMLCollection | Node[] | string | null} newContent
   * @param {Config} [config]
   * @returns {undefined | Node[]}
   */
  function morph(oldNode, newContent, config = {}) {
    oldNode = normalizeElement(oldNode);
    const newNode = normalizeParent(newContent);
    const ctx = createMorphContext(oldNode, newNode, config);

    return withHeadBlocking(ctx, oldNode, newNode, (ctx) => {
      let morphedNodes;
      if (ctx.morphStyle === "innerHTML") {
        morphedNodes = morphChildren(ctx, oldNode, newNode);
      } else {
        // outerHTML
        morphedNodes = morphChildren(
          ctx,
          normalizeParent(oldNode),
          newNode,
          oldNode,
          oldNode.nextSibling,
        );
      }
      ctx.pantry.remove();
      return morphedNodes;
    });
  }

  const morphChildren = (function () {
    /**
     * This is the core algorithm for matching up children.  The idea is to use id sets to try to match up
     * nodes as faithfully as possible.  We greedily match, which allows us to keep the algorithm fast, but
     * by using id sets, we are able to better match up with content deeper in the DOM.
     *
     * Basic algorithm is, for each node in the new content:
     *
     * - if we have not reached the end of the old parent:
     *   - if the new content has an id set match with the current insertion point, morph
     *   - search for an id set match
     *   - if id set match found, morph
     *   - if the new content is a soft match with the current insertion point, morph
     *   - otherwise search for a "soft" match
     *   - if a soft match is found, morph
     * - otherwise, prepend the new node before the current insertion point
     *
     * The two search algorithms terminate if competing node matches appear to outweigh what can be achieved
     * with the current node.  See findIdSetMatch and findSoftMatch for details.
     *
     * @param {MorphContext} ctx the merge context
     * @param {Element} oldParent the old content that we are merging the new content into
     * @param {Element} newParent the parent element of the new content
     * @param {Element | null} insertionPoint the point in the DOM we start morphing at (defaults to first child)
     * @param {Element | null} endPoint the point in the DOM we stop morphing at (defaults to after last child)
     * @returns {Node[]}
     */
    function morphChildren(
      ctx,
      oldParent,
      newParent,
      insertionPoint,
      endPoint,
    ) {
      if (
        oldParent instanceof HTMLTemplateElement &&
        newParent instanceof HTMLTemplateElement
      ) {
        // @ts-ignore we can pretend the DocumentFragment is an Element
        oldParent = oldParent.content;
        // @ts-ignore ditto
        newParent = newParent.content;
      }
      insertionPoint ||= oldParent.firstChild;

      // run through all the new content
      const morphedNodes = [...newParent.childNodes].map((newChild) => {
        // once we reach the end of the old parent content skip to the end and insert the rest
        if (insertionPoint != endPoint) {
          const bestMatch =
            findIdSetMatch(newChild, insertionPoint, endPoint, ctx) ||
            findSoftMatch(newChild, insertionPoint, endPoint, ctx);

          if (bestMatch) {
            insertionPoint = morphChild(bestMatch, newChild, insertionPoint, ctx);
            return bestMatch;
          }
        }

        // if the matching node is in the upcoming old content
        if (ctx.persistentIds.has(/** @type {Element} */ (newChild).id)) {
          // move it and all its children here and morph
          const movedChild = moveBeforeById(
            oldParent,
            /** @type {Element} */ (newChild).id,
            insertionPoint,
            ctx,
          );
          morphNode(movedChild, newChild, ctx);
          return movedChild;
        }

        // last resort, insert a new node from scratch
        return createNode(oldParent, newChild, insertionPoint, ctx);
      });

      // remove any remaining old nodes that didn't match up with new content
      while (insertionPoint && insertionPoint != endPoint) {
        const tempNode = insertionPoint;
        insertionPoint = insertionPoint.nextSibling;
        removeNode(tempNode, ctx);
      }

      return morphedNodes;
    }

    /**
     * @param {Node} oldNode the node to be morphed
     * @param {Node} newChild the new content
     * @param {Node|null} insertionPoint the current point in the DOM we are morphing content at
     * @param {MorphContext} ctx the merge context
     * @returns {Node|null} returns the new insertion point after the merged node
     */
    function morphChild(oldNode, newChild, insertionPoint, ctx) {
      // if the node to morph is not at the insertion point then we need to move it here by moving or removing nodes
      if (oldNode !== insertionPoint) {
        // @ts-ignore we know the Node has a valid parent
        moveBefore(oldNode.parentElement, oldNode, insertionPoint);
      }
      morphNode(oldNode, newChild, ctx);
      return oldNode.nextSibling;
    }

    function createNode(oldParent, newChild, insertionPoint, ctx) {
      if (ctx.callbacks.beforeNodeAdded(newChild) === false) return;
      if (hasPersistentIdNodes(ctx, newChild) && newChild instanceof Element) {
        // node has children with ids with possible state so create a dummy elt of same type and apply full morph algorithm
        const newEmptyChild = document.createElement(newChild.tagName);
        oldParent.insertBefore(newEmptyChild, insertionPoint);
        morphNode(newEmptyChild, newChild, ctx);
        ctx.callbacks.afterNodeAdded(newEmptyChild);
        return newEmptyChild;
      } else {
        // optimisation: no id state to preserve so we can just insert a clone of the newChild and its descendants
        const newClonedChild = document.importNode(newChild, true); // importNode to not mutate newParent
        oldParent.insertBefore(newClonedChild, insertionPoint);
        ctx.callbacks.afterNodeAdded(newClonedChild);
        return newClonedChild;
      }
    }

    /**
     *
     * @param {Node} oldNode
     * @param {Node} newNode
     * @param {MorphContext} ctx
     * @returns {boolean}
     */
    function isIdSetMatch(oldNode, newNode, ctx) {
      if (
        oldNode instanceof Element &&
        newNode instanceof Element &&
        oldNode.tagName === newNode.tagName
      ) {
        if (oldNode.id !== "" && oldNode.id === newNode.id) {
          return true;
        } else {
          return getIdIntersectionCount(oldNode, newNode, ctx) > 0;
        }
      }
      return false;
    }

    /**
     *
     * @param {Node | null} oldNode
     * @param {Node | null} newNode
     * @returns {boolean}
     */
    function isSoftMatch(oldNode, newNode) {
      if (oldNode == null || newNode == null) {
        return false;
      }
      // ok to cast: if one is not element, `id` or `tagName` will be undefined and we'll compare that
      // If oldNode has an `id` with possible state and it doesn't match newNode.id then avoid morphing
      if (
        /** @type {Element} */ (oldNode).id &&
        /** @type {Element} */ (oldNode).id !==
          /** @type {Element} */ (newNode).id
      ) {
        return false;
      }
      return (
        oldNode.nodeType === newNode.nodeType &&
        /** @type {Element} */ (oldNode).tagName ===
          /** @type {Element} */ (newNode).tagName
      );
    }

    /**
     * =============================================================================
     *  Scans forward from the insertionPoint in the old parent looking for a potential id match
     *  for the newChild.  We stop if we find a potential id match for the new child OR
     *  if the number of potential id matches we are discarding is greater than the
     *  potential id matches for the new child
     * =============================================================================
     * @param {Node} newChild
     * @param {Node | null} insertionPoint
     * @param {Node | null} endPoint
     * @param {MorphContext} ctx
     * @returns {Node | null}
     */
    function findIdSetMatch(newChild, insertionPoint, endPoint, ctx) {
      // max id matches we are willing to discard in our search
      let newChildPotentialIdCount = getPersistentIdNodeCount(ctx, newChild);

      /**
       * @type {Node | null}
       */

      // only search forward if there is a possibility of an id match
      if (newChildPotentialIdCount > 0) {
        let potentialMatch = insertionPoint;
        // if there is a possibility of an id match, scan forward
        // keep track of the potential id match count we are discarding (the
        // newChildPotentialIdCount must be greater than this to make it likely
        // worth it)
        let otherMatchCount = 0;
        while (potentialMatch != null && potentialMatch != endPoint) {
          // If we have an id match, return the current potential match
          if (isIdSetMatch(potentialMatch, newChild, ctx)) {
            return potentialMatch;
          }

          // computer the other potential matches of this new content
          otherMatchCount += getPersistentIdNodeCount(ctx, potentialMatch);

          if (otherMatchCount > newChildPotentialIdCount) {
            // if we have more potential id matches in _other_ content, we
            // do not have a good candidate for an id match, so return null
            return null;
          }

          // advanced to the next old content child
          potentialMatch = potentialMatch.nextSibling;
        }
      }
      return null;
    }

    /**
     * =============================================================================
     *  Scans forward from the insertionPoint in the old parent looking for a potential soft match
     *  for the newChild.  We stop if we find a potential soft match for the new child OR
     *  if we find a potential id match in the old parents children OR if we find two
     *  potential soft matches for the next two pieces of new content
     * =============================================================================
     * @param {Node} newChild
     * @param {Node | null} insertionPoint
     * @param {Node | null} endPoint
     * @param {MorphContext} ctx
     * @returns {null | Node}
     */
    function findSoftMatch(newChild, insertionPoint, endPoint, ctx) {
      /**
       * @type {Node | null}
       */
      let potentialSoftMatch = insertionPoint;
      /**
       * @type {Node | null}
       */
      let nextSibling = newChild.nextSibling;
      let siblingSoftMatchCount = 0;

      while (potentialSoftMatch != null && potentialSoftMatch != endPoint) {
        if (hasPersistentIdNodes(ctx, potentialSoftMatch)) {
          // the current potential soft match has a potential id set match with the remaining new
          // content so bail out of looking
          return null;
        }

        // if we have a soft match with the current node, return it
        if (isSoftMatch(potentialSoftMatch, newChild)) {
          return potentialSoftMatch;
        }

        if (isSoftMatch(potentialSoftMatch, nextSibling)) {
          // the next new node has a soft match with this node, so
          // increment the count of future soft matches
          siblingSoftMatchCount++;
          // ok to cast: if it was null it couldn't be a soft match
          nextSibling = /** @type {Node} */ (nextSibling).nextSibling;

          // If there are two future soft matches, bail to allow the siblings to soft match
          // so that we don't consume future soft matches for the sake of the current node
          if (siblingSoftMatchCount >= 2) {
            return null;
          }
        }
        // advanced to the next old content child
        potentialSoftMatch = potentialSoftMatch.nextSibling;
      }

      return null;
    }

    //=============================================================================
    // DOM Manipulation Functions
    //=============================================================================

    /**
     *
     * @param {Node} node
     * @param {MorphContext} ctx
     */
    function removeNode(node, ctx) {
      // skip remove callbacks when we're going to be restoring this from the pantry later
      if (hasPersistentIdNodes(ctx, node) && node instanceof Element) {
        moveBefore(ctx.pantry, node, null);
      } else {
        if (ctx.callbacks.beforeNodeRemoved(node) === false) return;
        node.parentNode?.removeChild(node);
        ctx.callbacks.afterNodeRemoved(node);
      }
    }

    /**
     * Search for an element by id within the document and pantry, and move it using moveBefore.
     *
     * @param {Element} parentNode - The parent node to which the element will be moved.
     * @param {string} id - The ID of the element to be moved.
     * @param {Node | null} after - The reference node to insert the element before.
     *                              If `null`, the element is appended as the last child.
     * @param {MorphContext} ctx
     * @returns {Element} The found element
     */
    function moveBeforeById(parentNode, id, after, ctx) {
      const target =
        /** @type {Element} - will always be found */
        (
          ctx.target.querySelector(`#${id}`) ||
            ctx.pantry.querySelector(`#${id}`)
        );
      moveBefore(parentNode, target, after);
      return target;
    }

    /**
     * Moves an element before another element within the same parent.
     * Uses the proposed `moveBefore` API if available, otherwise falls back to `insertBefore`.
     * This is essentialy a forward-compat wrapper.
     *
     * @param {Element} parentNode - The parent node containing the after element.
     * @param {Node} element - The element to be moved.
     * @param {Node | null} after - The reference node to insert `element` before.
     *                              If `null`, `element` is appended as the last child.
     */
    function moveBefore(parentNode, element, after) {
      // @ts-ignore - use proposed moveBefore feature
      if (parentNode.moveBefore) {
        try {
          // @ts-ignore - use proposed moveBefore feature
          parentNode.moveBefore(element, after);
        } catch (e) {
          // fall back to insertBefore as some browsers may fail on moveBefore when trying to move Dom disconnected nodes to pantry
          parentNode.insertBefore(element, after);
        }
      } else {
        parentNode.insertBefore(element, after);
      }
    }

    //=============================================================================
    // ID Set Functions
    //=============================================================================

    /**
     *
     * @type {Set<string>}
     */
    let EMPTY_SET = new Set();

    /**
     *
     * @param {MorphContext} ctx
     * @param {Node} node
     * @returns {number}
     */
    function getPersistentIdNodeCount(ctx, node) {
      let idSet = ctx.idMap.get(node) || EMPTY_SET;
      return idSet.size;
    }

    /**
     *
     * @param {MorphContext} ctx
     * @param {Node} node
     * @returns {boolean}
     */
    function hasPersistentIdNodes(ctx, node) {
      return getPersistentIdNodeCount(ctx, node) > 0;
    }

    /**
     *
     * @param {Node} oldNode
     * @param {Node} newNode
     * @param {MorphContext} ctx
     * @returns {number}
     */
    function getIdIntersectionCount(oldNode, newNode, ctx) {
      let oldSet = ctx.idMap.get(oldNode) || EMPTY_SET;
      let newSet = ctx.idMap.get(newNode) || EMPTY_SET;

      let matchCount = 0;
      for (const id of oldSet) {
        // a potential match is an id in the new and old nodes that
        // has not already been merged into the DOM
        // But the newNode content we call this on has not been
        // merged yet and we don't allow duplicate IDs so it is simple
        if (newSet.has(id)) {
          ++matchCount;
        }
      }
      return matchCount;
    }

    return morphChildren;
  })();

  //=============================================================================
  // Single Node Morphing Code
  //=============================================================================
  const morphNode = (function () {
    /**
     * @param {Node} oldNode root node to merge content into
     * @param {Node} newContent new content to merge
     * @param {MorphContext} ctx the merge context
     * @returns {Node | null} the element that ended up in the DOM
     */
    function morphNode(oldNode, newContent, ctx) {
      if (ctx.ignoreActive && oldNode === document.activeElement) {
        // don't morph focused element
        return null;
      }

      if (ctx.callbacks.beforeNodeMorphed(oldNode, newContent) === false) {
        return oldNode;
      }

      if (oldNode instanceof HTMLHeadElement && ctx.head.ignore) {
        // ignore the head element
      } else if (
        oldNode instanceof HTMLHeadElement &&
        ctx.head.style !== "morph"
      ) {
        // ok to cast: if newContent wasn't also a <head>, it would've got caught in the `!isSoftMatch` branch above
        handleHeadElement(
          oldNode,
          /** @type {HTMLHeadElement} */ (newContent),
          ctx,
        );
      } else {
        morphAttributes(oldNode, newContent, ctx);
        if (!ignoreValueOfActiveElement(oldNode, ctx)) {
          // @ts-ignore newContent can be a node here because .firstChild will be null
          morphChildren(ctx, oldNode, newContent);
        }
      }
      ctx.callbacks.afterNodeMorphed(oldNode, newContent);
      return oldNode;
    }

    /**
     * syncs a given node with another node, copying over all attributes and
     * inner element state from the newNode to the oldNode
     *
     * @param {Node} oldNode the node to copy attributes & state to
     * @param {Node} newNode the node to copy attributes & state from
     * @param {MorphContext} ctx the merge context
     */
    function morphAttributes(oldNode, newNode, ctx) {
      let type = newNode.nodeType;

      // if is an element type, sync the attributes from the
      // new node into the new node
      if (type === 1 /* element type */) {
        const oldElt = /** @type {Element} */ (oldNode);
        const newElt = /** @type {Element} */ (newNode);

        const oldAttributes = oldElt.attributes;
        const newAttributes = newElt.attributes;
        for (const newAttribute of newAttributes) {
          if (ignoreAttribute(newAttribute.name, oldElt, "update", ctx)) {
            continue;
          }
          if (oldElt.getAttribute(newAttribute.name) !== newAttribute.value) {
            oldElt.setAttribute(newAttribute.name, newAttribute.value);
          }
        }
        // iterate backwards to avoid skipping over items when a delete occurs
        for (let i = oldAttributes.length - 1; 0 <= i; i--) {
          const oldAttribute = oldAttributes[i];

          // toAttributes is a live NamedNodeMap, so iteration+mutation is unsafe
          // e.g. custom element attribute callbacks can remove other attributes
          if (!oldAttribute) continue;

          if (!newElt.hasAttribute(oldAttribute.name)) {
            if (ignoreAttribute(oldAttribute.name, oldElt, "remove", ctx)) {
              continue;
            }
            oldElt.removeAttribute(oldAttribute.name);
          }
        }

        if (!ignoreValueOfActiveElement(oldElt, ctx)) {
          syncInputValue(oldElt, newElt, ctx);
        }
      }

      // sync text nodes
      if (type === 8 /* comment */ || type === 3 /* text */) {
        if (oldNode.nodeValue !== newNode.nodeValue) {
          oldNode.nodeValue = newNode.nodeValue;
        }
      }
    }

    /**
     * NB: many bothans died to bring us information:
     *
     *  https://github.com/patrick-steele-idem/morphdom/blob/master/src/specialElHandlers.js
     *  https://github.com/choojs/nanomorph/blob/master/lib/morph.jsL113
     *
     * @param {Element} oldElement the element to sync the input value to
     * @param {Element} newElement the element to sync the input value from
     * @param {MorphContext} ctx the merge context
     */
    function syncInputValue(oldElement, newElement, ctx) {
      if (
        oldElement instanceof HTMLInputElement &&
        newElement instanceof HTMLInputElement &&
        newElement.type !== "file"
      ) {
        let newValue = newElement.value;
        let oldValue = oldElement.value;

        // sync boolean attributes
        syncBooleanAttribute(oldElement, newElement, "checked", ctx);
        syncBooleanAttribute(oldElement, newElement, "disabled", ctx);

        if (!newElement.hasAttribute("value")) {
          if (!ignoreAttribute("value", oldElement, "remove", ctx)) {
            oldElement.value = "";
            oldElement.removeAttribute("value");
          }
        } else if (oldValue !== newValue) {
          if (!ignoreAttribute("value", oldElement, "update", ctx)) {
            oldElement.setAttribute("value", newValue);
            oldElement.value = newValue;
          }
        }
        // TODO: QUESTION(1cg): this used to only check `newElement` unlike the other branches -- why?
        // did I break something?
      } else if (
        oldElement instanceof HTMLOptionElement &&
        newElement instanceof HTMLOptionElement
      ) {
        syncBooleanAttribute(oldElement, newElement, "selected", ctx);
      } else if (
        oldElement instanceof HTMLTextAreaElement &&
        newElement instanceof HTMLTextAreaElement
      ) {
        let newValue = newElement.value;
        let oldValue = oldElement.value;
        if (ignoreAttribute("value", oldElement, "update", ctx)) {
          return;
        }
        if (newValue !== oldValue) {
          oldElement.value = newValue;
        }
        if (
          oldElement.firstChild &&
          oldElement.firstChild.nodeValue !== newValue
        ) {
          oldElement.firstChild.nodeValue = newValue;
        }
      }
    }

    /**
     * @param {Element} oldElement element to sync the value to
     * @param {Element} newElement element to sync the value from
     * @param {string} attributeName the attribute name
     * @param {MorphContext} ctx the merge context
     */
    function syncBooleanAttribute(oldElement, newElement, attributeName, ctx) {
      // @ts-ignore this function is only used on boolean attrs that are reflected as dom properties
      const newLiveValue = newElement[attributeName],
        // @ts-ignore ditto
        oldLiveValue = oldElement[attributeName];
      if (newLiveValue !== oldLiveValue) {
        const ignoreUpdate = ignoreAttribute(
          attributeName,
          oldElement,
          "update",
          ctx,
        );
        if (!ignoreUpdate) {
          // update attribute's associated DOM property
          // @ts-ignore this function is only used on boolean attrs that are reflected as dom properties
          oldElement[attributeName] = newElement[attributeName];
        }
        if (newLiveValue) {
          if (!ignoreUpdate) {
            // TODO: do we really want this? tests say so but it feels wrong
            oldElement.setAttribute(attributeName, newLiveValue);
          }
        } else {
          if (!ignoreAttribute(attributeName, oldElement, "remove", ctx)) {
            oldElement.removeAttribute(attributeName);
          }
        }
      }
    }

    /**
     * @param {string} attr the attribute to be mutated
     * @param {Element} element the element that is going to be updated
     * @param {"update" | "remove"} updateType
     * @param {MorphContext} ctx the merge context
     * @returns {boolean} true if the attribute should be ignored, false otherwise
     */
    function ignoreAttribute(attr, element, updateType, ctx) {
      if (
        attr === "value" &&
        ctx.ignoreActiveValue &&
        element === document.activeElement
      ) {
        return true;
      }
      return (
        ctx.callbacks.beforeAttributeUpdated(attr, element, updateType) ===
        false
      );
    }

    /**
     * @param {Node} possibleActiveElement
     * @param {MorphContext} ctx
     * @returns {boolean}
     */
    function ignoreValueOfActiveElement(possibleActiveElement, ctx) {
      return (
        !!ctx.ignoreActiveValue &&
        possibleActiveElement === document.activeElement &&
        possibleActiveElement !== document.body
      );
    }

    return morphNode;
  })();

  //=============================================================================
  // Head Management Functions
  //=============================================================================
  /**
   * @param {MorphContext} ctx
   * @param {Element} oldNode
   * @param {Element} newNode
   * @returns {undefined | Node[]}
   */
  function withHeadBlocking(ctx, oldNode, newNode, callback) {
    if (ctx.head.block) {
      const oldHead = oldNode.querySelector("head");
      const newHead = newNode.querySelector("head");
      if (oldHead && newHead) {
        const promises = handleHeadElement(oldHead, newHead, ctx);
        // when head promises resolve, proceed ignoring the head tag
        return Promise.all(promises).then(() => {
          const newCtx = Object.assign(ctx, {
            head: {
              block: false,
              ignore: true,
            },
          });
          return callback(newCtx);
        });
      }
    }
    // just proceed if we not head blocking
    return callback(ctx);
  }

  /**
   * =============================================================================
   *  The HEAD tag can be handled specially, either w/ a 'merge' or 'append' style
   * =============================================================================
   * @param {Element} oldHead
   * @param {Element} newHead
   * @param {MorphContext} ctx
   * @returns {Promise<void>[]}
   */
  function handleHeadElement(oldHead, newHead, ctx) {
    /** @type {Node[]} */
    let added = [];
    /** @type {Element[]} */
    let removed = [];
    /** @type {Element[]} */
    let preserved = [];
    /** @type {Element[]} */
    let nodesToAppend = [];

    let headMergeStyle = ctx.head.style;

    // put all new head elements into a Map, by their outerHTML
    let srcToNewHeadNodes = new Map();
    for (const newHeadChild of newHead.children) {
      srcToNewHeadNodes.set(newHeadChild.outerHTML, newHeadChild);
    }

    // for each elt in the current head
    for (const currentHeadElt of oldHead.children) {
      // If the current head element is in the map
      let inNewContent = srcToNewHeadNodes.has(currentHeadElt.outerHTML);
      let isReAppended = ctx.head.shouldReAppend(currentHeadElt);
      let isPreserved = ctx.head.shouldPreserve(currentHeadElt);
      if (inNewContent || isPreserved) {
        if (isReAppended) {
          // remove the current version and let the new version replace it and re-execute
          removed.push(currentHeadElt);
        } else {
          // this element already exists and should not be re-appended, so remove it from
          // the new content map, preserving it in the DOM
          srcToNewHeadNodes.delete(currentHeadElt.outerHTML);
          preserved.push(currentHeadElt);
        }
      } else {
        if (headMergeStyle === "append") {
          // we are appending and this existing element is not new content
          // so if and only if it is marked for re-append do we do anything
          if (isReAppended) {
            removed.push(currentHeadElt);
            nodesToAppend.push(currentHeadElt);
          }
        } else {
          // if this is a merge, we remove this content since it is not in the new head
          if (ctx.head.shouldRemove(currentHeadElt) !== false) {
            removed.push(currentHeadElt);
          }
        }
      }
    }

    // Push the remaining new head elements in the Map into the
    // nodes to append to the head tag
    nodesToAppend.push(...srcToNewHeadNodes.values());

    let promises = [];
    for (const newNode of nodesToAppend) {
      // TODO: This could theoretically be null, based on type
      let newElt = /** @type {ChildNode} */ (
        document.createRange().createContextualFragment(newNode.outerHTML)
          .firstChild
      );
      if (ctx.callbacks.beforeNodeAdded(newElt) !== false) {
        if (
          ("href" in newElt && newElt.href) ||
          ("src" in newElt && newElt.src)
        ) {
          /** @type {(result?: any) => void} */ let resolve;
          let promise = new Promise(function (_resolve) {
            resolve = _resolve;
          });
          newElt.addEventListener("load", function () {
            resolve();
          });
          promises.push(promise);
        }
        oldHead.appendChild(newElt);
        ctx.callbacks.afterNodeAdded(newElt);
        added.push(newElt);
      }
    }

    // remove all removed elements, after we have appended the new elements to avoid
    // additional network requests for things like style sheets
    for (const removedElement of removed) {
      if (ctx.callbacks.beforeNodeRemoved(removedElement) !== false) {
        oldHead.removeChild(removedElement);
        ctx.callbacks.afterNodeRemoved(removedElement);
      }
    }

    ctx.head.afterHeadMorphed(oldHead, {
      added: added,
      kept: preserved,
      removed: removed,
    });
    return promises;
  }

  //=============================================================================
  // Create Morph Context Functions
  //=============================================================================
  const createMorphContext = (function () {
    /**
     *
     * @param {Element} oldNode
     * @param {Element} newContent
     * @param {Config} config
     * @returns {MorphContext}
     */
    function createMorphContext(oldNode, newContent, config) {
      const mergedConfig = mergeDefaults(config);
      const { persistentIds, idMap } = createIdMaps(oldNode, newContent);

      const morphStyle = mergedConfig.morphStyle || "outerHTML";
      if (!["innerHTML", "outerHTML"].includes(morphStyle)) {
        throw `Do not understand how to morph style ${morphStyle}`;
      }

      return {
        target: oldNode,
        newContent: newContent,
        config: mergedConfig,
        morphStyle: morphStyle,
        ignoreActive: mergedConfig.ignoreActive,
        ignoreActiveValue: mergedConfig.ignoreActiveValue,
        idMap: idMap,
        persistentIds: persistentIds,
        pantry: createPantry(),
        callbacks: mergedConfig.callbacks,
        head: mergedConfig.head,
      };
    }

    /**
     * Deep merges the config object and the Idiomorph.defaults object to
     * produce a final configuration object
     * @param {Config} config
     * @returns {ConfigInternal}
     */
    function mergeDefaults(config) {
      /**
       * @type {ConfigInternal}
       */
      let finalConfig = Object.assign({}, defaults);

      // copy top level stuff into final config
      Object.assign(finalConfig, config);

      // copy callbacks into final config (do this to deep merge the callbacks)
      finalConfig.callbacks = Object.assign(
        {},
        defaults.callbacks,
        config.callbacks,
      );

      // copy head config into final config  (do this to deep merge the head)
      finalConfig.head = Object.assign({}, defaults.head, config.head);

      return finalConfig;
    }

    function createPantry() {
      const pantry = document.createElement("div");
      pantry.hidden = true;
      document.body.insertAdjacentElement("afterend", pantry);
      return pantry;
    }

    /**
     * @param {Element} content
     * @returns {Element[]}
     */
    function elementsWithIds(content) {
      let elements = Array.from(content.querySelectorAll("[id]"));
      if (content.id) {
        elements.push(content);
      }
      return elements;
    }

    /**
     * A bottom up algorithm that finds all elements with ids in the node
     * argument and populates id sets for those nodes and all their parents, generating
     * a set of ids contained within all nodes for the entire hierarchy in the DOM
     *
     * @param {Element|null} nodeParent
     * @param {Element[]} nodes
     * @param {Set<string>} persistentIds
     * @param {Map<Node, Set<string>>} idMap
     */
    function populateIdMapForNode(nodeParent, nodes, persistentIds, idMap) {
      for (const elt of nodes) {
        if (persistentIds.has(elt.id)) {
          /**
           * @type {Element|null}
           */
          let current = elt;
          // walk up the parent hierarchy of that element, adding the id
          // of element to the parent's id set
          while (current !== nodeParent && current != null) {
            let idSet = idMap.get(current);
            // if the id set doesn't exist, create it and insert it in the  map
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

    /**
     * This function computes a map of nodes to all ids contained within that node (inclusive of the
     * node).  This map can be used to ask if two nodes have intersecting sets of ids, which allows
     * for a looser definition of "matching" than tradition id matching, and allows child nodes
     * to contribute to a parent nodes matching.
     *
     * @param {Element} oldContent  the old content that will be morphed
     * @param {Element} newContent  the new content to morph to
     * @returns {IdSets} a map of nodes to id sets for the
     */
    function createIdMaps(oldContent, newContent) {
      // Calculate ids that persist between the two contents exculuding duplicates first
      let oldIdMap = new Map();
      let dupSet = new Set();
      const oldElts = elementsWithIds(oldContent);
      for (const oldElt of oldElts) {
        const id = oldElt.id;
        // if already in map then log duplicates to be skipped
        if (oldIdMap.get(id)) {
          dupSet.add(id);
        } else {
          oldIdMap.set(id, oldElt.tagName);
        }
      }
      let persistentIds = new Set();
      const newElts = elementsWithIds(newContent);
      for (const newElt of newElts) {
        const id = newElt.id;
        const oldTagName = oldIdMap.get(id);
        // if already matched skip id as duplicate but also skip if tag types mismatch because it could match later
        if (
          persistentIds.has(id) ||
          (oldTagName && oldTagName !== newElt.tagName)
        ) {
          dupSet.add(id);
          persistentIds.delete(id);
        }
        if (oldTagName === newElt.tagName && !dupSet.has(id)) {
          persistentIds.add(id);
        }
      }
      /**
       *
       * @type {Map<Node, Set<string>>}
       */
      let idMap = new Map();
      populateIdMapForNode(
        oldContent.parentElement,
        newElts,
        persistentIds,
        idMap,
      );
      populateIdMapForNode(
        newContent.parentElement,
        oldElts,
        persistentIds,
        idMap,
      );
      return { persistentIds, idMap };
    }

    return createMorphContext;
  })();

  //=============================================================================
  // HTML Normalization Functions
  //=============================================================================
  const { normalizeElement, normalizeParent } = (function () {
    /** @type {WeakSet<Node>} */
    const generatedByIdiomorph = new WeakSet();

    /**
     *
     * @param {null | Node | HTMLCollection | Node[] | Document & {generatedByIdiomorph:boolean}} newContent
     * @returns {Element}
     */
    function normalizeElement(content) {
      if (content instanceof Document) {
        return content.documentElement;
      } else {
        return content;
      }
    }

    /**
     *
     * @param {null | Node | HTMLCollection | Node[] | Document & {generatedByIdiomorph:boolean}} newContent
     * @returns {Element}
     */
    function normalizeParent(newContent) {
      if (newContent == null) {
        return document.createElement("div"); // dummy parent element
      } else if (typeof newContent === "string") {
        return normalizeParent(parseContent(newContent));
      } else if (
        generatedByIdiomorph.has(/** @type {Element} */ (newContent))
      ) {
        // the template tag created by idiomorph parsing can serve as a dummy parent
        return /** @type {Element} */ (newContent);
      } else if (newContent instanceof Node) {
        if (newContent.parentNode) {
          return /** @type {Element} */ (newContent.parentNode);
        } else {
          // a single node is added as a child to a dummy parent
          const dummyParent = document.createElement("div");
          dummyParent.append(newContent);
          return dummyParent;
        }
      } else {
        // all nodes in the array or HTMLElement collection are consolidated under
        // a single dummy parent element
        const dummyParent = document.createElement("div");
        for (const elt of [...newContent]) {
          dummyParent.append(elt);
        }
        return dummyParent;
      }
    }

    /**
     *
     * @param {string} newContent
     * @returns {Node | null | DocumentFragment}
     */
    function parseContent(newContent) {
      let parser = new DOMParser();

      // remove svgs to avoid false-positive matches on head, etc.
      let contentWithSvgsRemoved = newContent.replace(
        /<svg(\s[^>]*>|>)([\s\S]*?)<\/svg>/gim,
        "",
      );

      // if the newContent contains a html, head or body tag, we can simply parse it w/o wrapping
      if (
        contentWithSvgsRemoved.match(/<\/html>/) ||
        contentWithSvgsRemoved.match(/<\/head>/) ||
        contentWithSvgsRemoved.match(/<\/body>/)
      ) {
        let content = parser.parseFromString(newContent, "text/html");
        // if it is a full HTML document, return the document itself as the parent container
        if (contentWithSvgsRemoved.match(/<\/html>/)) {
          generatedByIdiomorph.add(content);
          return content;
        } else {
          // otherwise return the html element as the parent container
          let htmlElement = content.firstChild;
          if (htmlElement) {
            generatedByIdiomorph.add(htmlElement);
          }
          return htmlElement;
        }
      } else {
        // if it is partial HTML, wrap it in a template tag to provide a parent element and also to help
        // deal with touchy tags like tr, tbody, etc.
        let responseDoc = parser.parseFromString(
          "<body><template>" + newContent + "</template></body>",
          "text/html",
        );
        let content = /** @type {HTMLTemplateElement} */ (
          responseDoc.body.querySelector("template")
        ).content;
        generatedByIdiomorph.add(content);
        return content;
      }
    }

    return { normalizeElement, normalizeParent };
  })();

  //=============================================================================
  // This is what ends up becoming the Idiomorph global object
  //=============================================================================
  return {
    morph,
    defaults,
  };
})();
