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
 * @property {'outerHTML' | 'innerHTML' | 'attributes'} [morphStyle]
 * @property {boolean} [ignoreActive]
 * @property {boolean} [syncInputValue]
 * @property {string} [eventCallbacks]
 * @property {ConfigCallbacks} [callbacks]
 */

/**
 * @typedef {function} NoOp
 *
 * @returns {void}
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
 * @property {'outerHTML' | 'innerHTML' | 'attributes'} morphStyle
 * @property {boolean} [ignoreActive]
 * @property {boolean} [syncInputValue]
 * @property {string} [eventCallbacks]
 * @property {ConfigCallbacksInternal} callbacks

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
  ("use strict");

  /**
   * @typedef {object} MorphContext
   *
   * @property {Element} target
   * @property {Element} newContent
   * @property {ConfigInternal} config
   * @property {ConfigInternal['morphStyle']} morphStyle
   * @property {ConfigInternal['ignoreActive']} ignoreActive
   * @property {ConfigInternal['syncInputValue']} syncInputValue
   * @property {Map<Node, Set<string>>} idMap
   * @property {Set<string>} persistentIds
   * @property {ConfigInternal['callbacks']} callbacks
   * @property {HTMLDivElement} pantry
   */

  //=============================================================================
  // AND NOW IT BEGINS...
  //=============================================================================

  /**
   * Core idiomorph function for morphing one DOM tree to another
   *
   * @param {Element | Document} oldNode
   * @param {Element | Node | HTMLCollection | Node[] | string | null} newContent
   * @param {Config|string} [config]
   * @returns {Promise<Node[]> | Node[]}
   */
  function morph(oldNode, newContent, config = {}) {
    oldNode = normalizeElement(oldNode);
    const newNode = normalizeParent(newContent);
    const ctx = createMorphContext(oldNode, newNode, config);

    if (ctx.morphStyle === "innerHTML") {
      morphChildren(ctx, oldNode, newNode);
      ctx.pantry.remove();
      return Array.from(oldNode.childNodes);
    } else if (ctx.morphStyle == "attributes") {
      if (newNode.firstChild) morphAttributes(oldNode, newNode.firstChild, ctx);
      ctx.pantry.remove();
      return [oldNode];
    } else {
      return morphOuterHTML(ctx, oldNode, newNode);
    }
  }

  /**
   * Morph just the outerHTML of the oldNode to the newContent
   * We have to be careful because the oldNode could have siblings which need to be untouched
   * @param {MorphContext} ctx
   * @param {Element} oldNode
   * @param {Element} newNode
   * @returns {Node[]}
   */
  function morphOuterHTML(ctx, oldNode, newNode) {
    // oldParent can be a document or documentFragment but we can treat these as Element
    const oldParent = /** @type {Element} */ (oldNode.parentNode);

    // store start and end points so we can find inbetween nodes to return later
    // as we can avoid returning before or after siblings
    const beforeStartPoint = oldNode.previousSibling;
    const endPoint = oldNode.nextSibling;

    morphChildren(
      ctx,
      oldParent,
      newNode,
      // these two optional params are the secret sauce
      oldNode, // start point for iteration
      endPoint, // end point for iteration
    );

    const nodes = [];
    // return array from the first node added to before the last node
    let cursor = beforeStartPoint?.nextSibling || oldParent.firstChild;
    while (cursor && cursor != endPoint) {
      nodes.push(cursor);
      cursor = cursor.nextSibling;
    }
    ctx.pantry.remove();
    return nodes;
  }

  const morphChildren = (function () {
    /**
     * This is the core algorithm for matching up children.  The idea is to use id sets to try to match up
     * nodes as faithfully as possible.  We greedily match, which allows us to keep the algorithm fast, but
     * by using id sets, we are able to better match up with content deeper in the DOM.
     *
     * Basic algorithm:
     * - for each node in the new content:
     *   - search self and siblings for an id set match, falling back to a soft match
     *   - if match found
     *     - remove any nodes up to the match:
     *       - pantry persistent nodes
     *       - delete the rest
     *     - morph the match
     *   - elsif no match found, and node is persistent
     *     - find its match by querying the old root (future) and pantry (past)
     *     - move it and its children here
     *     - morph it
     *   - else
     *     - create a new node from scratch as a last result
     *
     * @param {MorphContext} ctx the merge context
     * @param {Element} oldParent the old content that we are merging the new content into
     * @param {Element} newParent the parent element of the new content
     * @param {Node|null} [insertionPoint] the point in the DOM we start morphing at (defaults to first child)
     * @param {Node|null} [endPoint] the point in the DOM we stop morphing at (defaults to after last child)
     */
    function morphChildren(
      ctx,
      oldParent,
      newParent,
      insertionPoint = null,
      endPoint = null,
    ) {
      // normalize
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
      for (const newChild of newParent.childNodes) {
        // once we reach the end of the old parent content skip to the end and insert the rest
        if (insertionPoint && insertionPoint != endPoint) {
          const bestMatch = findBestMatch(
            ctx,
            newChild,
            insertionPoint,
            endPoint,
          );
          if (bestMatch) {
            // if the node to morph is not at the insertion point then remove/move up to it
            if (bestMatch !== insertionPoint) {
              removeNodesBetween(ctx, insertionPoint, bestMatch);
            }
            morphNode(bestMatch, newChild, ctx);
            insertionPoint = bestMatch.nextSibling;
            continue;
          }
        }

        // if the matching node is elsewhere in the original content
        if (newChild instanceof Element && ctx.persistentIds.has(newChild.id)) {
          // move it and all its children here and morph
          const movedChild = moveBeforeById(
            oldParent,
            newChild.id,
            insertionPoint,
            ctx,
          );
          morphNode(movedChild, newChild, ctx);
          insertionPoint = movedChild.nextSibling;
          continue;
        }

        // last resort: insert the new node from scratch
        const insertedNode = createNode(
          oldParent,
          newChild,
          insertionPoint,
          ctx,
        );
        // could be null if beforeNodeAdded prevented insertion
        if (insertedNode) {
          insertionPoint = insertedNode.nextSibling;
        }
      }

      // remove any remaining old nodes that didn't match up with new content
      while (insertionPoint && insertionPoint != endPoint) {
        const tempNode = insertionPoint;
        insertionPoint = insertionPoint.nextSibling;
        removeNode(ctx, tempNode);
      }
    }

    /**
     * This performs the action of inserting a new node while handling situations where the node contains
     * elements with persistent ids and possible state info we can still preserve by moving in and then morphing
     *
     * @param {Element} oldParent
     * @param {Node} newChild
     * @param {Node|null} insertionPoint
     * @param {MorphContext} ctx
     * @returns {Node|null}
     */
    function createNode(oldParent, newChild, insertionPoint, ctx) {
      if (ctx.callbacks.beforeNodeAdded(newChild) === false) return null;
      if (ctx.idMap.has(newChild)) {
        // node has children with ids with possible state so create a dummy elt of same type and apply full morph algorithm
        const newEmptyChild = document.createElement(
          /** @type {Element} */ (newChild).tagName,
        );
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

    //=============================================================================
    // Matching Functions
    //=============================================================================
    const findBestMatch = (function () {
      /**
       * Scans forward from the startPoint to the endPoint looking for a match
       * for the node. It looks for an id set match first, then a soft match.
       * We abort softmatching if we find two future soft matches, to reduce churn.
       * @param {Node} node
       * @param {MorphContext} ctx
       * @param {Node | null} startPoint
       * @param {Node | null} endPoint
       * @returns {Node | null}
       */
      function findBestMatch(ctx, node, startPoint, endPoint) {
        let softMatch = null;
        let nextSibling = node.nextSibling;
        let siblingSoftMatchCount = 0;
        let displaceMatchCount = 0;

        // max id matches we are willing to displace in our search
        const nodeMatchCount = ctx.idMap.get(node)?.size || 0;

        let cursor = startPoint;
        while (cursor && cursor != endPoint) {
          // soft matching is a prerequisite for id set matching
          if (isSoftMatch(cursor, node)) {
            if (isIdSetMatch(ctx, cursor, node)) {
              return cursor; // found an id set match, we're done!
            }

            // we haven't yet saved a soft match fallback
            if (softMatch === null) {
              // the current soft match will hard match something else in the future, leave it
              if (!ctx.idMap.has(cursor)) {
                // optimization: if node can't id set match, we can just return the soft match immediately
                if (!nodeMatchCount) {
                  return cursor;
                } else {
                  // save this as the fallback if we get through the loop without finding a hard match
                  softMatch = cursor;
                }
              }
            }
          }
          // check for ids we may be displaced when matching
          displaceMatchCount += ctx.idMap.get(cursor)?.size || 0;
          if (displaceMatchCount > nodeMatchCount) {
            // if we are going to displace more ids than the node contains then
            // we do not have a good candidate for an id match, so return
            break;
          }

          if (
            softMatch === null &&
            nextSibling &&
            isSoftMatch(cursor, nextSibling)
          ) {
            // The next new node has a soft match with this node, so
            // increment the count of future soft matches
            siblingSoftMatchCount++;
            nextSibling = nextSibling.nextSibling;

            // If there are two future soft matches, block soft matching for this node to allow
            // future siblings to soft match. This is to reduce churn in the DOM when an element
            // is prepended.
            if (siblingSoftMatchCount >= 2) {
              softMatch = undefined;
            }
          }

          // if the current node contains active element, stop looking for better future matches,
          // because if one is found, this node will be moved to the pantry, reparenting it and thus losing focus
          if (cursor.contains(document.activeElement)) break;

          cursor = cursor.nextSibling;
        }

        return softMatch || null;
      }

      /**
       *
       * @param {MorphContext} ctx
       * @param {Node} oldNode
       * @param {Node} newNode
       * @returns {boolean}
       */
      function isIdSetMatch(ctx, oldNode, newNode) {
        let oldSet = ctx.idMap.get(oldNode);
        let newSet = ctx.idMap.get(newNode);

        if (!newSet || !oldSet) return false;

        for (const id of oldSet) {
          // a potential match is an id in the new and old nodes that
          // has not already been merged into the DOM
          // But the newNode content we call this on has not been
          // merged yet and we don't allow duplicate IDs so it is simple
          if (newSet.has(id)) {
            return true;
          }
        }
        return false;
      }

      /**
       *
       * @param {Node} oldNode
       * @param {Node} newNode
       * @returns {boolean}
       */
      function isSoftMatch(oldNode, newNode) {
        // ok to cast: if one is not element, `id` and `tagName` will be undefined and we'll just compare that.
        const oldElt = /** @type {Element} */ (oldNode);
        const newElt = /** @type {Element} */ (newNode);

        return (
          oldElt.nodeType === newElt.nodeType &&
          oldElt.tagName === newElt.tagName &&
          // If oldElt has an `id` with possible state and it doesn't match newElt.id then avoid morphing.
          // We'll still match an anonymous node with an IDed newElt, though, because if it got this far,
          // its not persistent, and new nodes can't have any hidden state.
          (!oldElt.id || oldElt.id === newElt.id)
        );
      }

      return findBestMatch;
    })();

    //=============================================================================
    // DOM Manipulation Functions
    //=============================================================================

    /**
     * Gets rid of an unwanted DOM node; strategy depends on nature of its reuse:
     * - Persistent nodes will be moved to the pantry for later reuse
     * - Other nodes will have their hooks called, and then are removed
     * @param {MorphContext} ctx
     * @param {Node} node
     */
    function removeNode(ctx, node) {
      // are we going to id set match this later?
      if (ctx.idMap.has(node)) {
        // skip callbacks and move to pantry
        moveBefore(ctx.pantry, node, null);
      } else {
        // remove for realsies
        if (ctx.callbacks.beforeNodeRemoved(node) === false) return;
        node.parentNode?.removeChild(node);
        ctx.callbacks.afterNodeRemoved(node);
      }
    }

    /**
     * Remove nodes between the start and end nodes
     * @param {MorphContext} ctx
     * @param {Node} startInclusive
     * @param {Node} endExclusive
     * @returns {Node|null}
     */
    function removeNodesBetween(ctx, startInclusive, endExclusive) {
      /** @type {Node | null} */
      let cursor = startInclusive;
      // remove nodes until the endExclusive node
      while (cursor && cursor !== endExclusive) {
        let tempNode = /** @type {Node} */ (cursor);
        cursor = cursor.nextSibling;
        removeNode(ctx, tempNode);
      }
      return cursor;
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
          (ctx.target.id === id && ctx.target) ||
            ctx.target.querySelector(`[id="${id}"]`) ||
            ctx.pantry.querySelector(`[id="${id}"]`)
        );
      removeElementFromAncestorsIdMaps(target, ctx);
      moveBefore(parentNode, target, after);
      return target;
    }

    /**
     * Removes an element from its ancestors' id maps. This is needed when an element is moved from the
     * "future" via `moveBeforeId`. Otherwise, its erstwhile ancestors could be mistakenly moved to the
     * pantry rather than being deleted, preventing their removal hooks from being called.
     *
     * @param {Element} element - element to remove from its ancestors' id maps
     * @param {MorphContext} ctx
     */
    function removeElementFromAncestorsIdMaps(element, ctx) {
      const id = element.id;
      /** @ts-ignore - safe to loop in this way **/
      while ((element = element.parentNode)) {
        let idSet = ctx.idMap.get(element);
        if (idSet) {
          idSet.delete(id);
          if (!idSet.size) {
            ctx.idMap.delete(element);
          }
        }
      }
    }

    /**
     * Moves an element before another element within the same parent.
     * Uses the proposed `moveBefore` API if available (and working), otherwise falls back to `insertBefore`.
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

    return morphChildren;
  })();

  //=============================================================================
  // Single Node Morphing Code
  //=============================================================================
  const { morphNode, morphAttributes } = (function () {
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

      morphAttributes(oldNode, newContent, ctx);
      // @ts-ignore treat as element as other cases have no children. Only morph children if different content or inputs to sync
      if (ctx.syncInputValue || oldNode.innerHTML !== newContent.innerHTML) {
        // @ts-ignore newContent can be a element here because .firstChild will be null
        morphChildren(ctx, oldNode, newContent);
      }
      ctx.callbacks.afterNodeMorphed(oldNode, newContent);
      return oldNode;
    }

    /**
     * syncs the oldNode to the newNode, copying over all attributes and
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

        if (ctx.syncInputValue) {
          syncInputValue(oldElt, newElt, ctx);
        } else if (
          oldElt instanceof HTMLTextAreaElement &&
          newElt instanceof HTMLTextAreaElement &&
          oldElt.defaultValue != newElt.defaultValue
        ) {
          // handle updates to TextArea value
          if (!ignoreAttribute("value", oldElt, "update", ctx)) {
            oldElt.value = newElt.value;
          }
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
      }
    }

    /**
     * @param {Element} oldElement element to write the value to
     * @param {Element} newElement element to read the value from
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
            // https://developer.mozilla.org/en-US/docs/Glossary/Boolean/HTML
            // this is the correct way to set a boolean attribute to "true"
            oldElement.setAttribute(attributeName, "");
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
      return (
        ctx.callbacks.beforeAttributeUpdated(attr, element, updateType) ===
        false
      );
    }

    return { morphNode, morphAttributes };
  })();

  //=============================================================================
  // Create Morph Context Functions
  //=============================================================================
  const { createMorphContext, createDefaults, addConfig, getConfig } =
    (function () {
      /**
       *
       * @param {Element} oldNode
       * @param {Element} newContent
       * @param {Config|string} config
       * @returns {MorphContext}
       */
      function createMorphContext(oldNode, newContent, config) {
        const { persistentIds, idMap } = createIdMaps(oldNode, newContent);

        const mergedConfig = getConfig(config);
        const morphStyle = mergedConfig.morphStyle || "outerHTML";
        if (!["innerHTML", "outerHTML", "attributes"].includes(morphStyle)) {
          throw `Do not understand how to morph style ${morphStyle}`;
        }

        return {
          target: oldNode,
          newContent: newContent,
          config: mergedConfig,
          morphStyle: morphStyle,
          ignoreActive: mergedConfig.ignoreActive,
          syncInputValue: mergedConfig.syncInputValue,
          idMap: idMap,
          persistentIds: persistentIds,
          pantry: createPantry(),
          callbacks: mergedConfig.callbacks,
        };
      }

      /**
       * @param {Node} node
       * @param {string} name
       * @param {boolean} cancelable
       * @param {function} callback
       * @returns {boolean}
       */
      function nodeEventCallback(node, name, cancelable, callback) {
        const eventResponse = document.body.dispatchEvent(
          new CustomEvent(name, {
            cancelable,
            detail: { node },
          }),
        );
        const callbackResponse = callback(node);
        return eventResponse && callbackResponse;
      }

      /**
       * @param {Node} oldNode
       * @param {Node} newNode
       * @param {string} name
       * @param {boolean} cancelable
       * @param {function} callback
       * @returns {boolean}
       */
      function morphEventCallback(
        oldNode,
        newNode,
        name,
        cancelable,
        callback,
      ) {
        const eventResponse = document.body.dispatchEvent(
          new CustomEvent(name, {
            cancelable,
            detail: { oldNode, newNode },
          }),
        );
        const callbackResponse = callback(oldNode, newNode);
        return eventResponse && callbackResponse;
      }

      /**
       * @param {string} attributeName
       * @param {Element} node
       * @param {string} mutationType
       * @param {string} name
       * @param {boolean} cancelable
       * @param {function} callback
       * @returns {boolean}
       */
      function attributeEventCallback(
        attributeName,
        node,
        mutationType,
        name,
        cancelable,
        callback,
      ) {
        const eventResponse = document.body.dispatchEvent(
          new CustomEvent(name, {
            cancelable,
            detail: { attributeName, node, mutationType },
          }),
        );
        const callbackResponse = callback(attributeName, node, mutationType);
        return eventResponse && callbackResponse;
      }

      const noOp = () => {};

      /** @type {Map<string, Config>} */
      let configs = new Map();

      /**
       * @returns {ConfigInternal}
       */
      function createDefaults() {
        /** @type ConfigInternal */
        let initialDefaults = {
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
          eventCallbacks: "", //"beforeNodeAdded,afterNodeAdded,beforeNodeMorphed,afterNodeMorphed,beforeNodeRemoved,afterNodeRemoved,beforeAttributeUpdated",
        };

        /** @type HTMLMetaElement|null */
        const configMeta = document.querySelector(
          'meta[name="idiomorph-config"]',
        );
        if (configMeta) {
          const configs = JSON.parse(configMeta.content);
          for (const name in configs) {
            if (name == "defaults") {
              initialDefaults = mergeConfig(initialDefaults, configs[name]);
            } else {
              addConfig(name, configs[name]);
            }
          }
        }
        return initialDefaults;
      }

      /**
       * Deep merges the config object and the Idiomorph.defaults object to
       * produce a final configuration object
       * @param {Config|string} config
       * @returns {ConfigInternal}
       */
      function getConfig(config) {
        let finalConfig = defaults;
        if (typeof config == "string") {
          for (const configStr of config.split(",")) {
            const configVal = configs.get(configStr);
            if (configVal) {
              finalConfig = mergeConfig(finalConfig, configVal);
            }
          }
        } else {
          finalConfig = mergeConfig(finalConfig, config);
        }
        // @ts-ignore eventCallbacks will always be a string from defaults
        for (const event of finalConfig.eventCallbacks.split(",")) {
          // @ts-ignore safe to lookup event name as we check it is defined before using it
          const callback = finalConfig.callbacks[event];
          if (callback) {
            const cancelable = event.indexOf("before") === 0;
            const eventName =
              "im-" +
              event.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
            if (event.indexOf("Morphed") !== -1) {
              // @ts-ignore
              finalConfig.callbacks[event] = (oldNode, newNode) => {
                return morphEventCallback(
                  oldNode,
                  newNode,
                  eventName,
                  cancelable,
                  callback,
                );
              };
            } else if (event.indexOf("Updated") !== -1) {
              // @ts-ignore
              finalConfig.callbacks[event] = (attributeName, node, mutType) => {
                return attributeEventCallback(
                  attributeName,
                  node,
                  mutType,
                  eventName,
                  cancelable,
                  callback,
                );
              };
            } else {
              // @ts-ignore
              finalConfig.callbacks[event] = (node) => {
                return nodeEventCallback(node, eventName, cancelable, callback);
              };
            }
          }
        }
        return finalConfig;
      }

      /**
       * @param {ConfigInternal} defaults
       * @param {Config} config
       * @returns {ConfigInternal}
       */
      function mergeConfig(defaults, config) {
        let finalConfig = { ...defaults };
        // @ts-ignore copy top level stuff into final config ignoring trivial type differences
        finalConfig = { ...finalConfig, ...config };
        finalConfig.callbacks = { ...defaults.callbacks, ...config.callbacks };
        return finalConfig;
      }

      /**
       * Add a saved config
       * @param {string} name
       * @param {Config} config
       * @returns {void}
       */
      function addConfig(name, config) {
        // @ts-ignore we can delete this property
        delete configs.name;
        configs.set(name, config);
      }

      /**
       * @returns {HTMLDivElement}
       */
      function createPantry() {
        const pantry = document.createElement("div");
        pantry.hidden = true;
        document.body.insertAdjacentElement("afterend", pantry);
        return pantry;
      }

      /**
       * Returns all elements with an ID contained within the root element and its descendants
       *
       * @param {Element} root
       * @returns {Element[]}
       */
      function findIdElements(root) {
        let elements = Array.from(root.querySelectorAll("[id]"));
        if (root.id) {
          elements.push(root);
        }
        return elements;
      }

      /**
       * A bottom-up algorithm that populates a map of Element -> IdSet.
       * The idSet for a given element is the set of all IDs contained within its subtree.
       * As an optimzation, we filter these IDs through the given list of persistent IDs,
       * because we don't need to bother considering IDed elements that won't be in the new content.
       *
       * @param {Map<Node, Set<string>>} idMap
       * @param {Set<string>} persistentIds
       * @param {Element|null} root
       * @param {Element[]|NodeListOf<Element>} elements
       */
      function populateIdMapWithTree(idMap, persistentIds, root, elements) {
        for (const elt of elements) {
          if (persistentIds.has(elt.id)) {
            /** @type {Element|null} */
            let current = elt;
            // walk up the parent hierarchy of that element, adding the id
            // of element to the parent's id set
            while (current && current !== root) {
              let idSet = idMap.get(current);
              // if the id set doesn't exist, create it and insert it in the map
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
       * @param {Element} oldNode  the old node that will be morphed
       * @param {Element} newContent  the new content parentNode to morph to
       * @returns {IdSets}
       */
      function createIdMaps(oldNode, newContent) {
        const oldIdElements = findIdElements(oldNode);
        const newIdElements = newContent.querySelectorAll("[id]");

        const persistentIds = createPersistentIds(oldIdElements, newIdElements);

        /** @type {Map<Node, Set<string>>} */
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

      /**
       * This function computes the set of ids that persist between the two contents excluding duplicates
       *
       * @param {Element[]} oldIdElements
       * @param {NodeListOf<Element>} newIdElements
       * @returns {Set<string>}
       */
      function createPersistentIds(oldIdElements, newIdElements) {
        let duplicateIds = new Set();

        /** @type {Map<string, string>} */
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
          // skip if tag types mismatch because its not possible to morph one tag into another
        }

        for (const id of duplicateIds) {
          persistentIds.delete(id);
        }
        return persistentIds;
      }

      return { createMorphContext, createDefaults, addConfig, getConfig };
    })();

  //=============================================================================
  // HTML Normalization Functions
  //=============================================================================
  const { normalizeElement, normalizeParent } = (function () {
    /** @type {WeakSet<Node>} */
    const generatedByIdiomorph = new WeakSet();

    /**
     *
     * @param {Element | Document} content
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
     * @param {null | string | Node | HTMLCollection | Node[] | Document & {generatedByIdiomorph:boolean}} newContent
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
        // a single node is added as a child to a dummy parent
        const dummyParent = document.createElement("div");
        dummyParent.append(newContent);
        return dummyParent;
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

  const defaults = createDefaults();

  //=============================================================================
  // This is what ends up becoming the Idiomorph global object
  //=============================================================================
  return {
    morph,
    defaults,
    addConfig,
    getConfig,
  };
})();
