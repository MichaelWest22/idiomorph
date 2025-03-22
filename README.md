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

### Options

Idiomorph supports the following options:

| option (with default)         | meaning                                                                                                    | example                                                                     |
|-------------------------------|------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------|
| `morphStyle: 'outerHTML'`     | The style of morphing to use, either `outerHTML` or `innerHTML`                                            | `Idiomorph.morph(..., {morphStyle:'innerHTML'})`                            |
| `ignoreActive: false`         | If `true`, idiomorph will skip the active element                                                          | `Idiomorph.morph(..., {ignoreActive:true})`                                 |
| `callbacks: {...}`            | Allows you to insert callbacks when events occur in the morph lifecycle. See the callback table below      | `Idiomorph.morph(..., {callbacks:{beforeNodeAdded:function(node){...}})`    |
| `eventCallbacks: ''`          | Allows you list which callbacks should also be implemented as browser events via document event Listeners  | `Idiomorph.morph(..., {eventCallbacks:'beforeNodeAdded,beforeNodeRemoved'})`|

#### Callbacks

Hxiomorph/Idiomorph provides the following callbacks, which can be used to intercept and, for some callbacks, modify the swapping behavior
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

### The `head` tag

Idiomorph has special handling for the `head` tag but this is not used during htmx swapping so this feature has been removed from Hxiomorph so it can focus on what htmx needs.  For advanced head support in htmx use the `head-support` htmx extension.

### Setting Defaults

All the behaviors specified above can be set to a different default by mutating the `Idiomorph.defaults` object, including
the `Idiomorph.defaults.callbacks` object.
