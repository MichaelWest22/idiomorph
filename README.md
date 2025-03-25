<h1 style="font-family: Verdana,sans-serif;">♻️ Hxiomorph</h1>

Hxiomorph is a htmx focoused fork of Idiomoprh which is a javascript library and htmx extension for morphing one DOM tree to another.  See [Idiomorph](https://github.com/bigskysoftware/idiomorph) for more details.

## Whats New

Hxiomorph gives you all of the Idiomorph mrophing goodness but with a few simplifications for using it with a htmx project
* Removed custom head support because htmx does not need it. Use head-support htmx extension for better head swapping
* Removed restoreFocus feature as this is built into htmx already 
* Removed ignoreActiveValue feature as this is being replaced with better input value handling
* Adding a new eventCallbacks option to allow configuring callbacks via event listeners
* Adding a new addConfig method to allow simple string aliases for custom config instead of javascript eval method
* Adding meta tag based config definition to mirror htmx config method
* Improved findBestMatch id matching to match old Idiomorph matching behaviour
* Added Attribute morphing method that morphs just the single nodes attributes without touching inner content
* Fixed input handling so by default it does not reset input values unless you change them with syncInputValue fallback option
* Added morphByDefault override that turns all innerHTML/outerHTML swaps into morphs by default

## Breaking Changes!

* Default input handling no longer updates input values when morhing no changes. Use the syncInputValue option to revert to the old behaviour
* When used as an htmx extension it now upgrades all innerHTML/outerHTML swaps into morphs which you can turn off with htmx.config.morphByDefault=false

## API Usage

Hxiomorph has a very simple API the same as Idiomorph:

```js
  Idiomorph.morph(existingNode, newNode);
```

This will morph the existingNode to have the same structure as the newNode.  Note that this is a destructive operation
with respect to both the existingNode and the newNode.

You can also pass string content in as the second argument, and Hxiomorph will parse the string into nodes:

```js
  Idiomorph.morph(existingNode, "<div>New Content</div>");
```

And it will be parsed and merged into the new content.

If you wish to target the `innerHTML` rather than the `outerHTML` of the content, you can pass in a `morphStyle` 
in a third config argument:

```js
  Idiomorph.morph(existingNode, "<div>New Content</div>", {morphStyle:'innerHTML'});
```

This will replace the _inner_ content of the existing node with the new content.

If you wish to morph just a single nodes attributes you can pass in a `morphStyle` 
of `attributes` instead:

```js
  Idiomorph.morph(existingNode, '<div class="show">Ignore inner content</div>', {morphStyle:'attributes'});
```

This will update just the single nodes attributes to match those on the new supplied one but will leave the inner contents un-touched.

### Options

Hxiomorph supports the following options:

| option (with default)         | meaning                                                                                                    | example                                                                     |
|-------------------------------|------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------|
| `morphStyle: 'outerHTML'`     | The style of morphing to use, either `outerHTML` or `innerHTML`                                            | `Idiomorph.morph(..., {morphStyle:'innerHTML'})`                            |
| `ignoreActive: false`         | If `true`, idiomorph will skip the active element                                                          | `Idiomorph.morph(..., {ignoreActive:true})`                                 |
| `syncInputValue: false`       | If `true`, idiomorph will reset and override all user changed input values just like idiomorph used to do  | `Idiomorph.morph(..., {syncInputValue:true})`                               |
| `callbacks: {...}`            | Allows you to insert callbacks when events occur in the morph lifecycle. See the callback table below      | `Idiomorph.morph(..., {callbacks:{beforeNodeAdded:function(node){...}})`    |
| `eventCallbacks: ''`          | Allows you list which callbacks should also be implemented as browser events via document event Listeners  | `Idiomorph.morph(..., {eventCallbacks:'beforeNodeAdded,beforeNodeRemoved'})`|

The htmx extension also adds a new htmx config item `htmx.config.morphByDefault` which defaults to on but can be disabled if required by setting to false. When `morphByDefault` is left on all htmx outerHTML/innerHTML swaps and oob-swaps are upgraded to act as equivalent morph operations instead. This applies hxiomorph swapping to your whole page if the extension is placed on the body tag and this can cause input values and other state to not get auto reset and blanked out during swaps. Setting `syncInputValue` option to default to true may be useful if input value resetting is needed.

### Setting Defaults and Configs

All the behaviors specified above can be set to a different default by mutating the `Idiomorph.defaults` object, including
the `Idiomorph.defaults.callbacks` object.

For htmx websites config is often configured via a meta tag placed in the head of the page and this some feature has been added to hxiomorph

Here is how to set both htmx and idiomorph configs via meta tags:
```html
<head>
  <meta name="htmx-config" content='{"defaultSwapStyle":"morph", "morphByDefault":false}'>
  <meta name="idiomorph-config" content='{"defaults":{"eventCallbacks": "BeforeNodeMorphed"},"noCallback":{"eventCallbacks": ""}}' />
</head>
```
This shows how to set the `htmx-config` to have morph as the default swap style and turn off the new morphByDefault feature
The `idiomorph-config` has a key of `defaults` and this allows setting the `Idiomorph.defaults` object. In this case it enables the BeforeNodeMorphed event callback by default.
You can then add additional optional config keys like the `noCallback` custom option here to disable the event callbacks

You can also add additional optional config's via javascript which allows the creation of custom callbacks that can be configued on page load and then reused later easily 

```js
  Idiomorph.addConfig("innerHTML", { morphStyle: "innerHTML" });
  Idiomorph.addConfig('preserve', 
    {
      callbacks: {
        // basic implementation of a preserve-me attr
        beforeNodeMorphed(oldNode, newContent) {
          if (oldNode.dataset?.preserveMe) return false;
        },
      },
  );
```

### Using Configs

The third parameter of the morph function can now take a comma seperated string list of configs to apply:

```js
  Idiomorph.morph(existingNode, "<div>New Content</div>", "innerHTML,preserve");
```
It will apply the `Idiomorph.defaults` object first and then each config in order with later configs overriding earlier options.


### Callbacks

Hxiomorph/Idiomorph provides the following javascript function callbacks, which can be used to intercept and, for some callbacks, modify the swapping behavior
of the algorithm.

| callback                                                  | description                                                                                                    | return value meaning                               |
|-----------------------------------------------------------|----------------------------------------------------------------------------------------------------------------|----------------------------------------------------|
| beforeNodeAdded(node)                                     | Called before a new node is added to the DOM                                                                   | return false to not add the node                   |
| afterNodeAdded(node)                                      | Called after a new node is added to the DOM                                                                    | none                                               |
| beforeNodeMorphed(oldNode, newNode)                       | Called before a node is morphed in the DOM                                                                     | return false to skip morphing the node             |
| afterNodeMorphed(oldNode, newNode)                        | Called after a node is morphed in the DOM                                                                      | none                                               |
| beforeNodeRemoved(node)                                   | Called before a node is removed from the DOM                                                                   | return false to not remove the node                |
| afterNodeRemoved(node)                                    | Called after a node is removed from the DOM                                                                    | none                                               |
| beforeAttributeUpdated(attributeName, node, mutationType) | Called before an attribute on an element is updated or removed (`mutationType` is either "update" or "remove") | return false to not update or remove the attribute |

### Event Callbacks

The callbacks can now also be turned into browser events so you can implement multiple event listeners instead of a single callback function.  To enable each event callback you need to set the `eventCallbacks` option with a comma seperated list of all the callback names you want to fire. The event names to listen for are lowercase kebab style with a `im-` prefix like `im-before-node-added`

| callback              | event name                  | event detail data                                 | possible action                                            |
|-----------------------|-----------------------------|---------------------------------------------------|------------------------------------------------------------|
| beforeNodeAdded       | im-before-node-added        | evt.detail: { node }                              | evt.preventDefault() to not add the node                   |
| afterNodeAdded        | im-after-node-added         | evt.detail: { node }                              | none                                                       |
| beforeNodeMorphed     | im-before-node-morphed      | evt.detail: { oldNode, newNode }                  | evt.preventDefault() to skip morphing the node             |
| afterNodeMorphed      | im-after-node-morphed       | evt.detail: { oldNode, newNode }                  | none                                                       |
| beforeNodeRemoved     | im-before-node-removed      | evt.detail: { node }                              | evt.preventDefault() to not remove the node                |
| afterNodeRemoved      | im-after-node-removed       | evt.detail: { node }                              | none                                                       |
| beforeAttributeUpdated| im-before-attribute-updated | evt.detail: { attributeName, node, mutationType } | evt.preventDefault() to not update or remove the attribute |

The events are all targeted to the document.body element and not to the element being updated so that all the event actions are viewable. These events do not bubble and can only be actioned on the body element

```js
document.body.addEventListener('im-before-node-morphed', function(evt) {
  if (evt.detail.oldNode.dataset?.preserveMe) evt.preventDefault();;
});
```

### htmx

Hxiomorph was created to integrate with [htmx](https://htmx.org) and can be used as a swapping mechanism by including
the `dist/idiomorph-ext.js` file in your HTML:

```html
<script src="idiomorph-ext.min.js"></script>
<div hx-ext="morph">
    
    <button hx-get="/example" hx-swap="morph:innerHTML">
        Morph My Inner HTML
    </button>

    <button hx-get="/example" hx-swap="morph:outerHTML">
        Morph My Outer HTML
    </button>
    
    <button hx-get="/example" hx-swap="morph">
        Morph My Outer HTML
    </button>
    
</div>
```

Note that this file includes both Idiomorph and the htmx extension.

#### Configuring Morphing Behavior in htmx

The Hxiomorph extension for htmx supports a new simplified syntax:

* `hx-swap='morph'` - This will perform a morph on the outerHTML of the target
* `hx-swap='morph:outerHTML'` - This will perform a morph on the outerHTML of the target (explicit)
* `hx-swap='morph:innerHTML'` - This will perform a morph on the innerHTML of the target (i.e. the children)
* `hx-swap='morph:ignoreActive'` - A default (outerHTML) morph but avoid changing the active element
* `hx-swap='morph:syncInputValue'` - A default (outerHTML) morph but also overwrite all input values like the original idiomorph does
* `hx-swap='morph:attributes'` - This will perform a morph of just the attributes of the top node targeted while leaving child content alone
* `hx-swap='morph:addAttributes'` - Same as attributes but it only adds attributes that are missing from the original content node
* `hx-swap='morph:removeAttributes'` - Same as attributes but it only removes attributes that are missing from the new content node
* `hx-swap='morph:innerHTML, ignoreActive, syncInputValue'` - You can combine multiple options or custom configs via a comma seperated list

For `hx-swap-oob` the `:` character is already used as a seperator so for these replace it with a `;`

```html
<div hx-swap-oob="morph;innerHTML:#alert">alert message here</div>
```

The new `attributes` option added in Hxiomorph is also useful with oob swaps:

```html
<div hx-swap-oob="morph;attributes:#id" class="added" hx-get="/updated"></div>
```

#### htmx and callbacks

To use the advanced callback features inside htmx there are several options. 
* Use a JS script to set the `Idiomorph.defaults` callbacks functions
* Use a JS script to call addConfig to create the custom callback and then use `hx-swap="morph:custom"`
* Use a JS script to add a document.body.addEventListener() and set `eventCallbacks` config to enable it
* Add a hx-on attribute to body tag like `hx-on-im-before-node-morphed` and set `eventCallbacks` in a meta config tag